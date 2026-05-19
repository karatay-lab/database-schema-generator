import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { computeMigrationOrder } from "@/lib/migrations/rules";
import { readProjectVersionGraph } from "@/lib/schema-db/graph";
import { baseProcedure, createTRPCRouter } from "../init";

export const hierarchyRouter = createTRPCRouter({
  get: baseProcedure
    .input(z.object({ projectName: z.string(), version: z.string() }))
    .query(({ input }) => {
      try {
        const graph = readProjectVersionGraph(input.projectName, input.version);
        const tableById = new Map(graph.tables.map((table) => [table.id, table]));
        const fieldById = new Map(graph.fields.map((field) => [field.id, field]));
        const order = computeMigrationOrder(graph);

        const edges = graph.relations.map((relation) => {
          const source = tableById.get(relation.sourceTableId);
          const target = tableById.get(relation.targetTableId);
          return {
            relationId: relation.id,
            name: relation.name,
            sourceModel: source?.name ?? "",
            targetModel: target?.name ?? "",
            sourceTableId: source?.tableId ?? "",
            targetTableId: target?.tableId ?? "",
            cardinality: relation.cardinality,
            fieldPairs: [...relation.fieldPairs]
              .sort((left, right) => left.sortOrder - right.sortOrder)
              .map((pair) => ({
                sourceField: fieldById.get(pair.sourceFieldId)?.name ?? "",
                targetField: fieldById.get(pair.targetFieldId)?.name ?? "",
              })),
          };
        });

        const parentCounts = Object.fromEntries(
          order.map((item) => [item.modelName, item.parentCount]),
        );

        return {
          projectName: graph.project.name,
          version: graph.version.name,
          order,
          edges,
          parentCounts,
          tableCount: graph.tables.length,
          relationCount: graph.relations.length,
        };
      } catch (err) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: err instanceof Error ? err.message : "Hierarchy could not be loaded.",
        });
      }
    }),
});
