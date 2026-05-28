"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useTRPC } from "@/trpc/client";
import {
  ApproveWarningButton,
  EnumValueReplacementPicker,
} from "@/app/views/shared/version-diff-badge";
import type { SchemaWarning } from "@/lib/schema-warnings-store";

// ─── severity helpers ─────────────────────────────────────────────────────────

type Severity = "breaking" | "warning" | "info" | "approved";

function resolutionSeverity(w: SchemaWarning): Severity {
  if (w.approvedAt) return "approved";
  if (w.resolution === "data_deleted") return "breaking";
  if (w.resolution === "lossy_convert" || w.resolution === "precision_loss" || w.resolution === "backfill_required") return "warning";
  return "info";
}

const severityConfig: Record<Severity, { row: string; badge: string; label: string; dot: string }> = {
  breaking: { row: "bg-red-50/60",    badge: "border-red-200 bg-red-50 text-red-700",              label: "Breaking", dot: "bg-red-500"     },
  warning:  { row: "bg-amber-50/40",  badge: "border-amber-200 bg-amber-50 text-amber-700",         label: "Warning",  dot: "bg-amber-500"   },
  info:     { row: "",                badge: "border-sky-200 bg-sky-50 text-sky-700",                label: "Info",     dot: "bg-sky-400"     },
  approved: { row: "opacity-60",      badge: "border-emerald-200 bg-emerald-50 text-emerald-700",   label: "Approved", dot: "bg-emerald-400" },
};

function SeverityBadge({ w }: { w: SchemaWarning }) {
  const c = severityConfig[resolutionSeverity(w)];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded border px-1.5 py-0.5 text-[10px] font-semibold leading-none ${c.badge}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
}

// ─── navigate links ────────────────────────────────────────────────────────────

function navHref(w: SchemaWarning): string {
  if (w.entityKind === "field") return `/schema?table=${w.entityName.split(".")[0] ?? ""}`;
  if (w.entityKind === "enum") return "/enums";
  if (w.entityKind === "relation") return "/relations";
  return "/tables";
}

// ─── action cell ──────────────────────────────────────────────────────────────

function ActionCell({
  warning,
  enumValuesMap,
  approve,
}: {
  warning: SchemaWarning;
  enumValuesMap: Record<string, string[]>;
  approve: (id: string, replacementValue?: string) => Promise<void>;
}) {
  if (warning.approvedAt) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
        Approved
        {warning.replacementValue && (
          <code className="ml-1 rounded bg-emerald-50 px-1 font-mono text-[10px] text-emerald-700">
            → {warning.replacementValue}
          </code>
        )}
      </span>
    );
  }
  if (warning.entityKind === "enum" && warning.changeKind === "value_removed") {
    const enumName = warning.entityName.split(".")[0] ?? "";
    const removedValue = warning.entityName.split(".")[1] ?? "";
    return (
      <EnumValueReplacementPicker
        warning={warning}
        removedValue={removedValue}
        availableValues={enumValuesMap[enumName] ?? []}
        onApprove={approve}
      />
    );
  }
  return <ApproveWarningButton warning={warning} onApprove={(id) => approve(id)} />;
}

// ─── restriction placeholder ──────────────────────────────────────────────────

const RESTRICTION_PLACEHOLDER = (
  <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
    <p className="text-sm font-semibold text-slate-600">No restriction warnings tracked.</p>
    <p className="mt-1 text-xs text-slate-400">
      Unique constraint and index changes are surfaced in the Restrictions workflow.
      Approval-gate tracking for restrictions is not yet implemented.
    </p>
  </div>
);

// ─── warning row ──────────────────────────────────────────────────────────────

function WarningRow({
  w,
  enumValuesMap,
  approve,
}: {
  w: SchemaWarning;
  enumValuesMap: Record<string, string[]>;
  approve: (id: string, replacementValue?: string) => Promise<void>;
}) {
  const c = severityConfig[resolutionSeverity(w)];
  return (
    <tr className={`${c.row} border-b border-slate-100 transition-colors last:border-0`}>
      <td className="py-3 pr-4 align-middle whitespace-nowrap">
        <SeverityBadge w={w} />
      </td>
      <td className="py-3 pr-4 align-middle font-semibold text-slate-800">
        {w.entityName}
      </td>
      <td className="py-3 pr-4 align-middle">
        <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-600">
          {w.changeKind}
        </code>
      </td>
      <td className="max-w-xs py-3 pr-4 align-middle text-xs text-slate-600">
        {w.message}
      </td>
      <td className="py-3 pr-4 align-middle whitespace-nowrap">
        {(w.fromValue || w.toValue) && (
          <span className="flex items-center gap-1 text-xs">
            {w.fromValue && <code className="rounded bg-slate-100 px-1 font-mono text-slate-600">{w.fromValue}</code>}
            {w.fromValue && w.toValue && <span className="text-slate-400">→</span>}
            {w.toValue && <code className="rounded bg-slate-100 px-1 font-mono text-slate-600">{w.toValue}</code>}
          </span>
        )}
      </td>
      <td className="py-3 pr-4 align-middle">
        <ActionCell warning={w} enumValuesMap={enumValuesMap} approve={approve} />
      </td>
      <td className="py-3 align-middle">
        <Link href={navHref(w)}
          className="rounded border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-600 transition hover:border-teal-300 hover:text-teal-700 whitespace-nowrap">
          View →
        </Link>
      </td>
    </tr>
  );
}

