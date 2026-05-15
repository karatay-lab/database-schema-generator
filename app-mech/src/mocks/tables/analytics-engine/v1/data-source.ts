import { my } from "../../_helpers";
import type { MockTableDef } from "../../types";

const dataSource: MockTableDef = {
  name: "DataSource",
  dbName: "data_sources",
  comment: "External data feed or integration connection used to ingest events",
  sortOrder: 6,
  fields: [
    my.pk(0),
    my.varchar("name", 150, "Display name for the data source", 1),
    my.varchar("type", 50, "Integration type: sdk | webhook | csv | api", 2),
    my.json("config", "Encrypted connection configuration (API keys, endpoints, options)", 3),
    my.bool("isActive", "Whether ingestion from this source is currently enabled", 4, true),
    my.timestamp("lastSyncedAt", "Timestamp of the most recent successful data pull", 5, { nullable: true }),
    my.createdAt(6),
    my.updatedAt(7),
  ],
};

export default dataSource;
