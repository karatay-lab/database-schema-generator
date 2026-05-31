"use client";

import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";

export function useHistoryQuery(projectId: string) {
  const trpc = useTRPC();
  return useQuery(trpc.history.list.queryOptions(
    { projectId },
    { enabled: !!projectId },
  ));
}
