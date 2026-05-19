"use client";

import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";

export function useSchemaModels(projectName: string, version: string) {
  const trpc = useTRPC();
  const query = useQuery(
    trpc.tables.list.queryOptions(
      { projectName, version },
      { enabled: !!projectName && !!version },
    ),
  );
  return {
    models: (query.data ?? []),
    loadingModels: query.isLoading,
    reload: query.refetch,
  };
}
