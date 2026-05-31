"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { ModelComparisonResult } from "@/types/migrations";

export type DiffWarning = {
  severity: "error" | "warning";
  model: string;
  field?: string;
  message: string;
};

export function computeWarnings(c: ModelComparisonResult): DiffWarning[] {
  const out: DiffWarning[] = [];

  for (const m of c.removedModels) {
    out.push({ severity: "error", model: m.name, message: `Model "${m.name}" removed — all rows in this table will be dropped` });
  }

  for (const m of c.matchedModels) {
    if (m.nameChanged) {
      out.push({ severity: "warning", model: m.toName, message: `Model renamed "${m.fromName}" → "${m.toName}" — tracked by UUID, records will still map correctly` });
    }
    for (const f of m.matchedFields) {
      if (f.isRelation) continue;
      if (f.typeChanged) {
        out.push({ severity: "error", model: m.toName, field: f.toName, message: `Type changed ${f.fromType} → ${f.toType} — data loss or coercion failure possible` });
      }
      if (f.fromNullable && !f.toNullable) {
        out.push({ severity: "warning", model: m.toName, field: f.toName, message: `Nullable → Required — rows with null values will receive a generated placeholder` });
      }
      if (f.nameChanged && !f.typeChanged) {
        out.push({ severity: "warning", model: m.toName, field: f.toName, message: `Field renamed "${f.fromName}" → "${f.toName}" — tracked by UUID, values will carry over` });
      }
    }
    for (const f of m.removedFields) {
      out.push({ severity: "warning", model: m.toName, field: f.name, message: `Field "${f.name}" removed — data in this column will be dropped` });
    }
    for (const f of m.addedFields) {
      if (!f.nullable) {
        out.push({ severity: "warning", model: m.toName, field: f.name, message: `New required field "${f.name}" — existing rows will receive a generated placeholder value` });
      }
    }
  }

  return out;
}

export function DiffWarningsPanel({ warnings }: { warnings: DiffWarning[] }) {
  const [open, setOpen] = useState(false);
  if (warnings.length === 0) return null;

  const errors = warnings.filter((w) => w.severity === "error");
  const warns  = warnings.filter((w) => w.severity === "warning");

  return (
    <div className={cn("rounded-md border text-xs", errors.length > 0 ? "border-rose-200 bg-rose-50" : "border-amber-200 bg-amber-50")}>
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-2 px-3 py-2 text-left">
        <svg viewBox="0 0 16 16" fill="none" strokeWidth={2} stroke="currentColor"
          className={cn("h-3.5 w-3.5 shrink-0 transition-transform duration-150", open ? "rotate-90" : "")}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 4l4 4-4 4" />
        </svg>
        <span className={cn("font-semibold", errors.length > 0 ? "text-rose-700" : "text-amber-700")}>
          {errors.length > 0 && `${errors.length} data-loss risk${errors.length !== 1 ? "s" : ""}`}
          {errors.length > 0 && warns.length > 0 && " · "}
          {warns.length > 0 && `${warns.length} warning${warns.length !== 1 ? "s" : ""}`}
        </span>
        <span className="ml-auto text-[10px] text-slate-400">click to {open ? "collapse" : "expand"}</span>
      </button>
      {open && (
        <div className="divide-y border-t border-inherit">
          {warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-2 px-3 py-1.5">
              <span className={cn("mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase",
                w.severity === "error" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700")}>
                {w.severity === "error" ? "risk" : "warn"}
              </span>
              <div className="min-w-0">
                <span className="font-mono font-semibold text-slate-700">{w.model}{w.field ? `.${w.field}` : ""}</span>
                <span className="ml-2 text-slate-500">{w.message}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
