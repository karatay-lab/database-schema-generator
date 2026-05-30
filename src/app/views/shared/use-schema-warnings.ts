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

  // Warnings that are approved but still missing a required decision value.
  // Covers:
  //   1. Field lossy_convert / precision_loss on non-nullable target → silent 0/null is wrong
  //   2. Field backfill_required (new required field) → silent uuid/0/false is wrong
  //   3. Enum value_removed without a replacement → orphaned rows hit DB enum constraint at INSERT
  const defaultsRequiredCount = warnings.filter(
    (w) =>
      w.approvedAt !== null &&
      !w.replacementValue &&
      (
        (w.entityKind === "field" && (
          ((w.resolution === "lossy_convert" || w.resolution === "precision_loss") && w.targetNullable === false) ||
          (w.resolution === "backfill_required" && w.targetNullable === false)
        )) ||
        (w.entityKind === "enum" && w.changeKind === "value_removed")
      ),
  ).length;

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

  async function approve(id: string, replacementValue?: string) {
    await fetch(`/api/schema-warnings/${id}`, {
      method: "PATCH",
      headers: replacementValue ? { "Content-Type": "application/json" } : {},
      body: replacementValue ? JSON.stringify({ replacementValue }) : undefined,
    });
    await queryClient.invalidateQueries({ queryKey: ["schema-warnings"] });
  }

  async function unapprove(id: string) {
    await fetch(`/api/schema-warnings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "unapprove" }),
    });
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
    defaultsRequiredCount,
    isLoading,
    getWarning,
    approve,
    unapprove,
    approveMany,
  };
}
