import { my } from "../../_helpers";
import type { MockTableDef } from "../../types";

const dashboard: MockTableDef = {
  name: "Dashboard",
  dbName: "dashboards",
  comment: "Named collection of widgets owned by a user for monitoring KPIs",
  sortOrder: 7,
  fields: [
    my.pk(0),
    my.fk("userId", "User who owns this dashboard", 1),
    my.varchar("name", 150, "Dashboard display name", 2),
    my.varchar("description", 500, "Short description of what this dashboard tracks", 3, { nullable: true }),
    my.varchar("layout", 20, "Grid layout preset: grid | single | wide", 4),
    my.bool("isPublic", "Whether the dashboard is accessible via a public share link", 5, false),
    my.createdAt(6),
    my.updatedAt(7),
  ],
};

export default dashboard;
