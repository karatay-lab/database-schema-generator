import type { SchemaOptions } from "@/types/projects";

export const providers = ["Postgres", "MySQL", "SQLite"];
export const prismaClients = ["prisma-client-js", "prisma-client"];
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
];

export const defaultSchemaOptions: SchemaOptions = {
  client: prismaClients[0],
  graphql: graphqlOptions[0],
};

export const providerConfig: Record<string, { border: string; badge: string; dot: string }> = {
  Postgres: {
    border: "border-l-blue-500",
    badge: "border-blue-200 bg-blue-50 text-blue-700",
    dot: "bg-blue-500",
  },
  MySQL: {
    border: "border-l-amber-500",
    badge: "border-amber-200 bg-amber-50 text-amber-700",
    dot: "bg-amber-500",
  },
  SQLite: {
    border: "border-l-emerald-500",
    badge: "border-emerald-200 bg-emerald-50 text-emerald-700",
    dot: "bg-emerald-500",
  },
};

export const inlineSelectCls =
  "h-8 rounded-md border border-slate-300 bg-white px-2 text-xs font-medium text-slate-950 outline-none transition focus:border-emerald-600";
