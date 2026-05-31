import { NextResponse } from "next/server";
import { rm } from "node:fs/promises";
import path from "node:path";
import { db as appDb } from "@/lib/db/client";
import { deleteConnection, listConnections } from "@/lib/db/migration-connections";

const migrationsDir = () => path.join(process.cwd(), "src/database/migrations");

function toSlug(value: string) {
  return (
    value.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "untitled"
  );
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectName = searchParams.get("projectName")?.trim() ?? "";

  if (!projectName) {
    return NextResponse.json({ success: false, error: "Project name is required." }, { status: 400 });
  }

  const projectRow = appDb
    .prepare("SELECT id FROM projects WHERE name = ?")
    .get(projectName) as { id: string } | undefined;
  if (!projectRow) {
    return NextResponse.json({ success: true, connections: [] });
  }

  try {
    const connections = listConnections(projectRow.id);
    return NextResponse.json({ success: true, connections });
  } catch {
    return NextResponse.json({ success: true, connections: [] });
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectName = searchParams.get("projectName")?.trim() ?? "";
  const uuid = searchParams.get("uuid")?.trim() ?? "";

  if (!projectName || !uuid) {
    return NextResponse.json(
      { success: false, error: "Project name and connection UUID are required." },
      { status: 400 },
    );
  }

  deleteConnection(uuid);

  // Remove data/logs artifacts for this connection from the filesystem
  await rm(path.join(migrationsDir(), toSlug(projectName), uuid), {
    recursive: true,
    force: true,
  });

  const projectRow = appDb
    .prepare("SELECT id FROM projects WHERE name = ?")
    .get(projectName) as { id: string } | undefined;
  const connections = projectRow ? listConnections(projectRow.id) : [];

  return NextResponse.json({ success: true, connections });
}
