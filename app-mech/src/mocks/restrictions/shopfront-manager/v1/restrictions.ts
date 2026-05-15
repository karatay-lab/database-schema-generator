import type { MockRestrictionDef } from "../../types";

const restrictions: MockRestrictionDef[] = [
  // Unique slugs for storefront URLs
  { table: "Product",  type: "UNIQUE", name: "product_slug_unique",   fields: ["slug"] },
  { table: "Category", type: "UNIQUE", name: "category_slug_unique",  fields: ["slug"] },

  // One account per email
  { table: "Customer", type: "UNIQUE", name: "customer_email_unique", fields: ["email"] },

  // One review per customer per product
  { table: "Review", type: "UNIQUE", name: "review_once_per_customer", fields: ["productId", "customerId"] },

  // Query-path indexes
  { table: "Order",     type: "INDEX", name: "order_customer_idx",    fields: ["customerId"] },
  { table: "OrderItem", type: "INDEX", name: "order_item_order_idx",  fields: ["orderId"] },
  { table: "Payment",   type: "INDEX", name: "payment_order_idx",     fields: ["orderId"] },
  { table: "CartItem",  type: "INDEX", name: "cart_item_cart_idx",    fields: ["cartId"] },
];

export default restrictions;
