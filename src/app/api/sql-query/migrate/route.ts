import { NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { copyFile, mkdir, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { generateSQLiteSchema } from "@/lib/schema-store";

const execFileAsync = promisify(execFile);

function toSchemaFilePart(value: string) {
  return (
    value.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "untitled"
  );
}

function getDatabasesDir(projectName: string) {
  return path.join(process.cwd(), "src/database/databases", toSchemaFilePart(projectName));
}

function getDbPath(projectName: string, version: string) {
  return path.join(getDatabasesDir(projectName), `${toSchemaFilePart(version)}.db`);
}

function getSchemaPath(projectName: string, version: string) {
  return path.join(
    tmpdir(),
    "database-schema-generator",
    "schemas",
    `${toSchemaFilePart(projectName)}-${toSchemaFilePart(version)}-sqlite.prisma`,
  );
}

function stripAnsi(text: string) {
  return text.replace(/\x1b\[[0-9;]*m/g, "").replace(/\r/g, "");
}

async function runPrisma(args: string[]): Promise<{ output: string; success: boolean }> {
  try {
    const result = await execFileAsync("pnpm", ["prisma", ...args], {
      cwd: process.cwd(),
      env: { ...process.env, PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK: "1" },
    });
    return {
      output: stripAnsi(`${result.stdout}\n${result.stderr}`.trim()),
      success: true,
    };
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; message?: string };
    return {
      output: stripAnsi(`${e.stdout ?? ""}\n${e.stderr ?? ""}\n${e.message ?? ""}`.trim()),
      success: false,
    };
  }
}

export type MigrateStep = {
  name: "validate" | "push";
  output: string;
  success: boolean;
};

export async function POST(request: Request) {
  const body = (await request.json()) as Record<string, unknown>;
  const projectName = typeof body.projectName === "string" ? body.projectName.trim() : "";
  const version = typeof body.version === "string" ? body.version.trim() : "";

  if (!projectName || !version) {
    return NextResponse.json(
      { error: "Project name and version are required." },
      { status: 400 },
    );
  }

  const dbPath = getDbPath(projectName, version);
  const schemaPath = getSchemaPath(projectName, version);
  const relPath = path.relative(process.cwd(), dbPath);
  const schemaRelPath = path.relative(process.cwd(), schemaPath);

  try {
    await Promise.all([
      mkdir(path.dirname(dbPath), { recursive: true }),
      mkdir(path.dirname(schemaPath), { recursive: true }),
    ]);

    const sqliteSchema = await generateSQLiteSchema(projectName, version);
    await writeFile(schemaPath, sqliteSchema, "utf8");

    const steps: MigrateStep[] = [];

    // Step 1: validate
    const validateResult = await runPrisma(["validate", "--schema", schemaPath]);
    steps.push({ name: "validate", ...validateResult });

    if (!validateResult.success) {
      return NextResponse.json({
        success: false,
        stage: "validate",
        steps,
        dbPath,
        relPath,
        schemaRelPath,
      });
    }

    // Backup the existing database before pushing (table renames cause data loss with --accept-data-loss)
    let backupRelPath: string | null = null;
    if (existsSync(dbPath)) {
      const backupDir = path.join(path.dirname(dbPath), "backups");
      await mkdir(backupDir, { recursive: true });
      const ts = new Date().toISOString().replace(/[:.]/g, "-");
      const backupPath = path.join(backupDir, `${path.basename(dbPath, ".db")}-${ts}.db`);
      await copyFile(dbPath, backupPath);
      backupRelPath = path.relative(process.cwd(), backupPath);
    }

    // Step 2: db push
    const pushResult = await runPrisma([
      "db", "push",
      "--schema", schemaPath,
      `--url=file:${dbPath}`,
      "--accept-data-loss",
    ]);
    steps.push({ name: "push", ...pushResult });

    return NextResponse.json({
      success: pushResult.success,
      stage: "push",
      steps,
      dbPath,
      relPath,
      schemaRelPath,
      backupRelPath,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Migration failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    await rm(schemaPath, { force: true });
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectName = searchParams.get("projectName") ?? "";
  const version = searchParams.get("version") ?? "";

  if (!projectName || !version) {
    return NextResponse.json(
      { error: "Project name and version are required." },
      { status: 400 },
    );
  }

  const schemaPath = getSchemaPath(projectName, version);

  try {
    await rm(schemaPath, { force: true });
    return NextResponse.json({
      deleted: true,
      schemaRelPath: path.relative(process.cwd(), schemaPath),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Delete failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
