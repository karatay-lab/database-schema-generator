import type { CreateProjectInput } from "../../workflows/projects/types";

const mockContentHub: CreateProjectInput = {
  name: "Content Hub Pro",
  provider: "Postgres",
  schemaOptions: {
    client: "prisma-client-js",
    graphql: "None",
  },
  health: "Draft",
};

export default mockContentHub;
