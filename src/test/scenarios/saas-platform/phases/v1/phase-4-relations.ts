import { api, PROJECT_NAME, VERSION } from "../../client";

type RelDef = {
  modelName: string; name: string; targetModel: string; backReferenceName: string;
  fields: string[]; references: string[];
  nullable?: boolean; onDelete?: string; backReferenceIsArray?: boolean;
};

// FK fields listed here are auto-created by the relations workflow.
const RELATIONS: RelDef[] = [
  // User belongs to Organization
  {
    modelName: "User", name: "organization", targetModel: "Organization",
    backReferenceName: "users", fields: ["orgId"], references: ["id"],
    onDelete: "Cascade",
  },
  // Workspace belongs to Organization
  {
    modelName: "Workspace", name: "organization", targetModel: "Organization",
    backReferenceName: "workspaces", fields: ["orgId"], references: ["id"],
    onDelete: "Cascade",
  },
  // Project belongs to Workspace
  {
    modelName: "Project", name: "workspace", targetModel: "Workspace",
    backReferenceName: "projects", fields: ["workspaceId"], references: ["id"],
    onDelete: "Cascade",
  },
  // Task belongs to Project
  {
    modelName: "Task", name: "project", targetModel: "Project",
    backReferenceName: "tasks", fields: ["projectId"], references: ["id"],
    onDelete: "Cascade",
  },
  // Task has optional assignee (User)
  {
    modelName: "Task", name: "assignee", targetModel: "User",
    backReferenceName: "assignedTasks", fields: ["assigneeId"], references: ["id"],
    nullable: true, onDelete: "SetNull",
  },
  // Comment belongs to Task
  {
    modelName: "Comment", name: "task", targetModel: "Task",
    backReferenceName: "comments", fields: ["taskId"], references: ["id"],
    onDelete: "Cascade",
  },
  // Comment has an author (User)
  {
    modelName: "Comment", name: "author", targetModel: "User",
    backReferenceName: "comments", fields: ["authorId"], references: ["id"],
    onDelete: "Cascade",
  },
  // Attachment belongs to Task
  {
    modelName: "Attachment", name: "task", targetModel: "Task",
    backReferenceName: "attachments", fields: ["taskId"], references: ["id"],
    onDelete: "Cascade",
  },
];

export async function addRelations() {
  for (const rel of RELATIONS) {
    const existing = await api.relations.list({
      projectName: PROJECT_NAME, version: VERSION, modelName: rel.modelName,
    });
    if (existing?.relations.some((r) => r.name === rel.name)) {
      console.log(`  ✓ ${rel.modelName}.${rel.name} → ${rel.targetModel} already exists — skipping.`);
      continue;
    }

    await api.relations.create({
      projectName: PROJECT_NAME, version: VERSION,
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
