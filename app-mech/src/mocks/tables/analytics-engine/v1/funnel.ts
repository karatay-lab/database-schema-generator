import { my } from "../../_helpers";
import type { MockTableDef } from "../../types";

const funnel: MockTableDef = {
  name: "Funnel",
  dbName: "funnels",
  comment: "Named multi-step conversion path measuring user drop-off",
  sortOrder: 4,
  fields: [
    my.pk(0),
    my.varchar("name", 150, "Human-readable funnel name", 1),
    my.text("description", "What this funnel measures and why it matters", 2),
    my.bool("isActive", "Whether this funnel is currently being tracked", 3, true),
    my.int("windowDays", "Maximum days allowed between consecutive steps", 4, 30),
    my.createdAt(5),
    my.updatedAt(6),
  ],
};

export default funnel;
