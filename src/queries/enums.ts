"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";

export function useEnumsQuery(projectName: string, version: string) {
  const trpc = useTRPC();
  return useQuery(trpc.enums.list.queryOptions(
    { projectName, version },
    { enabled: !!projectName && !!version },
  ));
}

export function useEnumMutations(projectName: string, version: string) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: trpc.enums.list.queryOptions({ projectName, version }).queryKey,
    });

  return {
    invalidate,
    create: useMutation(trpc.enums.create.mutationOptions()),
    delete: useMutation(trpc.enums.delete.mutationOptions()),
  };
}
