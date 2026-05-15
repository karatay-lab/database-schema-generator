import { pg } from "../../_helpers";
import type { MockTableDef } from "../../types";

const order: MockTableDef = {
  name: "Order",
  dbName: "orders",
  comment: "Placed purchase — tracks status, totals, and shipping destination",
  sortOrder: 6,
  fields: [
    pg.pk(0),
    pg.fk("customerId", "Customer who placed the order", 1),
    pg.fk("shippingAddressId", "Delivery address UUID", 2),
    pg.varchar("status", 30, "Order lifecycle status: pending | confirmed | shipped | delivered | cancelled", 3),
    pg.decimal("subtotal", 10, 2, "Sum of order items before tax and shipping", 4),
    pg.decimal("shippingCost", 10, 2, "Shipping fee applied at checkout", 5),
    pg.decimal("totalAmount", 10, 2, "Final charged amount including all fees", 6),
    pg.jsonb("metadata", "Carrier tracking info, discount codes, and other contextual data", 7),
    pg.createdAt(8),
    pg.updatedAt(9),
  ],
};

export default order;
