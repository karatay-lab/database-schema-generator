"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";

export function useCommentaryFieldsQuery(
  projectName: string,
  version: string,
  modelName: string,
  modelKey: string,
) {
  const trpc = useTRPC();
  return useQuery(trpc.commentary.listFields.queryOptions(
    { projectName, version, modelName, modelKey },
    { enabled: !!modelName },
  ));
}

export function useCommentaryMutations(
  projectName: string,
  version: string,
  modelName: string,
  modelKey: string,
) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: trpc.commentary.listFields.queryOptions({ projectName, version, modelName, modelKey }).queryKey,
    });

  return {
    invalidate,
    update: useMutation(trpc.commentary.updateComments.mutationOptions()),
  };
}
