"use client";

import { useState } from "react";
import Link from "next/link";
import type { SchemaWarning } from "@/lib/schema-warnings-store";
import { warningNavHref } from "@/lib/tracking-utils";
import { ResolveModal } from "@/components/tracking/resolve-modal";
import { SeverityBadge } from "@/components/tracking/severity-badge";
import { StrategyBadge } from "@/components/tracking/strategy-badge";
import { WarningCellContent } from "@/components/tracking/warning-cell-content";

function ApproveCell({
  warning, canApprove, pendingValue, onApprove, onUnapprove,
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
      <button type="button" disabled={busy}
        onClick={async () => { setBusy(true); await onUnapprove(warning.id); setBusy(false); }}
        title="Undo approval"
        className="h-7 w-7 rounded-full border border-rose-300 text-rose-500 flex items-center justify-center text-sm font-bold transition hover:bg-rose-50 hover:border-rose-400 disabled:opacity-40">
        {busy ? "…" : "✗"}
      </button>
    );
  }

  return (
    <button type="button" disabled={!canApprove || busy}
      title={canApprove ? "Approve" : "Set a value first"}
      onClick={async () => {
        setBusy(true);
        await onApprove(warning.id, pendingValue.trim() || undefined);
        setBusy(false);
      }}
      className={`h-7 w-7 rounded-full border text-sm font-bold transition flex items-center justify-center ${
        canApprove
          ? "border-emerald-300 text-emerald-600 hover:bg-emerald-50 hover:border-emerald-400"
          : "border-slate-200 text-slate-300 cursor-not-allowed"
      }`}>
      {busy ? "…" : "✓"}
    </button>
  );
}

export function WarningRow({
  w, enumValuesMap, approve, unapprove, remap: _remap,
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

  const isEnumRemoval  = w.entityKind === "enum" && w.changeKind === "value_removed";
  const isFieldDefault = w.entityKind === "field" &&
    (w.resolution === "backfill_required" || w.resolution === "lossy_convert" || w.resolution === "precision_loss") &&
    w.targetNullable !== null;

  const needsResolution = (isEnumRemoval || (isFieldDefault && !isNullable)) && !w.approvedAt;
  const canApprove = isEnumRemoval
    ? pendingValue.trim().length > 0
    : isFieldDefault && !isNullable ? pendingValue.trim().length > 0 : true;

  return (
    <>
      <tr className={`${rowBg} border-b border-slate-100 transition-colors last:border-0`}>
        <td className="py-3 pl-4 pr-4 align-middle whitespace-nowrap">
          <SeverityBadge w={w} />
        </td>
        <td className="py-3 pr-4 align-middle font-semibold text-slate-800">{w.entityName}</td>
        <td className="py-3 pr-4 align-middle">
          <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-600">{w.changeKind}</code>
        </td>
        <td className="max-w-xs py-3 pr-4 align-middle text-xs text-slate-600">{w.message}</td>
        <td className="py-3 pr-4 align-middle whitespace-nowrap">
          {(w.fromValue || w.toValue) && (
            <span className="flex items-center gap-1 text-xs">
              {w.fromValue && <code className="rounded bg-slate-100 px-1 font-mono text-slate-600">{w.fromValue}</code>}
              {w.fromValue && w.toValue && <span className="text-slate-400">→</span>}
              {w.toValue && <code className="rounded bg-slate-100 px-1 font-mono text-slate-600">{w.toValue}</code>}
            </span>
          )}
        </td>
        <td className="py-3 pr-4 align-middle"><WarningCellContent w={w} /></td>
        <td className="py-3 pr-4 align-middle">
          {needsResolution ? (
            <button type="button" onClick={() => setResolveOpen(true)}
              className="h-7 rounded-md border border-rose-300 bg-rose-50 px-3 text-xs font-semibold text-rose-700 transition hover:bg-rose-100">
              Resolve
            </button>
          ) : (
            <StrategyBadge w={w} />
          )}
        </td>
        <td className="py-3 pr-4 align-middle text-center">
          <ApproveCell warning={w} canApprove={canApprove} pendingValue={pendingValue} onApprove={approve} onUnapprove={unapprove} />
        </td>
        <td className="py-3 pr-4 align-middle">
          <Link href={warningNavHref(w)}
            className="rounded border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-600 transition hover:border-teal-300 hover:text-teal-700 whitespace-nowrap">
            View →
          </Link>
        </td>
      </tr>

      {resolveOpen && (
        <ResolveModal
          warning={w} pendingValue={pendingValue} setPendingValue={setPendingValue}
          enumValuesMap={enumValuesMap} onApprove={approve} onClose={() => setResolveOpen(false)}
        />
      )}
    </>
  );
}
