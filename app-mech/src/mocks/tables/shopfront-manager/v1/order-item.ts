import { pg } from "../../_helpers";
import type { MockTableDef } from "../../types";

const orderItem: MockTableDef = {
  name: "OrderItem",
  dbName: "order_items",
  comment: "Immutable product line snapshot inside a placed order",
  sortOrder: 7,
  fields: [
    pg.pk(0),
    pg.fk("orderId", "Owning order UUID", 1),
    pg.fk("productId", "Referenced product UUID at time of purchase", 2),
    pg.varchar("productName", 255, "Product name captured at purchase time (immutable snapshot)", 3),
    pg.int("quantity", "Units purchased", 4, 1),
    pg.decimal("unitPrice", 10, 2, "Price per unit at time of purchase", 5),
    pg.decimal("totalPrice", 10, 2, "quantity × unitPrice", 6),
    pg.createdAt(7),
  ],
};

export default orderItem;
