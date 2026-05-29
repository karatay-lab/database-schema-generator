import { api, PROJECT_NAME } from "../../client";

type RestrictionDef = {
  modelName: string; type: "UNIQUE" | "INDEX"; fields: string[]; dbName?: string;
};

// spaceId is auto-created by Sprint.space → Space relation (phase 4).
// projectId exists from Task.project → Project relation (v1 phase 4).
const RESTRICTIONS: RestrictionDef[] = [
  { modelName: "Sprint", type: "UNIQUE", fields: ["name", "spaceId"],       dbName: "uq_sprint_name_space" },
  { modelName: "Task",   type: "UNIQUE", fields: ["projectId", "title"],    dbName: "uq_task_project_title" },
];

export async function addRestrictions(version: string) {
  for (const r of RESTRICTIONS) {
    const existing = await api.restrictions.list({
      projectName: PROJECT_NAME, version, modelName: r.modelName,
    });
    const alreadyExists = existing?.restrictions.some(
      (ex) => ex.type === r.type && ex.fields.join(",") === r.fields.join(","),
    );
    if (alreadyExists) {
      console.log(`  ✓ ${r.modelName} @@${r.type.toLowerCase()}([${r.fields}]) already exists — skipping.`);
      continue;
    }

    await api.restrictions.create({
      projectName: PROJECT_NAME, version,
      modelName: r.modelName, type: r.type,
      fields: r.fields, dbName: r.dbName ?? "",
    });

    console.log(`  ✓ ${r.modelName} @@${r.type.toLowerCase()}([${r.fields.join(", ")}])`);
  }
}
