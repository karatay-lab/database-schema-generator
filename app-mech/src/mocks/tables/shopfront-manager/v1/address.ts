import { pg } from "../../_helpers";
import type { MockTableDef } from "../../types";

const address: MockTableDef = {
  name: "Address",
  dbName: "addresses",
  comment: "Shipping or billing address linked to a customer",
  sortOrder: 3,
  fields: [
    pg.pk(0),
    pg.fk("customerId", "Owning customer UUID", 1),
    pg.varchar("type", 20, "Address purpose: shipping or billing", 2),
    pg.varchar("street", 255, "Street line including house number", 3),
    pg.varchar("city", 100, "City or locality name", 4),
    pg.varchar("state", 100, "State, province, or region (optional)", 5, { nullable: true }),
    pg.varchar("postalCode", 20, "ZIP or postal code", 6),
    { name: "country", dbName: undefined, logicalType: "string", nativeType: "@db.Char(2)", nullable: false, isArray: false, isId: false, defaultKind: "none", defaultValue: "", comment: "ISO 3166-1 alpha-2 country code", isUpdatedAt: false, sortOrder: 7 },
    pg.bool("isDefault", "Whether this is the customer's default shipping address", 8, false),
    pg.createdAt(9),
  ],
};

export default address;
