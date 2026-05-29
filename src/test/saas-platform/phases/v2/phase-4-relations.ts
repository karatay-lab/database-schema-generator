import { api, PROJECT_NAME } from "../../client";

type RelDef = {
  modelName: string; name: string; targetModel: string; backReferenceName: string;
  fields: string[]; references: string[];
  nullable?: boolean; onDelete?: string; backReferenceIsArray?: boolean;
};

export async function addRelations(version: string) {

  const RELATIONS: RelDef[] = [
    // Sprint belongs to Space (renamed Workspace)
    {
      modelName: "Sprint", name: "space", targetModel: "Space",
      backReferenceName: "sprints", fields: ["spaceId"], references: ["id"],
      onDelete: "Cascade",
    },
    // Sprint has optional creator (User)
    {
      modelName: "Sprint", name: "createdBy", targetModel: "User",
      backReferenceName: "createdSprints", fields: ["createdById"], references: ["id"],
      nullable: true, onDelete: "SetNull",
    },
    // Task optionally belongs to a Sprint
    {
      modelName: "Task", name: "sprint", targetModel: "Sprint",
      backReferenceName: "tasks", fields: ["sprintId"], references: ["id"],
      nullable: true, onDelete: "SetNull",
    },
  ];

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
      backReferenceIsArray: rel.backReferenceIsArray ?? true,
    });

    console.log(`  ✓ ${rel.modelName}.${rel.name} → ${rel.targetModel} (FK: ${rel.fields.join(", ")})`);
  }
}
