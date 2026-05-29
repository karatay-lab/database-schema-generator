import { api, PROJECT_NAME, VERSION } from "../../client";

type RestrictionDef = {
  modelName: string;
  type: "UNIQUE" | "INDEX";
  fields: string[];
  dbName?: string;
};

const RESTRICTIONS: RestrictionDef[] = [
  { modelName: "User",    type: "INDEX",  fields: ["name"],      dbName: "idx_user_name" },
  { modelName: "Post",    type: "UNIQUE", fields: ["slug"],      dbName: "uq_post_slug" },
  { modelName: "Post",    type: "INDEX",  fields: ["published"], dbName: "idx_post_published" },
  { modelName: "Category",type: "UNIQUE", fields: ["slug"],      dbName: "uq_category_slug" },
  { modelName: "Tag",     type: "UNIQUE", fields: ["name"],      dbName: "uq_tag_name" },
  { modelName: "Comment", type: "INDEX",  fields: ["createdAt"], dbName: "idx_comment_created_at" },
];

export async function addRestrictions() {
  for (const r of RESTRICTIONS) {
    const existing = await api.restrictions.list({
      projectName: PROJECT_NAME,
      version: VERSION,
      modelName: r.modelName,
    });
    const alreadyExists = existing?.restrictions.some(
      (ex) => ex.type === r.type && ex.fields.join(",") === r.fields.join(","),
    );
    if (alreadyExists) {
      console.log(`  ✓ ${r.modelName} @@${r.type.toLowerCase()}([${r.fields}]) already exists — skipping.`);
      continue;
    }

    await api.restrictions.create({
      projectName: PROJECT_NAME,
      version: VERSION,
      modelName: r.modelName,
      type: r.type,
      fields: r.fields,
      dbName: r.dbName ?? "",
    });

    console.log(`  ✓ ${r.modelName} @@${r.type.toLowerCase()}([${r.fields.join(", ")}])`);
  }
}