// ─── panel ────────────────────────────────────────────────────────────────────

export type WarningEntityKind = "table" | "field" | "enum" | "relation" | "restriction";

export function WarningsPanel({
  projectId,
  fromVersion,
  toVersion,
  entityKind,
}: {
  projectId: string;
  fromVersion: string;
  toVersion: string;
  entityKind: WarningEntityKind;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [showApproved, setShowApproved] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);

  const enabled = Boolean(projectId && fromVersion && toVersion) && entityKind !== "restriction";

  const { data, isLoading } = useQuery(
    trpc.tracking.warningsByKind.queryOptions(
      {
        projectId,
        fromVersion,
        toVersion,
        entityKind: entityKind as "table" | "field" | "enum" | "relation",
      },
      { enabled },
    ),
  );

  const warnings: SchemaWarning[] = data?.warnings ?? [];
  const enumValuesMap = data?.enumValuesMap ?? {};
  const pending = warnings.filter((w) => !w.approvedAt);
  const approved = warnings.filter((w) => !!w.approvedAt);

  async function invalidate() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["trpc", "tracking", "warningsByKind"] }),
      queryClient.invalidateQueries({ queryKey: ["trpc", "tracking", "pendingCounts"] }),
      queryClient.invalidateQueries({ queryKey: ["schema-warnings"] }),
    ]);
  }

  async function approve(id: string, replacementValue?: string) {
    await fetch(`/api/schema-warnings/${id}`, {
      method: "PATCH",
      headers: replacementValue ? { "Content-Type": "application/json" } : {},
      body: replacementValue ? JSON.stringify({ replacementValue }) : undefined,
    });
    await invalidate();
  }

  async function approveAll() {
    if (pending.length === 0) return;
    setBulkBusy(true);
    await fetch("/api/schema-warnings/bulk-approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: pending.map((w) => w.id) }),
    });
    await invalidate();
    setBulkBusy(false);
  }

  async function unapproveAll() {
    if (approved.length === 0) return;
    setBulkBusy(true);
    await fetch("/api/schema-warnings/bulk-unapprove", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: approved.map((w) => w.id) }),
    });
    await invalidate();
    setShowApproved(false);
    setBulkBusy(false);
  }

  if (entityKind === "restriction") return RESTRICTION_PLACEHOLDER;

  if (isLoading) {
    return <div className="py-10 text-center text-sm font-medium text-slate-500">Loading…</div>;
  }

  if (warnings.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
        <p className="text-sm font-semibold text-slate-600">No warnings for this category.</p>
        <p className="mt-1 text-xs text-slate-400">
          No changes requiring approval were detected between {fromVersion} and {toVersion}.
        </p>
      </div>
    );
  }

  const TABLE_HEADERS = ["Severity", "Entity", "Change", "Message", "From → To", "Action", "View"] as const;

  return (
    <div className="space-y-4">
      {/* ── Bulk action bar ── */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {pending.length > 0 && (
            <span className="text-xs font-medium text-slate-500">
              <span className="font-semibold text-red-600">{pending.length}</span> pending
            </span>
          )}
          {approved.length > 0 && (
            <span className="text-xs font-medium text-slate-500">
              · <span className="font-semibold text-emerald-600">{approved.length}</span> approved
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {pending.length > 0 && (
            <button
              type="button"
              disabled={bulkBusy}
              onClick={approveAll}
              className="inline-flex items-center gap-1.5 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {bulkBusy ? "…" : "✓ Approve all"}
            </button>
          )}
          {approved.length > 0 && (
            <button
              type="button"
              disabled={bulkBusy}
              onClick={unapproveAll}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-400 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {bulkBusy ? "…" : "↩ Unapprove all"}
            </button>
          )}
        </div>
      </div>

      {/* ── All approved state ── */}
      {pending.length === 0 && approved.length > 0 && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-emerald-700">
            All {approved.length} warning{approved.length !== 1 ? "s" : ""} approved ✓
          </p>
        </div>
      )}

      {/* ── Pending rows ── */}
      {pending.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                {TABLE_HEADERS.map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-400 first:pl-4">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pending.map((w) => (
                <WarningRow key={w.id} w={w} enumValuesMap={enumValuesMap} approve={approve} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Approved — collapsible ── */}
      {approved.length > 0 && pending.length > 0 && (
        <button
          type="button"
          onClick={() => setShowApproved((v) => !v)}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-slate-600 transition"
        >
          <span className={`inline-block transition-transform ${showApproved ? "rotate-90" : ""}`}>▶</span>
          {showApproved ? "Hide" : "Show"} {approved.length} approved
        </button>
      )}
      {showApproved && approved.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-emerald-100">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-slate-100">
              {approved.map((w) => (
                <WarningRow key={w.id} w={w} enumValuesMap={enumValuesMap} approve={approve} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
