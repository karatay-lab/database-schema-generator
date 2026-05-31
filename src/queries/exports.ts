"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";

export function useExportHistoryQuery(projectName: string) {
  const trpc = useTRPC();
  return useQuery(trpc.exports.list.queryOptions(
    { projectName },
    { enabled: !!projectName },
  ));
}

export function useExportMutations(projectName: string) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: trpc.exports.list.queryOptions({ projectName }).queryKey,
    });

  return {
    invalidate,
    generate:       useMutation(trpc.exports.generate.mutationOptions()),
    reset:          useMutation(trpc.exports.reset.mutationOptions()),
    markDownloaded: useMutation(trpc.exports.markDownloaded.mutationOptions()),
  };
}
