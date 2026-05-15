import type { MockRestrictionDef } from "../../types";

const restrictions: MockRestrictionDef[] = [
  // One account per email (nullable — only when email is present)
  { table: "User", type: "UNIQUE", name: "user_email_unique", fields: ["email"] },

  // Each step position is unique within a funnel
  { table: "FunnelStep", type: "UNIQUE", name: "funnel_step_order_unique", fields: ["funnelId", "stepOrder"] },

  // Each property key is unique per event
  { table: "Property", type: "UNIQUE", name: "property_key_per_event", fields: ["eventId", "key"] },

  // Query-path indexes for the event pipeline
  { table: "Session",  type: "INDEX", name: "session_user_idx",     fields: ["userId"] },
  { table: "Event",    type: "INDEX", name: "event_session_idx",    fields: ["sessionId"] },
  { table: "Event",    type: "INDEX", name: "event_name_idx",       fields: ["name"] },
  { table: "Widget",   type: "INDEX", name: "widget_dashboard_idx", fields: ["dashboardId"] },
];

export default restrictions;
