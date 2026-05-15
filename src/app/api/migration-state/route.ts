import { NextResponse } from "next/server";
import { getMigrationState, setMigrationState, clearMigrationState, listMigrationSessions } from "@/lib/db/migration-state";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");
  const list = searchParams.get("list");

  if (list === "true") {
    return NextResponse.json(listMigrationSessions(projectId ?? undefined));
  }

  if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });
  return NextResponse.json(getMigrationState(projectId) ?? null);
}

export async function PATCH(request: Request) {
  const body = (await request.json()) as {
    projectId: string;
    connectionId?: string | null;
    syncVersion?: string | null;
    targetVersion?: string | null;
    dataTimestamp?: string | null;
    zodGenerated?: boolean;
    schemaCheckPassed?: boolean;
    validationPassed?: boolean;
    runLogPath?: string | null;
  };
  if (!body.projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });
  setMigrationState(body.projectId, {
    connectionId: body.connectionId,
    syncVersion: body.syncVersion,
    targetVersion: body.targetVersion,
    dataTimestamp: body.dataTimestamp,
    zodGenerated: body.zodGenerated,
    schemaCheckPassed: body.schemaCheckPassed,
    validationPassed: body.validationPassed,
    runLogPath: body.runLogPath,
  });
  return NextResponse.json(getMigrationState(body.projectId));
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");
  if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });
  clearMigrationState(projectId);
  return NextResponse.json({ success: true });
}
