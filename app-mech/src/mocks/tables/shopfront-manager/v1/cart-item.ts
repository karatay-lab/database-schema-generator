import { pg } from "../../_helpers";
import type { MockTableDef } from "../../types";

const cartItem: MockTableDef = {
  name: "CartItem",
  dbName: "cart_items",
  comment: "Single product line inside a shopping cart",
  sortOrder: 5,
  fields: [
    pg.pk(0),
    pg.fk("cartId", "Owning cart UUID", 1),
    pg.fk("productId", "Referenced product UUID", 2),
    pg.int("quantity", "Number of units added to the cart", 3, 1),
    pg.decimal("unitPrice", 10, 2, "Product price captured at the time of adding to cart", 4),
    pg.createdAt(5),
    pg.updatedAt(6),
  ],
};

export default cartItem;
