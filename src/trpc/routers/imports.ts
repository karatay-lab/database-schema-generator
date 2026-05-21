import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  parsePickle,
  summarizePickle,
  importVersionPickle,
  importProjectPickle,
} from "@/lib/schema-imports-store";
import { baseProcedure, createTRPCRouter } from "../init";

function trpcError(err: unknown, fallback = "Operation failed."): never {
  throw new TRPCError({
    code: "BAD_REQUEST",
    message: err instanceof Error ? err.message : fallback,
  });
}

export const importsRouter = createTRPCRouter({
  parse: baseProcedure
    .input(z.object({ content: z.string() }))
    .mutation(({ input }) => {
      try {
        const pickle = parsePickle(input.content);
        return summarizePickle(pickle);
      } catch (err) {
        trpcError(err, "Could not parse pickle file.");
      }
    }),

  importVersion: baseProcedure
    .input(
      z.object({
        content: z.string(),
        projectId: z.string().optional(),
        projectName: z.string().optional(),
        versionName: z.string().optional(),
        replace: z.boolean().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        return await importVersionPickle(input);
      } catch (err) {
        trpcError(err, "Version import failed.");
      }
    }),

  importProject: baseProcedure
    .input(
      z.object({
        content: z.string(),
        projectName: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        return await importProjectPickle(input);
      } catch (err) {
        trpcError(err, "Project import failed.");
      }
    }),
});
