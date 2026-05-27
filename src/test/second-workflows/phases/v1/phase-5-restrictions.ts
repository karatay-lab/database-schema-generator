import { api, PROJECT_NAME, VERSION } from "../../client";

type RestrictionDef = {
  modelName: string; type: "UNIQUE" | "INDEX"; fields: string[]; dbName?: string;
};

const RESTRICTIONS: RestrictionDef[] = [
  { modelName: "Organization", type: "UNIQUE", fields: ["slug"],     dbName: "uq_org_slug" },
  { modelName: "User",         type: "UNIQUE", fields: ["email"],    dbName: "uq_user_email" },
  { modelName: "User",         type: "INDEX",  fields: ["orgId"],    dbName: "idx_user_org_id" },
  { modelName: "Project",      type: "INDEX",  fields: ["status"],   dbName: "idx_project_status" },
  { modelName: "Task",         type: "INDEX",  fields: ["priority"], dbName: "idx_task_priority" },
  { modelName: "Task",         type: "INDEX",  fields: ["dueDate"],  dbName: "idx_task_due_date" },
];

export async function addRestrictions() {
  for (const r of RESTRICTIONS) {
    const existing = await api.restrictions.list({
      projectName: PROJECT_NAME, version: VERSION, modelName: r.modelName,
    });
    const alreadyExists = existing?.restrictions.some(
      (ex) => ex.type === r.type && ex.fields.join(",") === r.fields.join(","),
    );
    if (alreadyExists) {
      console.log(`  ✓ ${r.modelName} @@${r.type.toLowerCase()}([${r.fields}]) already exists — skipping.`);
      continue;
    }

    await api.restrictions.create({
      projectName: PROJECT_NAME, version: VERSION,
      modelName: r.modelName, type: r.type,
      fields: r.fields, dbName: r.dbName ?? "",
    });

    console.log(`  ✓ ${r.modelName} @@${r.type.toLowerCase()}([${r.fields.join(", ")}])`);
  }
}
