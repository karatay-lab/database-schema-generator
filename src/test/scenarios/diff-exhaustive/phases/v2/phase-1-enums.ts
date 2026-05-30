import { api, PROJECT_NAME } from "../../client";

// Enum mutations that exercise every enum diff path:
//   OrderStatus: remove CANCELLED (values_changed, breaking) + add REFUNDED (values_changed, warning)
//   UserRole: add SUPERADMIN (values_changed, warning — only additions, no removals)
//   Priority: remove LOW + MEDIUM (values_changed, breaking)
//   TicketType: delete entire enum (removed, breaking)
//   SupportTier: brand new enum (added, info)

export async function mutateEnums(version: string) {
  const enums = await api.enums.list({ projectName: PROJECT_NAME, version });
  const byName = new Map(enums?.map((e) => [e.name, e]) ?? []);

  // ─── OrderStatus: remove CANCELLED, add REFUNDED ─────────────────────────
  const orderStatus = byName.get("OrderStatus");
  if (orderStatus) {
    const cancelledValue = orderStatus.values.find((v) => v.name === "CANCELLED");
    if (cancelledValue) {
      await api.enums.deleteValue({
        projectName: PROJECT_NAME, version, enumName: "OrderStatus", valueId: cancelledValue.valueId,
      });
      console.log("  ✓ OrderStatus: removed CANCELLED");
    } else {
      console.log("  ✓ OrderStatus.CANCELLED already removed — skipping.");
    }

    const refreshed = await api.enums.list({ projectName: PROJECT_NAME, version });
    const orderStatusRefreshed = refreshed?.find((e) => e.name === "OrderStatus");
    if (!orderStatusRefreshed?.values.find((v) => v.name === "REFUNDED")) {
      await api.enums.addValue({ projectName: PROJECT_NAME, version, enumName: "OrderStatus", value: "REFUNDED" });
      console.log("  ✓ OrderStatus: added REFUNDED");
    } else {
      console.log("  ✓ OrderStatus.REFUNDED already exists — skipping.");
    }
  } else {
    console.log("  ✗ OrderStatus not found — skipping mutations.");
  }

  // ─── UserRole: add SUPERADMIN ─────────────────────────────────────────────
  const userRole = byName.get("UserRole");
  if (userRole) {
    if (!userRole.values.find((v) => v.name === "SUPERADMIN")) {
      await api.enums.addValue({ projectName: PROJECT_NAME, version, enumName: "UserRole", value: "SUPERADMIN" });
      console.log("  ✓ UserRole: added SUPERADMIN");
    } else {
      console.log("  ✓ UserRole.SUPERADMIN already exists — skipping.");
    }
  } else {
    console.log("  ✗ UserRole not found — skipping.");
  }

  // ─── Priority: remove LOW and MEDIUM ─────────────────────────────────────
  const refreshedAll = await api.enums.list({ projectName: PROJECT_NAME, version });
  const priority = refreshedAll?.find((e) => e.name === "Priority");
  if (priority) {
    for (const removeName of ["LOW", "MEDIUM"]) {
      const val = priority.values.find((v) => v.name === removeName);
      if (val) {
        await api.enums.deleteValue({
          projectName: PROJECT_NAME, version, enumName: "Priority", valueId: val.valueId,
        });
        console.log(`  ✓ Priority: removed ${removeName}`);
      } else {
        console.log(`  ✓ Priority.${removeName} already removed — skipping.`);
      }
    }
  } else {
    console.log("  ✗ Priority not found — skipping.");
  }

  // ─── TicketType: delete entire enum ──────────────────────────────────────
  const afterPriority = await api.enums.list({ projectName: PROJECT_NAME, version });
  if (afterPriority?.find((e) => e.name === "TicketType")) {
    await api.enums.delete({ projectName: PROJECT_NAME, version, name: "TicketType" });
    console.log("  ✓ Deleted enum TicketType");
  } else {
    console.log("  ✓ TicketType already deleted — skipping.");
  }

  // ─── SupportTier: brand new enum ─────────────────────────────────────────
  const afterDelete = await api.enums.list({ projectName: PROJECT_NAME, version });
  if (!afterDelete?.find((e) => e.name === "SupportTier")) {
    await api.enums.create({ projectName: PROJECT_NAME, version, name: "SupportTier" });
    console.log("  ✓ Created enum SupportTier");
  } else {
    console.log("  ✓ SupportTier already exists — skipping.");
  }

  for (const val of ["BASIC", "PRO", "ENTERPRISE"]) {
    const latest = await api.enums.list({ projectName: PROJECT_NAME, version });
    const supportTier = latest?.find((e) => e.name === "SupportTier");
    if (!supportTier?.values.find((v) => v.name === val)) {
      await api.enums.addValue({ projectName: PROJECT_NAME, version, enumName: "SupportTier", value: val });
      console.log(`  ✓ SupportTier: added ${val}`);
    } else {
      console.log(`  ✓ SupportTier.${val} already exists — skipping.`);
    }
  }
}
