import shopfrontRestrictions from "./shopfront-manager/v1/restrictions";
import analyticsRestrictions from "./analytics-engine/v1/restrictions";
import contentHubRestrictions from "./content-hub-pro/v1/restrictions";
import type { MockRestrictionDef } from "./types";

export const allMockRestrictions: Record<string, MockRestrictionDef[]> = {
  "Shopfront Manager": shopfrontRestrictions,
  "Analytics Engine": analyticsRestrictions,
  "Content Hub Pro": contentHubRestrictions,
};
