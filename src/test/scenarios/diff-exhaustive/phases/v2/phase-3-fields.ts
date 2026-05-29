import { api, PROJECT_NAME } from "../../client";

async function fieldList(version: string, modelName: string) {
  const res = await api.fields.list({ projectName: PROJECT_NAME, version, modelName });
  return res?.fields ?? [];
}

async function fieldNames(version: string, modelName: string): Promise<Set<string>> {
  return new Set((await fieldList(version, modelName)).map((f) => f.name));
}

// Customer field mutations — each triggers a distinct field diff changeKind:
//
//   name       String req  → renamed fullName + type Float   (multiple: rename+type, warning)
//   notes      String?     → renamed description             (renamed, warning)
//   score      Int @default(0) req → remove default           (default_changed, warning)
//   tier       String req  → type Int                        (type_changed, warning)
//   legacyCode String?     → deleted                         (removed, warning → ghost card)
//   bonus      Int req     → made optional                   (nullability_changed, info)
//   rating     (added)     Int req no default                (added, warning — backfill needed)
//
// NewTable gets minimal fields so it has content in the app.

export async function mutateFields(version: string) {
  // ─── Customer: rename notes → description ────────────────────────────────
  const customerNames = await fieldNames(version, "Customer");

  if (customerNames.has("notes") && !customerNames.has("description")) {
    await api.fields.update({
      projectName: PROJECT_NAME, version, modelName: "Customer",
      oldFieldName: "notes", name: "description", type: "String",
      nullable: true, unique: false, defaultValue: "", comment: "",
    });
    console.log("  ✓ Customer.notes → description (renamed)");
  } else if (customerNames.has("description")) {
    console.log("  ✓ Customer.description already renamed — skipping.");
  }

  // ─── Customer: rename name → fullName AND type String → Float ────────────
  const customerNames2 = await fieldNames(version, "Customer");

  if (customerNames2.has("name") && !customerNames2.has("fullName")) {
    await api.fields.update({
      projectName: PROJECT_NAME, version, modelName: "Customer",
      oldFieldName: "name", name: "fullName", type: "Float",
      nullable: false, unique: false, defaultValue: "", comment: "",
    });
    console.log("  ✓ Customer.name → fullName (String → Float, multiple)");
  } else if (customerNames2.has("fullName")) {
    console.log("  ✓ Customer.fullName already updated — skipping.");
  }

  // ─── Customer: remove score default (keep required) ───────────────────────
  const customerFields3 = await fieldList(version, "Customer");
  const scoreField = customerFields3.find((f) => f.name === "score");
  if (scoreField && scoreField.defaultValue !== "") {
    await api.fields.update({
      projectName: PROJECT_NAME, version, modelName: "Customer",
      oldFieldName: "score", name: "score", type: "Int",
      nullable: false, unique: false, defaultValue: "", comment: "",
    });
    console.log("  ✓ Customer.score: default removed (default_changed)");
  } else if (scoreField?.defaultValue === "") {
    console.log("  ✓ Customer.score default already removed — skipping.");
  }

  // ─── Customer: tier String → Int ─────────────────────────────────────────
  const customerFields4 = await fieldList(version, "Customer");
  const tierField = customerFields4.find((f) => f.name === "tier");
  if (tierField && tierField.type !== "Int") {
    await api.fields.update({
      projectName: PROJECT_NAME, version, modelName: "Customer",
      oldFieldName: "tier", name: "tier", type: "Int",
      nullable: false, unique: false, defaultValue: "", comment: "",
    });
    console.log("  ✓ Customer.tier: String → Int (type_changed)");
  } else if (tierField?.type === "Int") {
    console.log("  ✓ Customer.tier already Int — skipping.");
  }

  // ─── Customer: delete legacyCode ─────────────────────────────────────────
  const customerNames5 = await fieldNames(version, "Customer");
  if (customerNames5.has("legacyCode")) {
    await api.fields.delete({ projectName: PROJECT_NAME, version, modelName: "Customer", fieldName: "legacyCode" });
    console.log("  ✓ Deleted Customer.legacyCode (removed → ghost card)");
  } else {
    console.log("  ✓ Customer.legacyCode already removed — skipping.");
  }

  // ─── Customer: bonus Int required → optional ─────────────────────────────
  const customerFields6 = await fieldList(version, "Customer");
  const bonusField = customerFields6.find((f) => f.name === "bonus");
  if (bonusField && !bonusField.nullable) {
    await api.fields.update({
      projectName: PROJECT_NAME, version, modelName: "Customer",
      oldFieldName: "bonus", name: "bonus", type: "Int",
      nullable: true, unique: false, defaultValue: "", comment: "",
    });
    console.log("  ✓ Customer.bonus: required → optional (nullability_changed, info)");
  } else if (bonusField?.nullable) {
    console.log("  ✓ Customer.bonus already optional — skipping.");
  }

  // ─── Customer: add rating Int required no default ─────────────────────────
  const customerNames7 = await fieldNames(version, "Customer");
  if (!customerNames7.has("rating")) {
    await api.fields.create({
      projectName: PROJECT_NAME, version, modelName: "Customer",
      name: "rating", type: "Int",
      nullable: false, unique: false, defaultValue: "", comment: "",
      updatedAtAttribute: false, isId: false,
    });
    console.log("  ✓ Added Customer.rating (Int required, no default → backfill warning)");
  } else {
    console.log("  ✓ Customer.rating already exists — skipping.");
  }

  // ─── NewTable: add minimal fields ─────────────────────────────────────────
  const newTableNames = await fieldNames(version, "NewTable");
  const newTableFields = [
    { name: "label", type: "String", nullable: false },
    { name: "createdAt", type: "DateTime", nullable: false, defaultValue: "now()" },
  ];

  for (const f of newTableFields) {
    if (!newTableNames.has(f.name)) {
      await api.fields.create({
        projectName: PROJECT_NAME, version, modelName: "NewTable",
        name: f.name, type: f.type,
        nullable: f.nullable, unique: false,
        defaultValue: f.defaultValue ?? "", comment: "",
        updatedAtAttribute: false, isId: false,
      });
      console.log(`  ✓ Added NewTable.${f.name}`);
    } else {
      console.log(`  ✓ NewTable.${f.name} already exists — skipping.`);
    }
  }
}
