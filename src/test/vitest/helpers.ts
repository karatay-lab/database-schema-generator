import { createCallerFactory } from "@/trpc/init";
import { appRouter } from "@/trpc/routers/_app";

const createCaller = createCallerFactory(appRouter);

export const caller = createCaller({ headers: new Headers() });

export const DEFAULT_SCHEMA_OPTIONS = {
  client: "prisma-client-js",
  graphql: "None",
} as const;
