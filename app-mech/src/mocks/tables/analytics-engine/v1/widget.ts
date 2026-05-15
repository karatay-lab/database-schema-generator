import { my } from "../../_helpers";
import type { MockTableDef } from "../../types";

const widget: MockTableDef = {
  name: "Widget",
  dbName: "widgets",
  comment: "Single chart or metric card placed on a dashboard",
  sortOrder: 8,
  fields: [
    my.pk(0),
    my.fk("dashboardId", "Parent dashboard UUID", 1),
    my.varchar("type", 50, "Visualisation type: line_chart | bar_chart | funnel | number | table", 2),
    my.varchar("title", 150, "Widget heading shown to viewers", 3),
    my.json("config", "Query definition, axis settings, filters, and colour overrides", 4),
    my.int("sortOrder", "Position within the dashboard grid (row-major order)", 5, 0),
    my.createdAt(6),
    my.updatedAt(7),
  ],
};

export default widget;
