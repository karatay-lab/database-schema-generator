import { NextResponse } from "next/server";
import { listSchemaImports } from "@/lib/schema-imports-store";
import { getSchemaStats } from "@/lib/schema-store";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectName = searchParams.get("projectName") ?? "";
  const version = searchParams.get("version") ?? "";

  if (!projectName || !version) {
    return NextResponse.json({
      fieldCount: 0,
      importQueuedCount: 0,
      relationCount: 0,
      restrictionCount: 0,
      tableCount: 0,
    });
  }

  try {
    const [stats, imports] = await Promise.all([
      getSchemaStats(projectName, version),
      listSchemaImports(),
    ]);
    const importedGroup = imports.groups.find((group) => group.kind === "imported");
    return NextResponse.json({
      ...stats,
      importQueuedCount: importedGroup?.files.length ?? 0,
    });
  } catch {
    return NextResponse.json({
      fieldCount: 0,
      importQueuedCount: 0,
      relationCount: 0,
      restrictionCount: 0,
      tableCount: 0,
    });
  }
}
