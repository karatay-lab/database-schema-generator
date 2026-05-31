"use client";

import { useState } from "react";
import type { SchemaWarning } from "@/lib/schema-warnings-store";

export function EnumValueReplacementPicker({
  warning,
  removedValue,
  availableValues,
  onApprove,
  onRemap,
  onUnapprove,
}: {
  warning: SchemaWarning | undefined;
  removedValue: string;
  availableValues: string[];
  onApprove: (id: string, replacementValue?: string) => Promise<void>;
  onRemap?: (id: string, replacementValue: string) => Promise<void>;
  onUnapprove?: (id: string) => Promise<void>;
}) {
  const [selected, setSelected] = useState(availableValues[0] ?? "");
  const [editSelected, setEditSelected] = useState("");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!warning) {
    return (
      <span className="rounded border border-red-200 bg-red-50 px-2 py-0.5 font-mono text-[11px] font-semibold text-red-500 line-through">
        {removedValue}
      </span>
    );
  }

  if (warning.approvedAt) {
    if (editing) {
      return (
        <span className="inline-flex flex-wrap items-center gap-1">
          <span className="rounded border border-red-200 bg-red-50 px-2 py-0.5 font-mono text-[11px] font-semibold text-red-500 line-through">
            {removedValue}
          </span>
          <span className="text-[10px] font-semibold text-slate-400">→</span>
          <select
            value={editSelected}
            onChange={(e) => setEditSelected(e.target.value)}
            disabled={busy}
            className="h-6 rounded border border-amber-300 bg-white px-1 font-mono text-[11px] font-semibold text-slate-800 outline-none focus:border-amber-500 disabled:opacity-50"
          >
            {availableValues.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
          <button
            type="button"
            disabled={busy || !editSelected}
            onClick={async () => {
              setBusy(true);
              await onRemap?.(warning.id, editSelected);
              setEditing(false);
              setBusy(false);
            }}
            className="inline-flex h-6 w-6 items-center justify-center rounded border border-emerald-300 bg-emerald-50 text-[11px] font-bold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
            title="Save mapping"
          >
            {busy ? "…" : "✓"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setEditing(false)}
            className="inline-flex h-6 w-6 items-center justify-center rounded border border-slate-200 bg-white text-[11px] font-bold text-slate-500 transition hover:bg-slate-50 disabled:opacity-50"
            title="Cancel"
          >
            ✕
          </button>
        </span>
      );
    }

    return (
      <span className="inline-flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center divide-x divide-emerald-200 overflow-hidden rounded-md border border-emerald-200">
          <span className="flex items-center gap-1 bg-emerald-50 px-2 py-1 font-mono text-[10px] font-semibold">
            <span className="line-through text-red-400">{removedValue}</span>
            <span className="text-emerald-400">→</span>
            <span className="text-emerald-700">{warning.replacementValue ?? "—"}</span>
          </span>
          {onRemap && availableValues.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setEditSelected(warning.replacementValue ?? availableValues[0] ?? "");
                setEditing(true);
              }}
              className="flex items-center bg-white px-2 py-1 text-[10px] font-semibold text-slate-400 transition hover:bg-slate-50 hover:text-slate-700"
              title="Edit mapping"
            >
              Edit
            </button>
          )}
          {onUnapprove && (
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                await onUnapprove(warning.id);
                setBusy(false);
              }}
              title="Undo approval"
              className="flex items-center bg-white px-2 py-1 text-[10px] font-bold text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
            >
              {busy ? "…" : "✗"}
            </button>
          )}
        </span>
      </span>
    );
  }

  const canConfirm = availableValues.length > 0;

  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <span className="rounded border border-red-200 bg-red-50 px-2 py-0.5 font-mono text-[11px] font-semibold text-red-500 line-through">
        {removedValue}
      </span>
      <span className="text-[10px] font-semibold text-slate-400">→</span>
      {canConfirm ? (
        <>
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            disabled={busy}
            className="h-6 rounded border border-amber-300 bg-white px-1 font-mono text-[11px] font-semibold text-slate-800 outline-none focus:border-amber-500 disabled:opacity-50"
          >
            {availableValues.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
          <button
            type="button"
            disabled={busy || !selected}
            onClick={async () => {
              setBusy(true);
              await onApprove(warning.id, selected);
              setBusy(false);
            }}
            className="inline-flex items-center gap-0.5 rounded border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "…" : "✓ Map"}
          </button>
        </>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await onApprove(warning.id, "");
            setBusy(false);
          }}
          className="inline-flex items-center gap-0.5 rounded border border-slate-300 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-500 transition hover:bg-slate-50 disabled:opacity-50"
          title="No replacement values available — acknowledge data loss"
        >
          {busy ? "…" : "✓ Acknowledge"}
        </button>
      )}
    </span>
  );
}
