import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  createProject,
  deleteProject,
  forkProjectVersion,
  readProjects,
  updateProject,
} from "@/lib/projects-store";
import { baseProcedure, createTRPCRouter } from "../init";

const schemaOptionsSchema = z.object({
  client: z.string(),
  graphql: z.string(),
});

function trpcError(err: unknown, fallback = "Operation failed."): never {
  throw new TRPCError({
    code: "BAD_REQUEST",
    message: err instanceof Error ? err.message : fallback,
  });
}

export const projectsRouter = createTRPCRouter({
  list: baseProcedure.query(async () => {
    return readProjects();
  }),

  create: baseProcedure
    .input(
      z.object({
        name: z.string().min(8, "Project name must be at least 8 characters."),
        provider: z.enum(["Postgres", "MySQL", "SQLite"]),
        schemaOptions: schemaOptionsSchema,
      })
    )
    .mutation(async ({ input }) => {
      try {
        return await createProject(input.name.trim(), input.provider, input.schemaOptions);
      } catch (err) {
        trpcError(err, "Project could not be created.");
      }
    }),

  update: baseProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(8, "Project name must be at least 8 characters."),
        provider: z.enum(["Postgres", "MySQL", "SQLite"]),
        schemaOptions: schemaOptionsSchema,
      })
    )
    .mutation(async ({ input }) => {
      try {
        return await updateProject(input.id, input.name.trim(), input.provider, input.schemaOptions);
      } catch (err) {
        trpcError(err, "Project could not be updated.");
      }
    }),

  delete: baseProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      try {
        return await deleteProject(input.id);
      } catch (err) {
        trpcError(err, "Project could not be deleted.");
      }
    }),

  forkVersion: baseProcedure
    .input(z.object({ projectId: z.string() }))
    .mutation(async ({ input }) => {
      try {
        return await forkProjectVersion(input.projectId);
      } catch (err) {
        trpcError(err, "Could not create new version.");
      }
    }),
});
