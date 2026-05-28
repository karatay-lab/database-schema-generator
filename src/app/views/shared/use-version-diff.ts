"use client";

import { useQuery } from "@tanstack/react-query";
import type { TableDiff, FieldDiff, VersionDiff } from "@/lib/version-diff/detect-changes";

type DiffResponse = {
  success: boolean;
  diff: VersionDiff | null;
  error?: string;
};

async function fetchVersionDiff(projectName: string, toVersion: string): Promise<VersionDiff | null> {
  const params = new URLSearchParams({ projectName, toVersion });
  const res = await fetch(`/api/version-diff?${params.toString()}`);
  if (!res.ok) return null;
  const data = (await res.json()) as DiffResponse;
  return data.success ? (data.diff ?? null) : null;
}

// Returns the raw VersionDiff for the current version vs its predecessor.
export function useVersionDiff(projectName: string, version: string) {
  return useQuery({
    queryKey: ["version-diff", projectName, version],
    queryFn: () => fetchVersionDiff(projectName, version),
    enabled: Boolean(projectName && version),
    staleTime: 30_000,
  });
}

// Convenience lookup maps derived from the diff result.
export type VersionDiffLookup = {
  // stable tableId → TableDiff
  diffByTableId: Map<string, TableDiff>;
  // canonical tableKey → TableDiff (matches PrismaModel.key)
  diffByTableKey: Map<string, TableDiff>;
  // stable fieldId → FieldDiff (for graph-based lookups)
  diffByFieldId: Map<string, FieldDiff>;
  // canonical fieldKey → FieldDiff (matches PrismaField.key)
  diffByFieldKey: Map<string, FieldDiff>;
  hasAny: boolean;
  hasBreaking: boolean;
};

export function useVersionDiffLookup(projectName: string, version: string): VersionDiffLookup {
  const { data: diff } = useVersionDiff(projectName, version);

  const diffByTableId = new Map<string, TableDiff>();
  const diffByTableKey = new Map<string, TableDiff>();
  const diffByFieldId = new Map<string, FieldDiff>();
  const diffByFieldKey = new Map<string, FieldDiff>();

  if (diff) {
    for (const td of diff.tableDiffs) {
      diffByTableId.set(td.tableId, td);
      diffByTableKey.set(td.tableKey, td);
      for (const fd of td.fieldDiffs) {
        diffByFieldId.set(fd.fieldId, fd);
        diffByFieldKey.set(fd.fieldKey, fd);
      }
    }
  }

  return {
    diffByTableId,
    diffByTableKey,
    diffByFieldId,
    diffByFieldKey,
    hasAny: Boolean(diff && (diff.tableDiffs.length > 0 || diff.enumDiffs.length > 0)),
    hasBreaking: diff?.hasBreaking ?? false,
  };
}
