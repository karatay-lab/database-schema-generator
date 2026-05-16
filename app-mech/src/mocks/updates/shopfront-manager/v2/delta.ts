import type { ProjectV2Delta } from "../../types";

const delta: ProjectV2Delta = {
  tableRenames: [
    { from: "Cart",     to: "Basket",     dbName: "baskets" },
    { from: "CartItem", to: "BasketItem", dbName: "basket_items" },
  ],

  fieldRenames: [
    { table: "Cart",     from: "totalAmount", to: "total" },
    { table: "CartItem", from: "unitPrice",   to: "price" },
    { table: "Customer", from: "isVerified",  to: "emailVerified" },
  ],

  fieldTypeChanges: [
    { table: "Review",  field: "rating", logicalType: "float",   nativeType: null },
    { table: "Product", field: "price",  logicalType: "float",   nativeType: null },
  ],

  removedRelations: [
    "CartItemToProduct",
    "ReviewToCustomer",
  ],

  removedRestrictions: [
    "review_once_per_customer",
    "cart_item_cart_idx",
  ],
};

export default delta;
