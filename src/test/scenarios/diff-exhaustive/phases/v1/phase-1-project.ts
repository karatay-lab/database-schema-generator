import { api, PROJECT_NAME, PROVIDER, SCHEMA_OPTIONS } from "../../client";

export async function createProject() {
  console.log(`  Creating project "${PROJECT_NAME}"...`);

  const existing = await api.projects.list();
  const already = existing.find((p) => p.name === PROJECT_NAME);
  if (already) {
    console.log(`  ✓ Project already exists (id: ${already.id}) — skipping create.`);
    return already;
  }

  const project = await api.projects.create({
    name: PROJECT_NAME,
    provider: PROVIDER,
    schemaOptions: SCHEMA_OPTIONS,
  });

  console.log(`  ✓ Created project id=${project.id} provider=${project.provider}`);
  return project;
}
