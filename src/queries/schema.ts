"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";

export function useSchemaStatsQuery(projectName: string, version: string) {
  const trpc = useTRPC();
  return useQuery(trpc.schema.stats.queryOptions(
    { projectName, version },
    { enabled: !!projectName && !!version },
  ));
}

export function useZodSchemasQuery(projectName: string, version: string) {
  const trpc = useTRPC();
  return useQuery(trpc.schema.listZodFiles.queryOptions(
    { projectName, version },
    { enabled: !!projectName && !!version },
  ));
}

export function useZodFileQuery(id: number | null) {
  const trpc = useTRPC();
  return useQuery(trpc.schema.readZodFile.queryOptions(
    { id: id ?? 0 },
    { enabled: id !== null },
  ));
}

export function useZodMutations(projectName: string, version: string) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: trpc.schema.listZodFiles.queryOptions({ projectName, version }).queryKey,
    });

  return {
    invalidate,
    setPath:  useMutation(trpc.schema.setZodFilePath.mutationOptions()),
    rename:   useMutation(trpc.schema.renameZodSchema.mutationOptions()),
    delete:   useMutation(trpc.schema.deleteZodFile.mutationOptions()),
    clear:    useMutation(trpc.schema.clearZodFiles.mutationOptions()),
    generate: useMutation(trpc.schema.generateZod.mutationOptions()),
  };
}

export function useSchemaTestMutation() {
  const trpc = useTRPC();
  return useMutation(trpc.schema.test.mutationOptions());
}
