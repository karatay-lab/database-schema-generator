import type { ParsedPreview, VersionStats } from "@/types/imports";

export function todayVersionName(): string {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `1.${mm}${dd}`;
}

export function parsePicklePreview(content: string): ParsedPreview {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("Not valid JSON.");
  }
  if (!parsed || typeof parsed !== "object") throw new Error("Invalid pickle file.");
  const p = parsed as Record<string, unknown>;
  if (p.pickleVersion !== 1) throw new Error("Unsupported pickle version.");
  if (p.type !== "version" && p.type !== "project") throw new Error("Unknown pickle type.");
  const project = p.project as Record<string, unknown>;
  if (!project) throw new Error("Missing project info.");

  const toStats = (v: unknown): VersionStats => {
    const vd = v as Record<string, unknown>;
    return {
      name: String(vd.name ?? ""),
      tableCount: Array.isArray(vd.tables) ? vd.tables.length : 0,
      fieldCount: Array.isArray(vd.fields) ? vd.fields.length : 0,
      relationCount: Array.isArray(vd.relations) ? vd.relations.length : 0,
      enumCount: Array.isArray(vd.enums) ? vd.enums.length : 0,
    };
  };

  const versions: VersionStats[] =
    p.type === "version"
      ? [toStats(p.version)]
      : Array.isArray(p.versions)
        ? (p.versions as unknown[]).map(toStats)
        : [];

  return {
    type: p.type as "version" | "project",
    exportedAt: String(p.exportedAt ?? ""),
    sourceProjectName: String(project.name ?? ""),
    provider: String(project.provider ?? ""),
    versionCount: versions.length,
    versions,
  };
}
