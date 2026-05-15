export const providers = ["Postgres", "MySQL", "SQLite"] as const;
export type Provider = (typeof providers)[number];

export const prismaClients = ["prisma-client-js", "prisma-client"] as const;
export type PrismaClientOption = (typeof prismaClients)[number];

export const graphqlOptions = [
  "None",
  "Apollo Server (SDL-first)",
  "GraphQL Yoga",
  "Pothos Prisma plugin",
  "TypeGraphQL Prisma generator",
  "Nexus",
  "GraphQL Tools (SDL-first)",
  "GraphQL.js",
  "NestJS Apollo",
  "Express GraphQL",
  "Fastify GQL",
] as const;

export const defaultSchemaOptions = {
  client: prismaClients[0] as string,
  graphql: graphqlOptions[0] as string,
};

export const DEFAULT_VERSION_MAJOR = 1;
export const DEFAULT_VERSION_MINOR = 111;
export const DEFAULT_VERSION = "1.0111";
