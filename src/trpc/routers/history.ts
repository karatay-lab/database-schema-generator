import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { readProjects } from "@/lib/projects-store";
import { getSchemaStats } from "@/lib/schema-store";
import { baseProcedure, createTRPCRouter } from "../init";

export const historyRouter = createTRPCRouter({
  list: baseProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ input }) => {
      const projects = await readProjects();
      const project = projects.find((p) => p.id === input.projectId);
      if (!project) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Project not found." });
      }
      const versions = await Promise.all(
        project.versions.map(async (v) => {
          const stats = await getSchemaStats(project.name, v.name).catch(() => ({
            tableCount: 0, fieldCount: 0, relationCount: 0, restrictionCount: 0,
          }));
          return {
            name: v.name,
            createdAt: v.createdAt,
            tables: stats.tableCount,
            fields: stats.fieldCount,
            relations: stats.relationCount,
            restrictions: stats.restrictionCount,
          };
        }),
      );
      return { versions };
    }),
});
