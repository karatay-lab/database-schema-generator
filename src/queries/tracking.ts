"use client";

import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import type { WarningEntityKind } from "@/components/tracking/warnings-panel";

export function usePendingCountsQuery(
  projectId: string,
  fromVersion: string,
  toVersion: string,
) {
  const trpc = useTRPC();
  return useQuery(trpc.tracking.pendingCounts.queryOptions(
    { projectId, fromVersion, toVersion },
    { enabled: !!(projectId && fromVersion && toVersion) },
  ));
}

export function useWarningsByKindQuery(
  projectId: string,
  fromVersion: string,
  toVersion: string,
  entityKind: WarningEntityKind,
) {
  const trpc = useTRPC();
  return useQuery(trpc.tracking.warningsByKind.queryOptions(
    { projectId, fromVersion, toVersion, entityKind: entityKind as "table" | "field" | "enum" | "relation" },
    { enabled: !!(projectId && fromVersion && toVersion) },
  ));
}
