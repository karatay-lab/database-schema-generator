import { NextResponse } from "next/server";
import { rm } from "node:fs/promises";
import path from "node:path";
import { db } from "@/lib/db/client";

const databaseDir = path.join(process.cwd(), "src/database");

export async function POST() {
  try {
    // Delete all projects — cascades to all schema tables, model_stores,
    // project_versions, migration_connections, migration_workflow_state, etc.
    db.prepare("DELETE FROM projects").run();

    // Also clear ui_state so the app doesn't try to restore a deleted project
    db.prepare("DELETE FROM ui_state").run();

    // Remove all generated + operational artifact directories
    await Promise.allSettled([
      rm(path.join(databaseDir, "schemas"), { recursive: true, force: true }),
      rm(path.join(databaseDir, "zod"), { recursive: true, force: true }),
      rm(path.join(databaseDir, "migrations"), { recursive: true, force: true }),
      rm(path.join(databaseDir, "databases"), { recursive: true, force: true }),
    ]);

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Reset failed.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
