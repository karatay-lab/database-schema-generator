import { initTRPC } from "@trpc/server";
import superjson from "superjson";

export async function createTRPCContext(opts: { headers: Headers }) {
  return { headers: opts.headers };
}

export type TRPCContext = Awaited<ReturnType<typeof createTRPCContext>>;

const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
});

export const createCallerFactory = t.createCallerFactory;
export const createTRPCRouter = t.router;
export const baseProcedure = t.procedure;
