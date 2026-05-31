import { NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import { getSchema } from "@mrleebo/prisma-ast";
import type { Model } from "@mrleebo/prisma-ast";
import { db as appDb } from "@/lib/db/client";
import { saveConnection } from "@/lib/db/migration-connections";

const execFileAsync = promisify(execFile);
const tmpDir = path.join(tmpdir(), "database-schema-generator", "schemas");

function buildConnectionUrl(
  provider: string,
  host: string,
  port: string,
  user: string,
  password: string,
  database: string,
): string {
  const p = provider.toLowerCase();
  if (p === "sqlite") return `file:${database}`;
  const proto = p === "mysql" ? "mysql" : "postgresql";
  return `${proto}://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
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
  const connectionName = getString(body.connectionName);
  const provider = getString(body.provider);
  const host = getString(body.host);
  const port = getString(body.port);
  const user = getString(body.user);
  const password = getString(body.password);
  const database = getString(body.database);

  if (!projectName || !provider) return jsonError("Project name and provider are required.");
  if (!connectionName) return jsonError("Connection name is required.");
  if (provider.toLowerCase() !== "sqlite" && (!host || !port || !user || !database)) {
    return jsonError("Host, port, user, and database name are required.");
  }
  if (provider.toLowerCase() === "sqlite" && !database) {
    return jsonError("Database file path is required.");
  }

  const projectRow = appDb
    .prepare("SELECT id, provider FROM projects WHERE name = ?")
    .get(projectName) as { id: string; provider: string } | undefined;
  if (!projectRow) return jsonError("Project not found.", 404);

  // Validate that the connection provider matches the project's configured database provider.
  // Normalise "Postgres" / "postgresql" as equivalent.
  function normaliseProvider(p: string) {
    const lc = p.toLowerCase();
    if (lc === "postgres" || lc === "postgresql") return "postgresql";
    return lc;
  }
  if (normaliseProvider(provider) !== normaliseProvider(projectRow.provider)) {
    return jsonError(
      `Provider mismatch: this project is configured as ${projectRow.provider} but the connection uses ${provider}. ` +
      `Create a ${projectRow.provider} connection or change the project's database provider in Settings.`,
      400,
    );
  }

  const connectionUrl = buildConnectionUrl(provider, host, port, user, password, database);
  const prismaProvider = toPrismaProvider(provider);
  const tmpSchemaPath = path.join(tmpDir, `migration-introspect-${Date.now()}.prisma`);
  const datasourceSchema = `datasource db {\n  provider = "${prismaProvider}"\n}\n`;

  try {
    await mkdir(tmpDir, { recursive: true });

    await writeFile(tmpSchemaPath, datasourceSchema, "utf8");

    let tables: string[] = [];
    let introspectedSchema = "";

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
        tables = [];
        introspectedSchema = datasourceSchema;
      } else {
        throw new Error(stripAnsi(raw.trim()) || "Could not connect to the database.");
      }
    }

    const uuid = randomUUID();
    saveConnection(projectRow.id, { id: uuid, name: connectionName, provider, host, port, user, password, database });

    return NextResponse.json({ success: true, uuid, tables, introspectedSchema });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Connection failed.";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  } finally {
    await rm(tmpSchemaPath, { force: true });
  }
}
