"use client";

import { useQuery } from "@tanstack/react-query";
import type { TableDiff, FieldDiff, EnumDiff, RelationDiff, VersionDiff } from "@/lib/version-diff/detect-changes";

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

export type FkCascadeInfo = {
  targetTableName: string;
  fromType: string;
  toType: string;
};

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
  // tableName → fieldName → FkCascadeInfo (Relations workflow: FK type mismatches)
  fkCascadeMap: Map<string, Map<string, FkCascadeInfo>>;
  // enumKey → EnumDiff (Enums workflow)
  diffByEnumId: Map<string, EnumDiff>;
  // stable relationId → RelationDiff (Relations workflow: added/removed relations)
  relationDiffs: RelationDiff[];
  // stable relationId → RelationDiff (for per-card lookup on relation cards)
  diffByRelationId: Map<string, RelationDiff>;
  hasAny: boolean;
  hasBreaking: boolean;
};

export function useVersionDiffLookup(projectName: string, version: string): VersionDiffLookup {
  const { data: diff } = useVersionDiff(projectName, version);

  const diffByTableId = new Map<string, TableDiff>();
  const diffByTableKey = new Map<string, TableDiff>();
  const diffByFieldId = new Map<string, FieldDiff>();
  const diffByFieldKey = new Map<string, FieldDiff>();
  const fkCascadeMap = new Map<string, Map<string, FkCascadeInfo>>();
  const diffByEnumId = new Map<string, EnumDiff>();
  const diffByRelationId = new Map<string, RelationDiff>();

  if (diff) {
    for (const rd of diff.relationDiffs) {
      diffByRelationId.set(rd.relationId, rd);
    }
    for (const ed of diff.enumDiffs) {
      diffByEnumId.set(ed.enumId, ed);
    }
    for (const td of diff.tableDiffs) {
      diffByTableId.set(td.tableId, td);
      diffByTableKey.set(td.tableKey, td);
      for (const fd of td.fieldDiffs) {
        diffByFieldId.set(fd.fieldId, fd);
        diffByFieldKey.set(fd.fieldKey, fd);
        if (fd.isPk && fd.severity === "breaking" && fd.cascade.length > 0) {
          for (const hint of fd.cascade) {
            let inner = fkCascadeMap.get(hint.tableName);
            if (!inner) { inner = new Map(); fkCascadeMap.set(hint.tableName, inner); }
            inner.set(hint.fieldName, { targetTableName: td.tableName, fromType: fd.from, toType: fd.to });
          }
        }
      }
    }
  }

  return {
    diffByTableId,
    diffByTableKey,
    diffByFieldId,
    diffByFieldKey,
    fkCascadeMap,
    diffByEnumId,
    relationDiffs: diff?.relationDiffs ?? [],
    diffByRelationId,
    hasAny: Boolean(diff && (diff.tableDiffs.length > 0 || diff.enumDiffs.length > 0 || diff.relationDiffs.length > 0)),
    hasBreaking: diff?.hasBreaking ?? false,
  };
}
