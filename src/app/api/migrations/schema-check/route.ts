import { NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { access } from "node:fs/promises";
import { promisify } from "node:util";
import type { SchemaCheckResult } from "@/types/migrations";
import { prepareMigrationPrismaSchema } from "@/lib/migration-schema-artifacts";

const execFileAsync = promisify(execFile);

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function stripAnsi(text: string) {
  return text.replace(/\x1b\[[0-9;]*m/g, "").replace(/\r/g, "");
}

// Parse prisma validate output into structured error lines
function parseValidationOutput(raw: string): string[] {
  return stripAnsi(raw)
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && (l.startsWith("error") || l.startsWith("Error") || l.includes("-->") || /^\d+ \|/.test(l) || l.includes("Validation Error")))
    .slice(0, 20); // cap at 20 lines
}

async function validateSchema(version: string, schemaPath: string): Promise<SchemaCheckResult> {
  // Check file exists first
  try {
    await access(schemaPath);
  } catch {
    return { version, valid: false, errors: [`Schema file not found: ${schemaPath}`] };
  }

  try {
    await execFileAsync(
      "pnpm",
      ["prisma", "validate", "--schema", schemaPath],
      { cwd: process.cwd(), timeout: 30_000 },
    );
    return { version, valid: true, errors: [] };
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; message?: string };
    const raw = `${e.stderr ?? ""}\n${e.stdout ?? ""}`.trim();
    const errors = parseValidationOutput(raw);
    return { version, valid: false, errors: errors.length > 0 ? errors : [raw.split("\n")[0] ?? "Validation failed."] };
  }
}

export async function POST(request: Request) {
  const body = (await request.json()) as Record<string, unknown>;
  const projectName = getString(body.projectName);
  const syncVersion = getString(body.syncVersion);
  const targetVersion = getString(body.targetVersion);

  if (!projectName || !syncVersion || !targetVersion) {
    return NextResponse.json({ success: false, error: "Project name, sync version, and target version are required." }, { status: 400 });
  }

  try {
    const [{ schemaPath: syncPath }, { schemaPath: targetPath }] = await Promise.all([
      prepareMigrationPrismaSchema(projectName, syncVersion),
      prepareMigrationPrismaSchema(projectName, targetVersion),
    ]);
    const [sync, target] = await Promise.all([
      validateSchema(syncVersion, syncPath),
      validateSchema(targetVersion, targetPath),
    ]);

    return NextResponse.json({
      success: true,
      sync,
      target,
      bothValid: sync.valid && target.valid,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Schema check failed.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
