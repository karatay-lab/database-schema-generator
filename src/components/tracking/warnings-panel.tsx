"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useTRPC } from "@/trpc/client";
import type { SchemaWarning } from "@/lib/schema-warnings-store";
import { ResolveModal } from "@/components/tracking/resolve-modal";

type Severity = "breaking" | "warning" | "info" | "approved";

function resolutionSeverity(w: SchemaWarning): Severity {
  if (w.approvedAt) {
    if (
      w.resolution === "backfill_required" &&
      w.targetNullable === false &&
      !w.replacementValue
    ) return "warning";
    return "approved";
  }
  if (w.resolution === "data_deleted") return "breaking";
  if (
    w.resolution === "lossy_convert" ||
    w.resolution === "precision_loss" ||
    w.resolution === "backfill_required"
  )
    return "warning";
  return "info";
}

const severityConfig: Record<
  Severity,
  { row: string; badge: string; label: string; dot: string }
> = {
  breaking: {
    row: "bg-red-50/60",
    badge: "border-red-200 bg-red-50 text-red-700",
    label: "Breaking",
    dot: "bg-red-500",
  },
  warning: {
    row: "bg-amber-50/40",
    badge: "border-amber-200 bg-amber-50 text-amber-700",
    label: "Warning",
    dot: "bg-amber-500",
  },
  info: {
    row: "",
    badge: "border-sky-200 bg-sky-50 text-sky-700",
    label: "Info",
    dot: "bg-sky-400",
  },
  approved: {
    row: "bg-emerald-50/40",
    badge: "border-emerald-200 bg-emerald-50 text-emerald-600",
    label: "Approved",
    dot: "bg-emerald-400",
  },
};

function SeverityBadge({ w }: { w: SchemaWarning }) {
  const c = severityConfig[resolutionSeverity(w)];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded border px-1.5 py-0.5 text-[10px] font-semibold leading-none ${c.badge}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
}

function navHref(w: SchemaWarning): string {
  if (w.entityKind === "field") return `/schema?table=${w.entityName.split(".")[0] ?? ""}`;
  if (w.entityKind === "enum") return "/enums";
  if (w.entityKind === "relation") return "/relations";
  return "/tables";
}

function ApproveCell({
  warning,
  canApprove,
  pendingValue,
  onApprove,
  onUnapprove,
}: {
  warning: SchemaWarning;
  canApprove: boolean;
  pendingValue: string;
  onApprove: (id: string, replacementValue?: string) => Promise<void>;
  onUnapprove: (id: string) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);

  if (warning.approvedAt) {
    return (
      <button
        type="button"
        disabled={busy}
        onClick={async () => { setBusy(true); await onUnapprove(warning.id); setBusy(false); }}
        title="Undo approval"
        className="h-7 w-7 rounded-full border border-rose-300 text-rose-500 flex items-center justify-center text-sm font-bold transition hover:bg-rose-50 hover:border-rose-400 disabled:opacity-40"
      >
        {busy ? "…" : "✗"}
      </button>
    );
  }

  return (
    <button
      type="button"
      disabled={!canApprove || busy}
      title={canApprove ? "Approve" : "Set a value first"}
      onClick={async () => {
        setBusy(true);
        const val = pendingValue.trim() || undefined;
        await onApprove(warning.id, val);
        setBusy(false);
      }}
      className={`h-7 w-7 rounded-full border text-sm font-bold transition flex items-center justify-center ${
        canApprove
          ? "border-emerald-300 text-emerald-600 hover:bg-emerald-50 hover:border-emerald-400"
          : "border-slate-200 text-slate-300 cursor-not-allowed"
      }`}
    >
      {busy ? "…" : "✓"}
    </button>
  );
}

const STRATEGIES_BY_KIND: Record<string, StrategyName[]> = {
  table:       ["Data Dropped", "Acknowledged"],
  enum:        ["Remapped", "Set NULL", "Data Dropped", "Acknowledged"],
  field:       ["Unique Prefix + UUID", "Static Default", "Type Cast", "Set NULL", "Data Dropped", "Acknowledged"],
  relation:    ["Data Dropped", "Acknowledged"],
  restriction: ["Acknowledged"],
};

type StrategyName =
  | "Unique Prefix + UUID"
  | "Static Default"
  | "Set NULL"
  | "Type Cast"
  | "Remapped"
  | "Data Dropped"
  | "Acknowledged"
  | "Pending";

