import { api, PROJECT_NAME } from "../../client";

async function fieldNames(version: string, modelName: string): Promise<Set<string>> {
  const res = await api.fields.list({ projectName: PROJECT_NAME, version, modelName });
  return new Set(res?.fields.map((f) => f.name) ?? []);
}

export async function updateFields(version: string) {
  // ─── Deletions ─────────────────────────────────────────────────────────────

  // estimatedHours (String?) deleted — data dropped; replaced by separate additions below
  const taskNames = await fieldNames(version, "Task");
  if (taskNames.has("estimatedHours")) {
    await api.fields.delete({ projectName: PROJECT_NAME, version, modelName: "Task", fieldName: "estimatedHours" });
    console.log("  ✓ Deleted Task.estimatedHours");
  } else {
    console.log("  ✓ Task.estimatedHours already removed — skipping.");
  }

  // ─── Renames ───────────────────────────────────────────────────────────────

  // Comment.body → Comment.content (stable fieldId rename, no data loss)
  const commentNames = await fieldNames(version, "Comment");
  if (commentNames.has("body") && !commentNames.has("content")) {
    await api.fields.update({
      projectName: PROJECT_NAME, version, modelName: "Comment",
      oldFieldName: "body", name: "content", type: "String",
      nullable: false, unique: false, defaultValue: "", comment: "",
    });
    console.log("  ✓ Renamed Comment.body → Comment.content");
  } else if (commentNames.has("content")) {
    console.log("  ✓ Comment.content already exists — skipping rename.");
  }

  // ─── Nullable → required (Stage 2 error triggers) ─────────────────────────

  // User.score Int? → Int required (no default)
  // Seeded data has score=null for rows [1] (Bob Smith) and [3] (Dave Lee)
  // → z.number().int().safeParse(null) fails → Stage 2 Zod ERROR
  const userNames = await fieldNames(version, "User");
  if (userNames.has("score")) {
    const userFields = await api.fields.list({ projectName: PROJECT_NAME, version, modelName: "User" });
    const scoreField = userFields?.fields.find((f) => f.name === "score");
    if (scoreField?.nullable) {
      await api.fields.update({
        projectName: PROJECT_NAME, version, modelName: "User",
        oldFieldName: "score", name: "score", type: "Int",
        nullable: false, unique: false, defaultValue: "", comment: "",
      });
      console.log("  ✓ User.score → required Int (intentional Stage 2 error for null rows)");
    } else {
      console.log("  ✓ User.score already required — skipping.");
    }
  }

  // Comment.rating Int? → Int required (no default)
  // Seeded data has rating=null for rows [0], [2], [4], [6] (comments 1,3,5,7)
  // → z.number().int().safeParse(null) fails → Stage 2 Zod ERROR
  const commentNamesRefresh = await fieldNames(version, "Comment");
  if (commentNamesRefresh.has("rating")) {
    const commentFields = await api.fields.list({ projectName: PROJECT_NAME, version, modelName: "Comment" });
    const ratingField = commentFields?.fields.find((f) => f.name === "rating");
    if (ratingField?.nullable) {
      await api.fields.update({
        projectName: PROJECT_NAME, version, modelName: "Comment",
        oldFieldName: "rating", name: "rating", type: "Int",
        nullable: false, unique: false, defaultValue: "", comment: "",
      });
      console.log("  ✓ Comment.rating → required Int (intentional Stage 2 error for null rows)");
    } else {
      console.log("  ✓ Comment.rating already required — skipping.");
    }
  }

  // ─── Additions ─────────────────────────────────────────────────────────────

  type FieldAdd = {
    modelName: string; name: string; type: string;
    nullable?: boolean; defaultValue?: string; updatedAtAttribute?: boolean;
  };

  const additions: FieldAdd[] = [
    // User
    { modelName: "User",   name: "avatarUrl",        type: "String",   nullable: true },
    // Task
    { modelName: "Task",   name: "storyPoints",      type: "Int",      nullable: true },
    { modelName: "Task",   name: "estimatedMinutes",  type: "Int",      nullable: true },
    // Sprint
    { modelName: "Sprint", name: "name",             type: "String" },
    { modelName: "Sprint", name: "goal",             type: "String",   nullable: true },
    { modelName: "Sprint", name: "startDate",        type: "DateTime", nullable: true },
    { modelName: "Sprint", name: "endDate",          type: "DateTime", nullable: true },
    { modelName: "Sprint", name: "createdAt",        type: "DateTime", defaultValue: "now()" },
  ];

  for (const f of additions) {
    const names = await fieldNames(version, f.modelName);
    if (names.has(f.name)) {
      console.log(`  ✓ ${f.modelName}.${f.name} already exists — skipping.`);
      continue;
    }
    await api.fields.create({
      projectName: PROJECT_NAME, version, modelName: f.modelName,
      name: f.name, type: f.type,
      nullable: f.nullable ?? false, unique: false,
      defaultValue: f.defaultValue ?? "", comment: "",
      updatedAtAttribute: f.updatedAtAttribute ?? false, isId: false,
    });
    console.log(`  ✓ Added ${f.modelName}.${f.name} (${f.type}${f.nullable ? "?" : ""})`);
  }
}
