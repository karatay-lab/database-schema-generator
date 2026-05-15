import { NextResponse } from "next/server";
import { readProjects } from "@/lib/projects-store";
import { getSchemaStats } from "@/lib/schema-store";

export type VersionHistory = {
  name: string;
  createdAt: string;
  tables: number;
  fields: number;
  relations: number;
  restrictions: number;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId") ?? "";

  if (!projectId) {
    return NextResponse.json({ error: "Project id is required." }, { status: 400 });
  }

  const projects = await readProjects();
  const project = projects.find((p) => p.id === projectId);

  if (!project) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  const versions: VersionHistory[] = await Promise.all(
    project.versions.map(async (v) => {
      const stats = await getSchemaStats(project.name, v.name).catch(() => ({
        tableCount: 0,
        fieldCount: 0,
        relationCount: 0,
        restrictionCount: 0,
      }));
      return {
        name: v.name,
        createdAt: v.createdAt,
        tables: stats.tableCount,
        fields: stats.fieldCount,
        relations: stats.relationCount,
        restrictions: stats.restrictionCount,
      };
    }),
  );

  return NextResponse.json({ versions });
}
