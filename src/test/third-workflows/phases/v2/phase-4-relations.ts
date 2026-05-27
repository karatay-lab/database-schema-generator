import { api, PROJECT_NAME } from "../../client";

type RelDef = {
  modelName: string; name: string; targetModel: string; backReferenceName: string;
  fields: string[]; references: string[];
  nullable?: boolean; onDelete?: string;
};

// New relations for the Review table (added in v2).
const RELATIONS: RelDef[] = [
  {
    modelName: "Review", name: "customer", targetModel: "Customer",
    backReferenceName: "reviews", fields: ["customerId"], references: ["id"],
    onDelete: "Cascade",
  },
  {
    modelName: "Review", name: "product", targetModel: "Product",
    backReferenceName: "reviews", fields: ["productId"], references: ["id"],
    onDelete: "Cascade",
  },
];

export async function addRelations(version: string) {
  for (const rel of RELATIONS) {
    const existing = await api.relations.list({
      projectName: PROJECT_NAME, version, modelName: rel.modelName,
    });
    if (existing?.relations.some((r) => r.name === rel.name)) {
      console.log(`  ✓ ${rel.modelName}.${rel.name} → ${rel.targetModel} already exists — skipping.`);
      continue;
    }

    await api.relations.create({
      projectName: PROJECT_NAME, version,
      modelName: rel.modelName, name: rel.name,
      targetModel: rel.targetModel, backReferenceName: rel.backReferenceName,
      fields: rel.fields, references: rel.references,
      onDelete: rel.onDelete ?? "", onUpdate: "",
      nullable: rel.nullable ?? false,
      isArray: false,
      backReferenceIsArray: true,
    });

    console.log(`  ✓ ${rel.modelName}.${rel.name} → ${rel.targetModel} (FK: ${rel.fields.join(", ")})`);
  }
}
