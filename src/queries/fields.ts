"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";

export function useFieldsQuery(
  projectName: string,
  version: string,
  modelName: string,
  modelKey: string,
) {
  const trpc = useTRPC();
  return useQuery(trpc.fields.list.queryOptions(
    { projectName, version, modelName, modelKey },
    { enabled: !!modelName },
  ));
}

export function useFieldMutations(
  projectName: string,
  version: string,
  modelName: string,
  modelKey: string,
) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: trpc.fields.list.queryOptions({ projectName, version, modelName, modelKey }).queryKey,
    });

  return {
    invalidate,
    create: useMutation(trpc.fields.create.mutationOptions()),
    update: useMutation(trpc.fields.update.mutationOptions()),
    delete: useMutation(trpc.fields.delete.mutationOptions()),
  };
}
