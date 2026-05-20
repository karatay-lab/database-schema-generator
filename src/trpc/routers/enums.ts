import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  addEnumValue,
  createEnum,
  deleteEnum,
  deleteEnumValue,
  listEnums,
  renameEnum,
  renameEnumValue,
  reorderEnumValues,
} from "@/lib/schema-store";
import { baseProcedure, createTRPCRouter } from "../init";

function trpcError(err: unknown, fallback = "Operation failed."): never {
  throw new TRPCError({
    code: "BAD_REQUEST",
    message: err instanceof Error ? err.message : fallback,
  });
}

const versionInput = z.object({ projectName: z.string(), version: z.string() });

export const enumsRouter = createTRPCRouter({
  list: baseProcedure
    .input(versionInput)
    .query(async ({ input }) => {
      try {
        return await listEnums(input.projectName, input.version);
      } catch (err) {
        trpcError(err, "Could not list enums.");
      }
    }),

  create: baseProcedure
    .input(versionInput.extend({ name: z.string().trim() }))
    .mutation(async ({ input }) => {
      try {
        await createEnum(input.projectName, input.version, input.name);
        return await listEnums(input.projectName, input.version);
      } catch (err) {
        trpcError(err);
      }
    }),

  rename: baseProcedure
    .input(versionInput.extend({ oldName: z.string(), newName: z.string().trim() }))
    .mutation(async ({ input }) => {
      try {
        await renameEnum(input.projectName, input.version, input.oldName, input.newName);
        return await listEnums(input.projectName, input.version);
      } catch (err) {
        trpcError(err);
      }
    }),

  delete: baseProcedure
    .input(versionInput.extend({ name: z.string() }))
    .mutation(async ({ input }) => {
      try {
        await deleteEnum(input.projectName, input.version, input.name);
        return await listEnums(input.projectName, input.version);
      } catch (err) {
        trpcError(err);
      }
    }),

  addValue: baseProcedure
    .input(versionInput.extend({ enumName: z.string(), value: z.string().trim() }))
    .mutation(async ({ input }) => {
      try {
        await addEnumValue(input.projectName, input.version, input.enumName, input.value);
        return await listEnums(input.projectName, input.version);
      } catch (err) {
        trpcError(err);
      }
    }),

  renameValue: baseProcedure
    .input(versionInput.extend({ enumName: z.string(), valueId: z.string(), newValue: z.string().trim() }))
    .mutation(async ({ input }) => {
      try {
        await renameEnumValue(input.projectName, input.version, input.enumName, input.valueId, input.newValue);
        return await listEnums(input.projectName, input.version);
      } catch (err) {
        trpcError(err);
      }
    }),

  deleteValue: baseProcedure
    .input(versionInput.extend({ enumName: z.string(), valueId: z.string() }))
    .mutation(async ({ input }) => {
      try {
        await deleteEnumValue(input.projectName, input.version, input.enumName, input.valueId);
        return await listEnums(input.projectName, input.version);
      } catch (err) {
        trpcError(err);
      }
    }),

  reorderValues: baseProcedure
    .input(versionInput.extend({ enumName: z.string(), valueIds: z.array(z.string()) }))
    .mutation(async ({ input }) => {
      try {
        await reorderEnumValues(input.projectName, input.version, input.enumName, input.valueIds);
        return await listEnums(input.projectName, input.version);
      } catch (err) {
        trpcError(err);
      }
    }),
});
