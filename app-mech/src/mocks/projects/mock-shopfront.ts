import type { CreateProjectInput } from "../../workflows/projects/types";

const mockShopfront: CreateProjectInput = {
  name: "Shopfront Manager",
  provider: "Postgres",
  schemaOptions: {
    client: "prisma-client-js",
    graphql: "None",
  },
  health: "Draft",
};

export default mockShopfront;
