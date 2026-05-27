import { api, PROJECT_NAME, VERSION as V1_VERSION } from "../../client";

export async function forkToV2(): Promise<string> {
  const projects = await api.projects.list();
  const project = projects.find((p) => p.name === PROJECT_NAME);
  if (!project) throw new Error(`Project "${PROJECT_NAME}" not found — run v1 phases first.`);

  const v1Idx = project.versions.findIndex((v) => v.name === V1_VERSION);
  if (v1Idx === -1) throw new Error(`V1 version "${V1_VERSION}" not found — run v1 phases first.`);

  const versionsAfterV1 = project.versions.slice(v1Idx + 1);
  if (versionsAfterV1.length > 0) {
    const v2 = versionsAfterV1[0].name;
    console.log(`  ✓ V2 already forked: ${v2} — skipping.`);
    return v2;
  }

  const result = await api.projects.forkVersion({ projectId: project.id });
  console.log(`  ✓ Forked ${V1_VERSION} → ${result.newVersion}`);
  return result.newVersion;
}
