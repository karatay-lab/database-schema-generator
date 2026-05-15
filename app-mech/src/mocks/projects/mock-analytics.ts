import type { CreateProjectInput } from "../../workflows/projects/types";

const mockAnalytics: CreateProjectInput = {
  name: "Analytics Engine",
  provider: "MySQL",
  schemaOptions: {
    client: "prisma-client-js",
    graphql: "Apollo Server (SDL-first)",
  },
  health: "Draft",
};

export default mockAnalytics;
