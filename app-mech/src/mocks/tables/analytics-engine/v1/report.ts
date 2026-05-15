import { my } from "../../_helpers";
import type { MockTableDef } from "../../types";

const report: MockTableDef = {
  name: "Report",
  dbName: "reports",
  comment: "Scheduled or on-demand aggregation output delivered to users",
  sortOrder: 9,
  fields: [
    my.pk(0),
    my.fk("userId", "User who created or owns the report", 1),
    my.varchar("name", 150, "Report display name", 2),
    my.text("query", "Raw SQL or DSL query used to produce the report", 3, { nullable: false }),
    my.json("config", "Output format, grouping, date range, and filter settings", 4),
    my.varchar("status", 20, "Execution status: pending | running | completed | failed", 5),
    my.timestamp("scheduledAt", "Next scheduled run time (null for on-demand reports)", 6, { nullable: true }),
    my.createdAt(7),
    my.updatedAt(8),
  ],
};

export default report;
