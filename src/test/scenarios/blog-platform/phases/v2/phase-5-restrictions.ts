import { api, PROJECT_NAME } from "../../client";

type RestrictionDef = {
  modelName: string; type: "UNIQUE" | "INDEX"; fields: string[]; dbName?: string;
};

const RESTRICTIONS: RestrictionDef[] = [
  { modelName: "Profile", type: "UNIQUE", fields: ["userId"],           dbName: "uq_profile_user_id" },
  { modelName: "Like",    type: "UNIQUE", fields: ["userId", "postId"], dbName: "uq_like_user_post" },
  { modelName: "Like",    type: "INDEX",  fields: ["postId"],           dbName: "idx_like_post_id" },
];

export async function addRestrictions(version: string) {
  for (const r of RESTRICTIONS) {
    const existing = await api.restrictions.list({ projectName: PROJECT_NAME, version, modelName: r.modelName });
    const alreadyExists = existing?.restrictions.some(
      (ex) => ex.type === r.type && ex.fields.join(",") === r.fields.join(","),
    );
    if (alreadyExists) {
      console.log(`  ✓ ${r.modelName} @@${r.type.toLowerCase()}([${r.fields}]) already exists — skipping.`);
      continue;
    }
    await api.restrictions.create({
      projectName: PROJECT_NAME, version, modelName: r.modelName,
      type: r.type, fields: r.fields, dbName: r.dbName ?? "",
    });
    console.log(`  ✓ ${r.modelName} @@${r.type.toLowerCase()}([${r.fields.join(", ")}])`);
  }
}
