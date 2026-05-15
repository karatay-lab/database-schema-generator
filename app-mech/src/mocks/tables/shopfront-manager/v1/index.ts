import product from "./product";
import category from "./category";
import customer from "./customer";
import address from "./address";
import cart from "./cart";
import cartItem from "./cart-item";
import order from "./order";
import orderItem from "./order-item";
import payment from "./payment";
import review from "./review";
import type { MockTableDef } from "../../types";

export const shopfrontManagerTables: MockTableDef[] = [
  product,
  category,
  customer,
  address,
  cart,
  cartItem,
  order,
  orderItem,
  payment,
  review,
];
