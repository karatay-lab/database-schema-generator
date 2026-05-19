import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { getSchema } from "@mrleebo/prisma-ast";
import type { Model } from "@mrleebo/prisma-ast";
import type { StoredConnection } from "@/types/migrations";
import { getConnection } from "@/lib/db/migration-connections";

const execFileAsync = promisify(execFile);
const tmpDir = path.join(tmpdir(), "database-schema-generator", "schemas");

function buildConnectionUrl(conn: StoredConnection): string {
  const p = conn.provider.toLowerCase();
  if (p === "sqlite") return `file:${conn.database}`;
  const proto = p === "mysql" ? "mysql" : "postgresql";
  return `${proto}://${encodeURIComponent(conn.user)}:${encodeURIComponent(conn.password)}@${conn.host}:${conn.port}/${conn.database}`;
}

function toPrismaProvider(provider: string): string {
  const p = provider.toLowerCase();
  if (p === "mysql") return "mysql";
  if (p === "sqlite") return "sqlite";
  return "postgresql";
}

function stripAnsi(text: string) {
  return text.replace(/\x1b\[[0-9;]*m/g, "").replace(/\r/g, "");
}

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function jsonError(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status });
}

export async function POST(request: Request) {
  const body = (await request.json()) as Record<string, unknown>;
  const projectName = getString(body.projectName);
  const connectionId = getString(body.connectionId);
  const syncVersion = getString(body.syncVersion);

  if (!projectName || !connectionId || !syncVersion) {
    return jsonError("Project name, connection ID, and sync version are required.");
  }

  let stored;
  try {
    stored = getConnection(connectionId);
  } catch {
    return jsonError("Could not read connection data.", 500);
  }
  if (!stored) return jsonError("Connection not found. Complete the connection step first.", 404);

  const connectionUrl = buildConnectionUrl(stored);
  const prismaProvider = toPrismaProvider(stored.provider);
  const tmpSchemaPath = path.join(tmpDir, `migration-pull-${Date.now()}.prisma`);
  const datasourceSchema = `datasource db {\n  provider = "${prismaProvider}"\n}\n`;

  try {
    await mkdir(tmpDir, { recursive: true });

    await writeFile(tmpSchemaPath, datasourceSchema, "utf8");

    let introspectedSchema = "";
    let tables: string[] = [];

    try {
      const result = await execFileAsync(
        "pnpm",
        ["prisma", "db", "pull", "--print", "--schema", tmpSchemaPath, `--url=${connectionUrl}`],
        { cwd: process.cwd(), timeout: 30_000 },
      );
      introspectedSchema = result.stdout;
      const parsed = getSchema(introspectedSchema);
      tables = parsed.list
        .filter((b) => b.type === "model")
        .map((b) => (b as Model).name);
    } catch (pullErr) {
      const e = pullErr as { stdout?: string; stderr?: string; message?: string };
      const raw = `${e.stdout ?? ""}\n${e.stderr ?? ""}\n${e.message ?? ""}`;
      if (raw.includes("P4001")) {
        introspectedSchema = datasourceSchema;
        tables = [];
      } else {
        throw new Error(stripAnsi(raw.trim()) || "Introspection failed.");
      }
    }

    const hash = createHash("sha256").update(introspectedSchema, "utf8").digest("hex");

    return NextResponse.json({
      success: true,
      hash,
      tables,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Pull failed.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  } finally {
    await rm(tmpSchemaPath, { force: true });
  }
}
