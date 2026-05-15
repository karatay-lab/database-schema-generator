import { my } from "../../_helpers";
import type { MockTableDef } from "../../types";

const session: MockTableDef = {
  name: "Session",
  dbName: "sessions",
  comment: "Bounded visit window grouping events for a single user interaction",
  sortOrder: 1,
  fields: [
    my.pk(0),
    my.fk("userId", "User this session belongs to", 1),
    my.varchar("device", 20, "Device class: desktop | mobile | tablet", 2, { nullable: true }),
    my.varchar("browser", 50, "Browser name and major version", 3, { nullable: true }),
    my.varchar("os", 50, "Operating system name and version", 4, { nullable: true }),
    my.varchar("ipAddress", 45, "Client IP address (IPv4 or IPv6)", 5, { nullable: true }),
    my.int("eventCount", "Total events recorded in this session", 6, 0),
    my.timestamp("startedAt", "Session start timestamp", 7),
    my.timestamp("endedAt", "Session end timestamp (null while active)", 8, { nullable: true }),
    my.createdAt(9),
  ],
};

export default session;
