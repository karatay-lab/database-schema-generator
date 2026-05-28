"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { SchemaWarning } from "@/lib/schema-warnings-store";

type WarningsResponse = {
  success: boolean;
  warnings: SchemaWarning[];
};

async function fetchWarnings(
  projectId: string,
  fromVersion: string,
  toVersion: string,
): Promise<SchemaWarning[]> {
  const params = new URLSearchParams({ projectId, fromVersion, toVersion });
  const res = await fetch(`/api/schema-warnings?${params.toString()}`);
  if (!res.ok) return [];
  const data = (await res.json()) as WarningsResponse;
  return data.success ? (data.warnings ?? []) : [];
}

export function useSchemaWarnings(projectId: string, fromVersion: string, toVersion: string) {
  const queryClient = useQueryClient();
  const queryKey = ["schema-warnings", projectId, fromVersion, toVersion];

  const { data: warnings = [], isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchWarnings(projectId, fromVersion, toVersion),
    enabled: Boolean(projectId && fromVersion && toVersion),
    staleTime: 10_000,
  });

  const pendingWarnings = warnings.filter((w) => !w.approvedAt);
  const pendingCount = pendingWarnings.length;

  // Lookup key: "entityKind:entityId:changeKind" → warning
  const warningLookup = new Map(
    warnings.map((w) => [`${w.entityKind}:${w.entityId}:${w.changeKind}`, w]),
  );

  function getWarning(
    entityKind: SchemaWarning["entityKind"],
    entityId: string,
    changeKind: string,
  ): SchemaWarning | undefined {
    return warningLookup.get(`${entityKind}:${entityId}:${changeKind}`);
  }

  async function approve(id: string) {
    await fetch(`/api/schema-warnings/${id}`, { method: "PATCH" });
    await queryClient.invalidateQueries({ queryKey: ["schema-warnings"] });
  }

  async function approveMany(ids: string[]) {
    if (ids.length === 0) return;
    await fetch("/api/schema-warnings/bulk-approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
    await queryClient.invalidateQueries({ queryKey: ["schema-warnings"] });
  }

  return {
    warnings,
    pendingWarnings,
    pendingCount,
    isLoading,
    getWarning,
    approve,
    approveMany,
  };
}
