import { api, PROJECT_NAME } from "../../client";

export async function setupEnums(version: string) {
  const existing = await api.enums.list({ projectName: PROJECT_NAME, version });
  const existingNames = new Set(existing?.map((e) => e.name) ?? []);

  // Create OrderStatus enum
  if (!existingNames.has("OrderStatus")) {
    await api.enums.create({ projectName: PROJECT_NAME, version, name: "OrderStatus" });
    console.log("  ✓ Created enum OrderStatus");
  } else {
    console.log("  ✓ Enum OrderStatus already exists — skipping.");
  }

  const enumsAfter = await api.enums.list({ projectName: PROJECT_NAME, version });
  const orderStatus = enumsAfter?.find((e) => e.name === "OrderStatus");
  const existingValues = new Set(orderStatus?.values.map((v) => v.name) ?? []);

  const values = ["PENDING", "CONFIRMED", "SHIPPED", "DELIVERED", "CANCELLED"];
  for (const val of values) {
    if (existingValues.has(val)) {
      console.log(`  ✓ OrderStatus.${val} already exists — skipping.`);
      continue;
    }
    await api.enums.addValue({ projectName: PROJECT_NAME, version, enumName: "OrderStatus", value: val });
    console.log(`  ✓ OrderStatus.${val}`);
  }

  // Bind Order.status → OrderStatus enum
  const orderFields = await api.fields.list({ projectName: PROJECT_NAME, version, modelName: "Order" });
  const statusField = orderFields?.fields.find((f) => f.name === "status");
  if (statusField && statusField.type !== "OrderStatus") {
    await api.fields.update({
      projectName: PROJECT_NAME, version, modelName: "Order",
      oldFieldName: "status", name: "status",
      type: "OrderStatus", nullable: false, unique: false,
      defaultValue: "", comment: "", updatedAtAttribute: false, isId: false,
    });
    console.log("  ✓ Order.status  String → OrderStatus");
  } else if (statusField?.type === "OrderStatus") {
    console.log("  ✓ Order.status already bound to OrderStatus — skipping.");
  }
}
