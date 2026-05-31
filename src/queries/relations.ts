"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";

export function useRelationsQuery(
  projectName: string,
  version: string,
  modelName: string,
  modelKey: string,
) {
  const trpc = useTRPC();
  return useQuery(trpc.relations.list.queryOptions(
    { projectName, version, modelName, modelKey },
    { enabled: !!modelName },
  ));
}

export function useRelationMutations(
  projectName: string,
  version: string,
  modelName: string,
  modelKey: string,
) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: trpc.relations.list.queryOptions({ projectName, version, modelName, modelKey }).queryKey,
    });

  return {
    invalidate,
    create: useMutation(trpc.relations.create.mutationOptions()),
    update: useMutation(trpc.relations.update.mutationOptions()),
    delete: useMutation(trpc.relations.delete.mutationOptions()),
  };
}
