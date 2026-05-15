import { NextResponse } from "next/server";
import { access } from "node:fs/promises";
import path from "node:path";

function toSchemaFilePart(value: string) {
  return (
    value.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "untitled"
  );
}

function getDbPath(projectName: string, version: string) {
  return path.join(
    process.cwd(),
    "src/database/databases",
    toSchemaFilePart(projectName),
    `${toSchemaFilePart(version)}.db`,
  );
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectName = searchParams.get("projectName") ?? "";
  const version = searchParams.get("version") ?? "";

  if (!projectName || !version) {
    return NextResponse.json(
      { error: "Project name and version are required." },
      { status: 400 },
    );
  }

  const dbPath = getDbPath(projectName, version);
  const relPath = path.relative(process.cwd(), dbPath);

  try {
    await access(dbPath);
    return NextResponse.json({ initialized: true, dbPath, relPath });
  } catch {
    return NextResponse.json({ initialized: false, dbPath, relPath });
  }
}
