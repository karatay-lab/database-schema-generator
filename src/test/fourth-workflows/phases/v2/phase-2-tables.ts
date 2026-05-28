import { api, PROJECT_NAME } from "../../client";

// Table mutations that exercise every table diff path:
//   LegacyLog deleted          → removed, breaking
//   Coupon → Discount (pure rename, PK unchanged)  → renamed, warning
//   Product.id → Product.uid (type unchanged Int)  → changed (PK field rename), info
//   Invoice.id Int → Uuid      → changed (PK type), breaking
//   NewTable added             → added, info

export async function mutateTables(version: string) {
  const current = await api.tables.list({ projectName: PROJECT_NAME, version });
  const byName = new Map(current?.map((t) => [t.name, t]) ?? []);

  // ─── Delete LegacyLog ────────────────────────────────────────────────────
  if (byName.has("LegacyLog")) {
    await api.tables.delete({ projectName: PROJECT_NAME, version, modelName: "LegacyLog" });
    console.log("  ✓ Deleted table LegacyLog");
  } else {
    console.log("  ✓ LegacyLog already deleted — skipping.");
  }

  // ─── Rename Coupon → Discount (PK stays id Int) ──────────────────────────
  const refreshed1 = await api.tables.list({ projectName: PROJECT_NAME, version });
  const byName1 = new Map(refreshed1?.map((t) => [t.name, t]) ?? []);

  if (byName1.has("Coupon") && !byName1.has("Discount")) {
    const coupon = byName1.get("Coupon")!;
    await api.tables.update({
      projectName: PROJECT_NAME, version,
      oldModelName: "Coupon", newModelName: "Discount",
      pkName: coupon.pkName, pkType: "Int",
    });
    console.log("  ✓ Renamed Coupon → Discount (PK unchanged)");
  } else if (byName1.has("Discount")) {
    console.log("  ✓ Table already renamed to Discount — skipping.");
  }

  // ─── Rename Product PK field id → uid (type unchanged Int) ───────────────
  const refreshed2 = await api.tables.list({ projectName: PROJECT_NAME, version });
  const byName2 = new Map(refreshed2?.map((t) => [t.name, t]) ?? []);

  const product = byName2.get("Product");
  if (product && product.pkName !== "uid") {
    await api.tables.update({
      projectName: PROJECT_NAME, version,
      oldModelName: "Product", newModelName: "Product",
      pkName: "uid", pkType: "Int",
    });
    console.log("  ✓ Product PK field renamed id → uid (type Int unchanged)");
  } else if (product?.pkName === "uid") {
    console.log("  ✓ Product.uid already renamed — skipping.");
  }

  // ─── Invoice PK type Int → Uuid ──────────────────────────────────────────
  const refreshed3 = await api.tables.list({ projectName: PROJECT_NAME, version });
  const byName3 = new Map(refreshed3?.map((t) => [t.name, t]) ?? []);

  const invoice = byName3.get("Invoice");
  if (invoice && invoice.pkType !== "Uuid") {
    await api.tables.update({
      projectName: PROJECT_NAME, version,
      oldModelName: "Invoice", newModelName: "Invoice",
      pkName: invoice.pkName, pkType: "Uuid",
    });
    console.log("  ✓ Invoice.id Int → Uuid");
  } else if (invoice?.pkType === "Uuid") {
    console.log("  ✓ Invoice PK already Uuid — skipping.");
  }

  // ─── Add NewTable ─────────────────────────────────────────────────────────
  const refreshed4 = await api.tables.list({ projectName: PROJECT_NAME, version });
  const names4 = new Set(refreshed4?.map((t) => t.name) ?? []);

  if (!names4.has("NewTable")) {
    await api.tables.create({
      projectName: PROJECT_NAME, version,
      modelName: "NewTable", pkName: "id", pkType: "Int",
    });
    console.log("  ✓ Created table NewTable (PK id Int)");
  } else {
    console.log("  ✓ NewTable already exists — skipping.");
  }
}
