"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import type { SchemaWarning } from "@/lib/schema-warnings-store";
import { useWarningsByKindQuery } from "@/queries/tracking";
import { ResolveModal } from "@/components/tracking/resolve-modal";
import { StrategyLegend } from "@/components/tracking/strategy-legend";
import { WarningRow } from "@/components/tracking/warning-row";
import { LoadingCard, Pagination } from "@/components/built";

export type WarningEntityKind = "table" | "field" | "enum" | "relation" | "restriction";

export function WarningsPanel({
  projectId, fromVersion, toVersion, entityKind,
  title, description, color, pendingCount: externalPendingCount, incompleteCount: externalIncompleteCount,
}: {
  projectId: string;
  fromVersion: string;
  toVersion: string;
  entityKind: WarningEntityKind;
  title?: string;
  description?: string;
  color?: string;
  pendingCount?: number;
  incompleteCount?: number;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [bulkBusy, setBulkBusy] = useState(false);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  // Reset to page 1 when the user switches tabs, versions, or entity kind
  useEffect(() => { setPage(1); }, [projectId, fromVersion, toVersion, entityKind]);

  const { data, isLoading } = useWarningsByKindQuery(projectId, fromVersion, toVersion, entityKind);
  const warningsQueryKey = trpc.tracking.warningsByKind.queryOptions({
    projectId, fromVersion, toVersion, entityKind: entityKind as "table" | "field" | "enum" | "relation",
  }).queryKey;

  const warnings: SchemaWarning[] = data?.warnings ?? [];
  const enumValuesMap = data?.enumValuesMap ?? {};
  const pending   = warnings.filter((w) => !w.approvedAt);
  const approved  = warnings.filter((w) => !!w.approvedAt);
  const incomplete = approved.filter(
    (w) => !w.replacementValue && w.targetNullable === false &&
      (w.resolution === "backfill_required" || w.resolution === "lossy_convert" || w.resolution === "precision_loss"),
  );
  const fullyApproved = approved.length - incomplete.length;

  async function invalidate() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: warningsQueryKey }),
      queryClient.invalidateQueries({
        queryKey: trpc.tracking.pendingCounts.queryOptions({ projectId, fromVersion, toVersion }).queryKey,
      }),
    ]);
  }

  async function approve(id: string, replacementValue?: string) {
    await fetch(`/api/schema-warnings/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(replacementValue ? { replacementValue } : {}),
    });
    await invalidate();
  }

  async function unapprove(id: string) {
    await fetch(`/api/schema-warnings/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "unapprove" }),
    });
    await invalidate();
  }

  async function remap(id: string, replacementValue: string) {
    await fetch(`/api/schema-warnings/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "remap", replacementValue }),
    });
    await invalidate();
  }

  async function approveAll() {
    const bulkApprovable = pending.filter((w) => !(w.entityKind === "enum" && w.changeKind === "value_removed"));
    if (bulkApprovable.length === 0) return;
    setBulkBusy(true);
    await fetch("/api/schema-warnings/bulk-approve", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: bulkApprovable.map((w) => w.id) }),
    });
    await invalidate();
    setBulkBusy(false);
  }

  async function unapproveAll() {
    if (approved.length === 0) return;
    setBulkBusy(true);
    await fetch("/api/schema-warnings/bulk-unapprove", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: approved.map((w) => w.id) }),
    });
    await invalidate();
    setBulkBusy(false);
  }

  if (isLoading) return <LoadingCard bordered={false} />;

  const legendProps = { entityKind, title, description, color, pendingCount: externalPendingCount, incompleteCount: externalIncompleteCount };

  if (warnings.length === 0) {
    return (
      <div className="space-y-4">
        <StrategyLegend {...legendProps} />
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
          <p className="text-sm font-semibold text-slate-600">No warnings for this category.</p>
          <p className="mt-1 text-xs text-slate-400">
            No changes requiring approval were detected between {fromVersion} and {toVersion}.
          </p>
        </div>
      </div>
    );
  }

  const pageCount = Math.max(1, Math.ceil(warnings.length / PAGE_SIZE));
  const pagedWarnings = warnings.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const TABLE_HEADERS = ["Severity", "Entity", "Change", "Message", "From → To", "Warning", "Resolve", "Approve", "View"] as const;

  return (
    <div className="space-y-3">
      <StrategyLegend {...legendProps} />

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
          {pending.length > 0 && <span><span className="font-semibold text-red-600">{pending.length}</span> pending</span>}
          {pending.length > 0 && approved.length > 0 && <span className="text-slate-300">·</span>}
          {fullyApproved > 0 && <span><span className="font-semibold text-emerald-600">{fullyApproved}</span> approved</span>}
          {incomplete.length > 0 && (
            <><span className="text-slate-300">·</span>
              <span><span className="font-semibold text-amber-600">{incomplete.length}</span> need{incomplete.length === 1 ? "s" : ""} default value</span></>
          )}
        </div>
        <div className="flex items-center gap-2">
          {pending.length > 0 && (
            <button type="button" disabled={bulkBusy} onClick={approveAll}
              className="inline-flex items-center gap-1.5 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50">
              {bulkBusy ? "…" : "✓ Approve all"}
            </button>
          )}
          {approved.length > 0 && (
            <button type="button" disabled={bulkBusy} onClick={unapproveAll}
              className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50">
              {bulkBusy ? "…" : "✗ Unapprove all"}
            </button>
          )}
        </div>
      </div>

      {/* Pagination above the table */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-slate-400">
          {warnings.length} warning{warnings.length !== 1 ? "s" : ""} ·{" "}
          page {page} of {pageCount}
        </p>
        <Pagination page={page} pageCount={pageCount} onPageChange={(p) => setPage(p)} />
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              {TABLE_HEADERS.map((h) => (
                <th key={h} className={`px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400 first:pl-4 ${h === "Approve" ? "text-center" : "text-left"}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pagedWarnings.map((w) => (
              <WarningRow key={w.id} w={w} enumValuesMap={enumValuesMap} approve={approve} unapprove={unapprove} remap={remap} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Re-export ResolveModal so existing imports from this file keep working
export { ResolveModal };
