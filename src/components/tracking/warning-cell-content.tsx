"use client";

import type { SchemaWarning } from "@/lib/schema-warnings-store";

export function WarningCellContent({ w }: { w: SchemaWarning }) {
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

  if (w.approvedAt) return <span className="text-[10px] font-semibold text-emerald-600">✓ Acknowledged</span>;
  return <span className="text-[10px] text-slate-400">—</span>;
}
