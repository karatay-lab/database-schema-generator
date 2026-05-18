import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { graphToCanonicalStore, readProjectVersionGraph } from "@/lib/schema-db/graph";
import { renderPrismaSchemaFromGraph } from "@/lib/schema-renderers/prisma";
import { generateDrizzleSchema } from "@/lib/schema-renderers/drizzle";
import { baseProcedure, createTRPCRouter } from "../init";

export const exportsRouter = createTRPCRouter({
  generate: baseProcedure
    .input(z.object({
      projectName: z.string(),
      version: z.string(),
      type: z.enum(["prisma", "drizzle"]),
    }))
    .mutation(async ({ input }) => {
      try {
        const graph = readProjectVersionGraph(input.projectName, input.version);

        if (input.type === "prisma") {
          const code = renderPrismaSchemaFromGraph(graph);
          return { code, fileName: `${input.version}.prisma` };
        }

        const store = graphToCanonicalStore(graph);
        const code = generateDrizzleSchema(store);
        return {
          code,
          fileName: "schema.ts",
          tableCount: store.models.length,
          enumCount: (store.enums ?? []).length,
        };
      } catch (err) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: err instanceof Error ? err.message : "Export failed.",
        });
      }
    }),
});
