import { my } from "../../_helpers";
import type { MockTableDef } from "../../types";

const funnelStep: MockTableDef = {
  name: "FunnelStep",
  dbName: "funnel_steps",
  comment: "Ordered step within a funnel definition, matched by event name",
  sortOrder: 5,
  fields: [
    my.pk(0),
    my.fk("funnelId", "Owning funnel UUID", 1),
    my.varchar("name", 150, "Step label shown in reports", 2),
    my.varchar("eventName", 100, "Event name that satisfies this step", 3),
    my.int("stepOrder", "Zero-based position within the funnel", 4, 0),
    my.float("conversionRate", "Percentage of users reaching this step from the previous one", 5, { nullable: true }),
    my.createdAt(6),
    my.updatedAt(7),
  ],
};

export default funnelStep;
