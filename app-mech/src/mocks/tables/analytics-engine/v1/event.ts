import { my } from "../../_helpers";
import type { MockTableDef } from "../../types";

const event: MockTableDef = {
  name: "Event",
  dbName: "events",
  comment: "Single captured user interaction or system action",
  sortOrder: 2,
  fields: [
    my.pk(0),
    my.fk("sessionId", "Session this event was captured in", 1),
    my.fk("userId", "User who triggered the event", 2),
    my.varchar("name", 100, "Event name slug, e.g. page_view or button_click", 3),
    my.varchar("category", 50, "Broad event category for grouping in reports", 4, { nullable: true }),
    my.json("payload", "Arbitrary key-value data attached to the event at capture time", 5),
    my.timestamp("occurredAt", "Exact client-side timestamp when the event fired", 6),
    my.createdAt(7),
  ],
};

export default event;
