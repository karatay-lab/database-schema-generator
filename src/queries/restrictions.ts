"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";

export function useRestrictionsQuery(
  projectName: string,
  version: string,
  modelName: string,
  modelKey: string,
) {
  const trpc = useTRPC();
  return useQuery(trpc.restrictions.list.queryOptions(
    { projectName, version, modelName, modelKey },
    { enabled: !!modelName },
  ));
}

export function useRestrictionMutations(
  projectName: string,
  version: string,
  modelName: string,
  modelKey: string,
) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: trpc.restrictions.list.queryOptions({ projectName, version, modelName, modelKey }).queryKey,
    });

  return {
    invalidate,
    create: useMutation(trpc.restrictions.create.mutationOptions()),
    update: useMutation(trpc.restrictions.update.mutationOptions()),
    delete: useMutation(trpc.restrictions.delete.mutationOptions()),
  };
}
