import { pg } from "../../_helpers";
import type { MockTableDef } from "../../types";

const cart: MockTableDef = {
  name: "Cart",
  dbName: "carts",
  comment: "Active shopping session — holds items before checkout",
  sortOrder: 4,
  fields: [
    pg.pk(0),
    pg.fk("customerId", "Owning customer UUID (null for guest carts)", 1, { nullable: true }),
    pg.varchar("status", 20, "Cart lifecycle state: active | abandoned | converted", 2),
    pg.float("totalAmount", "Running sum of all cart item prices", 3, { nullable: false }),
    pg.timestamp("expiresAt", "Timestamp after which the cart is considered abandoned", 4, { nullable: true }),
    pg.createdAt(5),
    pg.updatedAt(6),
  ],
};

export default cart;
