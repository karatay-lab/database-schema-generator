import { pg } from "../../_helpers";
import type { MockTableDef } from "../../types";

const payment: MockTableDef = {
  name: "Payment",
  dbName: "payments",
  comment: "Payment attempt against an order — tracks provider, amount, and outcome",
  sortOrder: 8,
  fields: [
    pg.pk(0),
    pg.fk("orderId", "Order this payment applies to", 1),
    pg.varchar("provider", 50, "Payment gateway identifier: stripe | paypal | braintree", 2),
    pg.decimal("amount", 10, 2, "Amount charged in the order currency", 3),
    pg.varchar("currency", 3, "ISO 4217 three-letter currency code", 4),
    pg.varchar("status", 30, "Outcome: pending | succeeded | failed | refunded", 5),
    pg.varchar("providerRef", 100, "External transaction ID returned by the payment provider", 6, { nullable: true }),
    pg.jsonb("metadata", "Raw provider response payload for auditing", 7),
    pg.createdAt(8),
    pg.updatedAt(9),
  ],
};

export default payment;
