import { api, PROJECT_NAME, VERSION } from "../../client";

type RelationDef = {
  modelName: string;        // source model (has the FK)
  name: string;             // field name on source
  targetModel: string;
  backReferenceName: string;
  fields: string[];         // FK field names — auto-created if missing
  references: string[];
  nullable?: boolean;
  onDelete?: string;
};

// FK fields are auto-created by the relations workflow.
// Do NOT add authorId, userId, postId, categoryId, mediaId in phase-3-fields.ts.
const RELATIONS: RelationDef[] = [
  {
    modelName: "Post",
    name: "author",
    targetModel: "User",
    backReferenceName: "posts",
    fields: ["authorId"],
    references: ["id"],
    onDelete: "Cascade",
  },
  {
    modelName: "Comment",
    name: "author",
    targetModel: "User",
    backReferenceName: "comments",
    fields: ["userId"],
    references: ["id"],
    onDelete: "Cascade",
  },
  {
    modelName: "Comment",
    name: "post",
    targetModel: "Post",
    backReferenceName: "comments",
    fields: ["postId"],
    references: ["id"],
    onDelete: "Cascade",
  },
  {
    modelName: "Post",
    name: "category",
    targetModel: "Category",
    backReferenceName: "posts",
    fields: ["categoryId"],
    references: ["id"],
    nullable: true,
    onDelete: "SetNull",
  },
  {
    modelName: "Post",
    name: "featuredImage",
    targetModel: "Media",
    backReferenceName: "posts",
    fields: ["mediaId"],
    references: ["id"],
    nullable: true,
    onDelete: "SetNull",
  },
];

export async function addRelations() {
  for (const rel of RELATIONS) {
    const existing = await api.relations.list({
      projectName: PROJECT_NAME,
      version: VERSION,
      modelName: rel.modelName,
    });
    const alreadyExists = existing?.relations.some((r) => r.name === rel.name);
    if (alreadyExists) {
      console.log(`  ✓ ${rel.modelName}.${rel.name} → ${rel.targetModel} already exists — skipping.`);
      continue;
    }

    await api.relations.create({
      projectName: PROJECT_NAME,
      version: VERSION,
      modelName: rel.modelName,
      name: rel.name,
      targetModel: rel.targetModel,
      backReferenceName: rel.backReferenceName,
      fields: rel.fields,
      references: rel.references,
      onDelete: rel.onDelete ?? "",
      onUpdate: "",
      nullable: rel.nullable ?? false,
      isArray: false,
      backReferenceIsArray: true,
    });

    console.log(`  ✓ ${rel.modelName}.${rel.name} → ${rel.targetModel} (FK: ${rel.fields.join(", ")})`);
  }
}
