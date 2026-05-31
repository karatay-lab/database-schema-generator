import { TRPCError } from "@trpc/server";
import { z } from "zod";
import path from "node:path";
import { rm } from "node:fs/promises";

import { db as appDb } from "@/lib/db/client";
import { deleteConnection, listConnections } from "@/lib/db/migration-connections";
import { baseProcedure, createTRPCRouter } from "../init";

const migrationsDir = () => path.join(process.cwd(), "src/database/migrations");

function toSlug(value: string) {
  return (
    value.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "untitled"
  );
}

function trpcError(err: unknown, fallback = "Operation failed."): never {
  throw new TRPCError({
    code: "BAD_REQUEST",
    message: err instanceof Error ? err.message : fallback,
  });
}

export const migrationsRouter = createTRPCRouter({
  listConnections: baseProcedure
    .input(z.object({ projectName: z.string() }))
    .query(({ input }) => {
      const projectRow = appDb
        .prepare("SELECT id FROM projects WHERE name = ?")
        .get(input.projectName) as { id: string } | undefined;

      if (!projectRow) return { connections: [] };

      try {
        const connections = listConnections(projectRow.id);
        return { connections };
      } catch {
        return { connections: [] };
      }
    }),

  deleteConnection: baseProcedure
    .input(z.object({ projectName: z.string(), uuid: z.string() }))
    .mutation(async ({ input }) => {
      deleteConnection(input.uuid);

      await rm(path.join(migrationsDir(), toSlug(input.projectName), input.uuid), {
        recursive: true,
        force: true,
      });

      const projectRow = appDb
        .prepare("SELECT id FROM projects WHERE name = ?")
        .get(input.projectName) as { id: string } | undefined;

      const connections = projectRow ? listConnections(projectRow.id) : [];
      return { connections };
    }),

  // collect, compare, validate, run remain as REST endpoints for now.
  // They involve heavy file-system and native DB driver work that will be
  // migrated together with the database unification in Phase 5.
});
