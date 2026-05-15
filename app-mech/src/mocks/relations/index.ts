import shopfrontRelations from "./shopfront-manager/v1/relations";
import analyticsRelations from "./analytics-engine/v1/relations";
import contentHubRelations from "./content-hub-pro/v1/relations";
import type { MockRelationDef } from "./types";

export const allMockRelations: Record<string, MockRelationDef[]> = {
  "Shopfront Manager": shopfrontRelations,
  "Analytics Engine": analyticsRelations,
  "Content Hub Pro": contentHubRelations,
};
