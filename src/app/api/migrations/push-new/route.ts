import { NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import type { StoredConnection } from "@/types/migrations";
import { getConnection, touchLastUsedAt } from "@/lib/db/migration-connections";
import { registerFsPath } from "@/lib/db/fs-paths";
import { db as appDb } from "@/lib/db/client";
import { prepareMigrationPrismaSchema } from "@/lib/migration-schema-artifacts";

const execFileAsync = promisify(execFile);
const migrationsDir = () => path.join(process.cwd(), "src/database/migrations");

function toSlug(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "untitled";
}

function buildConnectionUrl(conn: StoredConnection): string {
  const p = conn.provider.toLowerCase();
  if (p === "sqlite") return `file:${conn.database}`;
  const proto = p === "mysql" ? "mysql" : "postgresql";
  return `${proto}://${encodeURIComponent(conn.user)}:${encodeURIComponent(conn.password)}@${conn.host}:${conn.port}/${conn.database}`;
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
  const targetVersion = getString(body.targetVersion);
  const forceReset = body.forceReset === true;

  if (!projectName || !connectionId || !targetVersion) {
    return jsonError("projectName, connectionId, and targetVersion are required.");
  }

  const projectSlug = toSlug(projectName);

  let stored;
  try {
    stored = getConnection(connectionId);
  } catch {
    return jsonError("Could not read connection data.", 500);
  }
  if (!stored) return jsonError("Connection not found. Complete the connection step first.", 404);

  const connectionUrl = buildConnectionUrl(stored);
  let schemaPath: string;
  let schemaCleanupPath = "";
  try {
    const preparedSchema = await prepareMigrationPrismaSchema(projectName, targetVersion);
    schemaPath = preparedSchema.schemaPath;
    schemaCleanupPath = preparedSchema.cleanupPath;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Target schema could not be prepared.";
    return jsonError(message, 404);
  }

  const startedAt = new Date().toISOString();
  const ts = startedAt.replace(/[:.]/g, "-").slice(0, 19);
  const logsDir = path.join(migrationsDir(), projectSlug, connectionId, "logs");
  await mkdir(logsDir, { recursive: true });
  const logFilename = `new-migration-${forceReset ? "destroy-" : ""}${toSlug(targetVersion)}-${ts}.json`;
  const logPath = path.join(logsDir, logFilename);

  const prismaArgs = forceReset
    ? ["prisma", "db", "push", "--force-reset", "--schema", schemaPath, `--url=${connectionUrl}`]
    : ["prisma", "db", "push", "--accept-data-loss", "--schema", schemaPath, `--url=${connectionUrl}`];

  try {
    await execFileAsync("pnpm", prismaArgs, {
      cwd: process.cwd(),
      env: { ...process.env, PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK: "1" },
      timeout: 120_000,
    });

    const completedAt = new Date().toISOString();

    const pidRow = appDb.prepare("SELECT id FROM projects WHERE name = ?").get(projectName) as { id: string } | undefined;
    if (pidRow) {
      registerFsPath({ projectId: pidRow.id, connectionId, fileType: "migration_log", label: logFilename, fsPath: logPath });
    }

    await writeFile(logPath, JSON.stringify({
      status: "success",
      type: forceReset ? "new-migration-force-reset" : "new-migration",
      startedAt,
      completedAt,
      project: projectName,
      connectionId,
      targetVersion,
    }, null, 2), "utf8");

    touchLastUsedAt(connectionId);

    return NextResponse.json({
      success: true,
      logPath: path.relative(process.cwd(), logPath),
      newVersion: targetVersion,
    });

  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; message?: string };
    const output = `${e.stdout ?? ""}\n${e.stderr ?? ""}\n${e.message ?? ""}`.trim();
    await writeFile(logPath, JSON.stringify({
      status: "error",
      type: "new-migration",
      startedAt,
      failedAt: new Date().toISOString(),
      project: projectName,
      connectionId,
      targetVersion,
      error: output || "Push failed.",
    }, null, 2), "utf8").catch(() => { /* best-effort */ });
    return NextResponse.json({ success: false, error: output || "Push failed." }, { status: 400 });
  } finally {
    if (schemaCleanupPath) {
      await rm(schemaCleanupPath, { force: true, recursive: true });
    }
  }
}
