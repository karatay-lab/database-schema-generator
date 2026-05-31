"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";

export function useTablesQuery(projectName: string, version: string) {
  const trpc = useTRPC();
  return useQuery(trpc.tables.list.queryOptions(
    { projectName, version },
    { enabled: !!projectName && !!version },
  ));
}

export function useTableMutations(projectName: string, version: string) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: trpc.tables.list.queryOptions({ projectName, version }).queryKey,
    });

  return {
    invalidate,
    create: useMutation(trpc.tables.create.mutationOptions()),
    update: useMutation(trpc.tables.update.mutationOptions()),
    delete: useMutation(trpc.tables.delete.mutationOptions()),
  };
}
