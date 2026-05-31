"use client";

import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";

export function useHierarchyQuery(projectName: string, version: string) {
  const trpc = useTRPC();
  return useQuery(trpc.hierarchy.get.queryOptions(
    { projectName, version },
    { enabled: !!projectName && !!version },
  ));
}
