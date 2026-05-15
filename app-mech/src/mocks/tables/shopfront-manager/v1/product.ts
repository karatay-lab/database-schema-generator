import { pg } from "../../_helpers";
import type { MockTableDef } from "../../types";

const product: MockTableDef = {
  name: "Product",
  dbName: "products",
  comment: "Sellable item with pricing, inventory, and storefront metadata",
  sortOrder: 0,
  fields: [
    pg.pk(0),
    pg.varchar("name", 255, "Display name shown in the storefront", 1),
    pg.varchar("slug", 255, "URL-safe unique identifier for the product page", 2),
    pg.text("description", "Long-form product description (supports markdown)", 3),
    pg.decimal("price", 10, 2, "Selling price in the store base currency", 4),
    pg.int("stockQuantity", "Units currently available in inventory", 5, 0),
    pg.bool("isActive", "Whether the product is visible and purchasable", 6, true),
    pg.jsonb("metadata", "Arbitrary additional attributes (dimensions, colour, tags)", 7),
    pg.createdAt(8),
    pg.updatedAt(9),
  ],
};

export default product;
