import type { MockRelationDef } from "../../types";

const relations: MockRelationDef[] = [
  {
    name: "SessionToUser",
    cardinality: "many-to-one",
    onDelete: "Cascade",
    onUpdate: "Cascade",
    source: { table: "Session", fkField: "userId", virtualField: "user", isList: false, nullable: false },
    target: { table: "User", pkField: "id", virtualField: "sessions", isList: true, nullable: false },
  },
  {
    name: "EventToSession",
    cardinality: "many-to-one",
    onDelete: "Cascade",
    onUpdate: "Cascade",
    source: { table: "Event", fkField: "sessionId", virtualField: "session", isList: false, nullable: false },
    target: { table: "Session", pkField: "id", virtualField: "events", isList: true, nullable: false },
  },
  {
    name: "EventToUser",
    cardinality: "many-to-one",
    onDelete: "Cascade",
    onUpdate: "Cascade",
    source: { table: "Event", fkField: "userId", virtualField: "user", isList: false, nullable: false },
    target: { table: "User", pkField: "id", virtualField: "events", isList: true, nullable: false },
  },
  {
    name: "PropertyToEvent",
    cardinality: "many-to-one",
    onDelete: "Cascade",
    onUpdate: "Cascade",
    source: { table: "Property", fkField: "eventId", virtualField: "event", isList: false, nullable: false },
    target: { table: "Event", pkField: "id", virtualField: "properties", isList: true, nullable: false },
  },
  {
    name: "FunnelStepToFunnel",
    cardinality: "many-to-one",
    onDelete: "Cascade",
    onUpdate: "Cascade",
    source: { table: "FunnelStep", fkField: "funnelId", virtualField: "funnel", isList: false, nullable: false },
    target: { table: "Funnel", pkField: "id", virtualField: "steps", isList: true, nullable: false },
  },
  {
    name: "DashboardToUser",
    cardinality: "many-to-one",
    onDelete: "Cascade",
    onUpdate: "Cascade",
    source: { table: "Dashboard", fkField: "userId", virtualField: "user", isList: false, nullable: false },
    target: { table: "User", pkField: "id", virtualField: "dashboards", isList: true, nullable: false },
  },
  {
    name: "WidgetToDashboard",
    cardinality: "many-to-one",
    onDelete: "Cascade",
    onUpdate: "Cascade",
    source: { table: "Widget", fkField: "dashboardId", virtualField: "dashboard", isList: false, nullable: false },
    target: { table: "Dashboard", pkField: "id", virtualField: "widgets", isList: true, nullable: false },
  },
  {
    name: "ReportToUser",
    cardinality: "many-to-one",
    onDelete: "Cascade",
    onUpdate: "Cascade",
    source: { table: "Report", fkField: "userId", virtualField: "user", isList: false, nullable: false },
    target: { table: "User", pkField: "id", virtualField: "reports", isList: true, nullable: false },
  },
];

export default relations;
