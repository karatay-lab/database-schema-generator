import { my } from "../../_helpers";
import type { MockTableDef } from "../../types";

const property: MockTableDef = {
  name: "Property",
  dbName: "properties",
  comment: "Normalised key-value attribute attached to an event for flexible querying",
  sortOrder: 3,
  fields: [
    my.pk(0),
    my.fk("eventId", "Parent event UUID", 1),
    my.varchar("key", 100, "Attribute name, e.g. page_url or product_id", 2),
    my.varchar("value", 500, "String-serialised attribute value", 3),
    my.varchar("valueType", 20, "Value data type hint: string | number | boolean | json", 4),
    my.createdAt(5),
  ],
};

export default property;
