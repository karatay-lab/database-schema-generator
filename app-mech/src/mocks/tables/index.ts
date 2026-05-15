import { shopfrontManagerTables } from "./shopfront-manager/v1";
import { analyticsEngineTables } from "./analytics-engine/v1";
import { contentHubProTables } from "./content-hub-pro/v1";
import type { MockTableDef } from "./types";

export { shopfrontManagerTables, analyticsEngineTables, contentHubProTables };

export const allMockTables: Record<string, MockTableDef[]> = {
  "Shopfront Manager": shopfrontManagerTables,
  "Analytics Engine": analyticsEngineTables,
  "Content Hub Pro": contentHubProTables,
};
