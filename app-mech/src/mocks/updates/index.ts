import shopfrontDelta   from "./shopfront-manager/v2/delta";
import contentHubDelta  from "./content-hub-pro/v2/delta";
import analyticsDelta   from "./analytics-engine/v2/delta";
import type { ProjectV2Delta } from "./types";

export const allV2Deltas: Record<string, ProjectV2Delta> = {
  "Shopfront Manager": shopfrontDelta,
  "Content Hub Pro":   contentHubDelta,
  "Analytics Engine":  analyticsDelta,
};