const strategyStyle: Record<StrategyName, { cls: string }> = {
  "Unique Prefix + UUID": { cls: "border-violet-200 bg-violet-50 text-violet-700" },
  "Static Default":       { cls: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  "Set NULL":             { cls: "border-slate-200 bg-slate-50 text-slate-500" },
  "Type Cast":            { cls: "border-sky-200 bg-sky-50 text-sky-700" },
  "Remapped":             { cls: "border-amber-200 bg-amber-50 text-amber-700" },
  "Data Dropped":         { cls: "border-rose-200 bg-rose-50 text-rose-700" },
  "Acknowledged":         { cls: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  "Pending":              { cls: "border-slate-200 bg-white text-slate-400" },
};

function StrategyLegend({
  entityKind,
  title,
  description,
  color,
  pendingCount,
  incompleteCount,
}: {
  entityKind: string;
  title?: string;
  description?: string;
  color?: string;
  pendingCount?: number;
  incompleteCount?: number;
}) {
  const names = STRATEGIES_BY_KIND[entityKind] ?? Object.keys(strategyStyle) as StrategyName[];
  const allStrategies: { name: StrategyName; desc: string }[] = [
    { name: "Unique Prefix + UUID", desc: "Your prefix + a random UUID per row — each row gets a distinct value. Used for unique String fields." },
    { name: "Static Default",       desc: "The same value is written to all existing rows." },
    { name: "Type Cast",            desc: "Existing string values cast to the new type (e.g. String → Enum). Only valid members survive." },
    { name: "Remapped",             desc: "Removed enum values redirected to a chosen replacement before migration." },
    { name: "Set NULL",             desc: "Field set to NULL for all existing rows. Only valid for nullable target fields." },
    { name: "Data Dropped",         desc: "Column or table removed entirely. All existing data permanently deleted." },
    { name: "Acknowledged",         desc: "Change approved — no data transformation needed. Values carry over as-is." },
  ];
  const visible = allStrategies.filter((s) => names.includes(s.name));
  return (
    <div className={`rounded-lg border p-4 ${
      (pendingCount ?? 0) > 0 ? "border-red-200 bg-red-50/50" :
      (incompleteCount ?? 0) > 0 ? "border-amber-200 bg-amber-50/50" :
      "border-slate-200 bg-slate-50"
    }`}>
      {title && (
        <div className="mb-3 flex items-start justify-between gap-4">
          <div className="flex items-start gap-2.5">
            {color && <span className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ${color}`} />}
            <div>
              <p className="font-semibold text-slate-950">{title}</p>
              {description && <p className="mt-0.5 text-xs text-slate-500 leading-relaxed">{description}</p>}
            </div>
          </div>
          {((pendingCount ?? 0) > 0 || (incompleteCount ?? 0) > 0) && (
            <span className={`shrink-0 rounded-md border px-2.5 py-1 text-xs font-semibold ${
              (pendingCount ?? 0) > 0 ? "border-red-200 bg-white text-red-700" : "border-amber-200 bg-white text-amber-700"
            }`}>
              {(pendingCount ?? 0) > 0
                ? `${pendingCount} need${pendingCount === 1 ? "s" : ""} approval`
                : `${incompleteCount} need${incompleteCount === 1 ? "s" : ""} default value`}
            </span>
          )}
        </div>
      )}
      <p className={`${title ? "mt-3 pt-3 border-t border-slate-200/70" : ""} mb-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400`}>Resolution Strategies</p>
      <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-4">
        {visible.map(({ name, desc }) => {
          const { cls } = strategyStyle[name];
          return (
            <div key={name} className="flex flex-col gap-1">
              <span className={`inline-flex w-fit items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold ${cls}`}>
                {name}
              </span>
              <p className="text-[10px] text-slate-500 leading-relaxed">{desc}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function resolveStrategy(w: SchemaWarning): StrategyName {
  if (!w.approvedAt) return "Pending";
  if (w.entityKind === "restriction") return "Acknowledged";

  if (w.entityKind === "enum" && w.changeKind === "value_removed") {
    return w.replacementValue ? "Remapped" : "Set NULL";
  }

  if (w.entityKind === "field") {
    const isUniquePrefix = w.targetUnique === true &&
      !["Int","BigInt","Float","Decimal","Boolean","DateTime","Json","Bytes"].includes(w.toValue ?? "");
    const isNullable = w.targetNullable === true;

    if (w.resolution === "data_deleted" && w.changeKind !== "type_changed" && w.changeKind !== "multiple") {
      return "Data Dropped";
    }
    if ((w.changeKind === "type_changed" || w.changeKind === "multiple") && !w.replacementValue) {
      return "Type Cast";
    }
    if (w.replacementValue) {
      return isUniquePrefix ? "Unique Prefix + UUID" : "Static Default";
    }
    if (isNullable) return "Set NULL";
    return "Acknowledged";
  }

  return "Acknowledged";
}

function StrategyBadge({ w }: { w: SchemaWarning }) {
  if (!w.approvedAt) return null;
  const name = resolveStrategy(w);
  const { cls } = strategyStyle[name];
  return (
    <span className={`inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-semibold ${cls}`}>
      {name}
    </span>
  );
}

function WarningCellContent({ w }: { w: SchemaWarning }) {
  const isNullable = w.targetNullable === true;

  if (w.entityKind === "enum" && w.changeKind === "value_removed") {
    const removedValue = w.entityName.split(".")[1] ?? "";
    if (w.approvedAt && w.replacementValue) {
      return (
        <span className="flex items-center gap-1 text-xs">
          <code className="font-mono text-slate-400 line-through">{removedValue}</code>
          <span className="text-slate-400">→</span>
          <code className="rounded bg-emerald-100 px-1 font-mono text-emerald-700">{w.replacementValue}</code>
        </span>
      );
    }
    return (
      <span className="text-xs text-amber-600 font-medium">
        ⚠ No mapping — <code className="font-mono">{removedValue}</code> has no replacement
      </span>
    );
  }

  if (
    w.entityKind === "field" &&
    (w.resolution === "backfill_required" || w.resolution === "lossy_convert" || w.resolution === "precision_loss") &&
    w.targetNullable !== null
  ) {
    if (w.approvedAt && w.replacementValue) {
      return (
        <code className="rounded bg-emerald-100 px-1.5 py-0.5 font-mono text-xs text-emerald-700">
          ✓ &quot;{w.replacementValue}&quot;
        </code>
      );
    }
    if (w.approvedAt && !w.replacementValue) {
      return isNullable
        ? <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">→ NULL</span>
        : <span className="text-xs font-medium text-rose-500">⚠ No default — auto-generated placeholder</span>;
    }
    return isNullable
      ? <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400">will be NULL</span>
      : <span className="text-xs text-amber-600">auto-generated placeholder</span>;
  }

  if (w.approvedAt) {
    return <span className="text-[10px] font-semibold text-emerald-600">✓ Acknowledged</span>;
  }
  return <span className="text-[10px] text-slate-400">—</span>;
}

function WarningRow({
  w,
  enumValuesMap,
  approve,
  unapprove,
  remap: _remap,
}: {
  w: SchemaWarning;
  enumValuesMap: Record<string, string[]>;
  approve: (id: string, replacementValue?: string) => Promise<void>;
  unapprove: (id: string) => Promise<void>;
  remap: (id: string, replacementValue: string) => Promise<void>;
}) {
  const [pendingValue, setPendingValue] = useState(w.replacementValue ?? "");
  const [resolveOpen, setResolveOpen] = useState(false);
  const rowBg = w.approvedAt ? "bg-emerald-50/60" : "bg-rose-50/60";
  const isNullable = w.targetNullable === true;

  const isEnumRemoval = w.entityKind === "enum" && w.changeKind === "value_removed";
  const isFieldDefault =
    w.entityKind === "field" &&
    (w.resolution === "backfill_required" || w.resolution === "lossy_convert" || w.resolution === "precision_loss") &&
    w.targetNullable !== null;

  const needsResolution = (isEnumRemoval || (isFieldDefault && !isNullable)) && !w.approvedAt;

  const canApprove = isEnumRemoval
    ? pendingValue.trim().length > 0
    : isFieldDefault && !isNullable
      ? pendingValue.trim().length > 0
      : true;

  return (
  <>
    <tr className={`${rowBg} border-b border-slate-100 transition-colors last:border-0`}>
      <td className="py-3 pl-4 pr-4 align-middle whitespace-nowrap">
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
        <WarningCellContent w={w} />
      </td>
      <td className="py-3 pr-4 align-middle">
        {needsResolution ? (
          <button
            type="button"
            onClick={() => setResolveOpen(true)}
            className="h-7 rounded-md border border-rose-300 bg-rose-50 px-3 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
          >
            Resolve
          </button>
        ) : (
          <StrategyBadge w={w} />
        )}
      </td>
      <td className="py-3 pr-4 align-middle text-center">
        <ApproveCell
          warning={w}
          canApprove={canApprove}
          pendingValue={pendingValue}
          onApprove={approve}
          onUnapprove={unapprove}
        />
      </td>
      <td className="py-3 pr-4 align-middle">
        <Link
          href={navHref(w)}
          className="rounded border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-600 transition hover:border-teal-300 hover:text-teal-700 whitespace-nowrap"
        >
          View →
        </Link>
      </td>
    </tr>

    {resolveOpen && (
      <ResolveModal
        warning={w}
        pendingValue={pendingValue}
        setPendingValue={setPendingValue}
        enumValuesMap={enumValuesMap}
        onApprove={approve}
        onClose={() => setResolveOpen(false)}
      />
    )}
  </>
  );
}

export type WarningEntityKind =
  | "table"
  | "field"
  | "enum"
  | "relation"
  | "restriction";

export function WarningsPanel({
  projectId,
  fromVersion,
  toVersion,
  entityKind,
  title,
  description,
  color,
  pendingCount: externalPendingCount,
  incompleteCount: externalIncompleteCount,
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

  const enabled = Boolean(projectId && fromVersion && toVersion);

  const queryOptions = trpc.tracking.warningsByKind.queryOptions(
    {
      projectId,
      fromVersion,
      toVersion,
      entityKind: entityKind as "table" | "field" | "enum" | "relation",
    },
    { enabled },
  );

  const { data, isLoading } = useQuery(queryOptions);

  const warnings: SchemaWarning[] = data?.warnings ?? [];
  const enumValuesMap = data?.enumValuesMap ?? {};
  const pending = warnings.filter((w) => !w.approvedAt);
  const approved = warnings.filter((w) => !!w.approvedAt);
  const incomplete = approved.filter(
    (w) =>
      !w.replacementValue &&
      w.targetNullable === false &&
      (w.resolution === "backfill_required" ||
       w.resolution === "lossy_convert" ||
       w.resolution === "precision_loss"),
  );
  const fullyApproved = approved.length - incomplete.length;

  async function invalidate() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryOptions.queryKey }),
      queryClient.invalidateQueries({
        queryKey: trpc.tracking.pendingCounts.queryOptions({
          projectId,
          fromVersion,
          toVersion,
        }).queryKey,
      }),
    ]);
  }

  async function approve(id: string, replacementValue?: string) {
    await fetch(`/api/schema-warnings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(replacementValue ? { replacementValue } : {}),
    });
    await invalidate();
  }

  async function unapprove(id: string) {
    await fetch(`/api/schema-warnings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "unapprove" }),
    });
    await invalidate();
  }

  async function remap(id: string, replacementValue: string) {
    await fetch(`/api/schema-warnings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "remap", replacementValue }),
    });
    await invalidate();
  }

  async function approveAll() {
    if (pending.length === 0) return;
    const bulkApprovable = pending.filter(
      (w) => !(w.entityKind === "enum" && w.changeKind === "value_removed"),
    );
    if (bulkApprovable.length === 0) return;
    setBulkBusy(true);
    await fetch("/api/schema-warnings/bulk-approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: bulkApprovable.map((w) => w.id) }),
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
    setBulkBusy(false);
  }

  if (isLoading) {
    return (
      <div className="py-10 text-center text-sm font-medium text-slate-500">
        Loading…
      </div>
    );
  }

  if (warnings.length === 0) {
    return (
      <div className="space-y-4">
        <StrategyLegend
          entityKind={entityKind}
          title={title}
          description={description}
          color={color}
          pendingCount={externalPendingCount}
          incompleteCount={externalIncompleteCount}
        />
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
          <p className="text-sm font-semibold text-slate-600">No warnings for this category.</p>
          <p className="mt-1 text-xs text-slate-400">
            No changes requiring approval were detected between {fromVersion} and {toVersion}.
          </p>
        </div>
      </div>
    );
  }

  const TABLE_HEADERS = [
    "Severity", "Entity", "Change", "Message", "From → To",
    "Warning", "Resolve", "Approve", "View",
  ] as const;

  return (
    <div className="space-y-3">
      <StrategyLegend
        entityKind={entityKind}
        title={title}
        description={description}
        color={color}
        pendingCount={externalPendingCount}
        incompleteCount={externalIncompleteCount}
      />

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
          {pending.length > 0 && (
            <span><span className="font-semibold text-red-600">{pending.length}</span>{" "}pending</span>
          )}
          {pending.length > 0 && approved.length > 0 && <span className="text-slate-300">·</span>}
          {fullyApproved > 0 && (
            <span><span className="font-semibold text-emerald-600">{fullyApproved}</span>{" "}approved</span>
          )}
          {incomplete.length > 0 && (
            <>
              {fullyApproved > 0 && <span className="text-slate-300">·</span>}
              <span><span className="font-semibold text-amber-600">{incomplete.length}</span>{" "}need{incomplete.length === 1 ? "s" : ""} default value</span>
            </>
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
              className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {bulkBusy ? "…" : "✗ Unapprove all"}
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              {TABLE_HEADERS.map((h) => (
                <th
                  key={h}
                  className={`px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400 first:pl-4 ${h === "Approve" ? "text-center" : "text-left"}`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {warnings.map((w) => (
              <WarningRow
                key={w.id}
                w={w}
                enumValuesMap={enumValuesMap}
                approve={approve}
                unapprove={unapprove}
                remap={remap}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
