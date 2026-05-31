"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";

export function useProjectsQuery() {
  const trpc = useTRPC();
  return useQuery(trpc.projects.list.queryOptions());
}

export function useProjectMutations() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: trpc.projects.list.queryOptions().queryKey,
    });

  return {
    invalidate,
    create: useMutation(trpc.projects.create.mutationOptions()),
    update: useMutation(trpc.projects.update.mutationOptions()),
    delete: useMutation(trpc.projects.delete.mutationOptions()),
    fork:   useMutation(trpc.projects.forkVersion.mutationOptions()),
  };
}
