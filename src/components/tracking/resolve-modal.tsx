"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import type { SchemaWarning } from "@/lib/schema-warnings-store";

export function ResolveModal({
  warning,
  pendingValue,
  setPendingValue,
  enumValuesMap,
  onApprove,
  onClose,
}: {
  warning: SchemaWarning;
  pendingValue: string;
  setPendingValue: (v: string) => void;
  enumValuesMap: Record<string, string[]>;
  onApprove: (id: string, replacementValue?: string) => Promise<void>;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const isNullable = warning.targetNullable === true;
  const isEnumRemoval = warning.entityKind === "enum" && warning.changeKind === "value_removed";
  const isFieldDefault = warning.entityKind === "field" && warning.targetNullable !== null;

  const targetType = warning.toValue ?? "";
  const fieldName = warning.entityName.split(".")[1] ?? warning.entityName;
  const enumName = warning.entityName.split(".")[0] ?? "";
  const removedValue = warning.entityName.split(".")[1] ?? "";
  const enumAvailable = enumValuesMap[enumName] ?? [];

  const isStringTarget = !["Int", "BigInt", "Float", "Decimal", "Boolean", "DateTime", "Json", "Bytes"].includes(targetType);
  const isUniqueField = warning.targetUnique === true;
  const isUniquePrefix = isStringTarget && isUniqueField;

  const canApprove = isEnumRemoval
    ? pendingValue.trim().length > 0
    : isFieldDefault && !isNullable
      ? pendingValue.trim().length > 0
      : true;

  async function handleApprove(overrideValue?: string) {
    setBusy(true);
    const val = (overrideValue ?? pendingValue).trim() || undefined;
    await onApprove(warning.id, val);
    setBusy(false);
    onClose();
  }

  async function handleResolveForMe() {
    const prefix = fieldName;
    setPendingValue(prefix);
    await handleApprove(prefix);
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div className="w-full max-w-lg rounded-lg border border-slate-200 bg-white shadow-2xl">
        <div className="border-b border-slate-200 px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Resolve</p>
          <h3 className="mt-0.5 text-base font-semibold text-slate-950">{warning.entityName}</h3>
        </div>

        <div className="space-y-3 px-5 py-4">
          <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-16 font-semibold text-slate-500">Change</span>
              <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-slate-600">{warning.changeKind}</code>
            </div>
            {(warning.fromValue || warning.toValue) && (
              <div className="flex items-center gap-2">
                <span className="w-16 font-semibold text-slate-500">Type</span>
                <span className="flex items-center gap-1">
                  {warning.fromValue && <code className="rounded bg-slate-100 px-1 font-mono text-slate-600">{warning.fromValue}</code>}
                  {warning.fromValue && warning.toValue && <span className="text-slate-400">→</span>}
                  {warning.toValue && <code className="rounded bg-slate-100 px-1 font-mono text-slate-600">{warning.toValue}</code>}
                </span>
              </div>
            )}
            {warning.entityKind === "field" && (
              <div className="flex items-center gap-2">
                <span className="w-16 font-semibold text-slate-500">Field</span>
                <div className="flex gap-1.5">
                  <span className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold ${
                    isNullable ? "border-sky-200 bg-sky-50 text-sky-700" : "border-slate-200 bg-white text-slate-500"
                  }`}>
                    {isNullable ? "nullable" : "required"}
                  </span>
                  {warning.targetUnique !== null && (
                    <span className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold ${
                      isUniqueField ? "border-violet-200 bg-violet-50 text-violet-700" : "border-slate-200 bg-white text-slate-500"
                    }`}>
                      {isUniqueField ? "unique" : "not unique"}
                    </span>
                  )}
                </div>
              </div>
            )}
            <div className="flex items-start gap-2">
              <span className="w-16 shrink-0 font-semibold text-slate-500">Message</span>
              <span className="leading-relaxed text-slate-600">{warning.message}</span>
            </div>
          </div>

          {isEnumRemoval && (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-slate-700">
                Map <code className="rounded bg-red-100 px-1 font-mono text-red-700">{removedValue}</code> to a remaining value
              </p>
              <select
                value={pendingValue}
                onChange={(e) => setPendingValue(e.target.value)}
                className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 focus:border-slate-500 focus:outline-none"
              >
                <option value="">— select replacement value</option>
                {enumAvailable.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
          )}

          {isFieldDefault && !isNullable && isUniquePrefix && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-700">
                  Prefix
                  <span className="ml-1.5 text-[10px] font-normal text-rose-500">required</span>
                </p>
                <span className="rounded border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-700">
                  unique field — UUID appended per row
                </span>
              </div>
              <div className="flex gap-2">
                <input
                  value={pendingValue}
                  onChange={(e) => setPendingValue(e.target.value)}
                  placeholder={fieldName}
                  autoFocus
                  className="h-9 flex-1 rounded-md border border-slate-300 bg-white px-3 font-mono text-sm text-slate-800 focus:border-slate-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleResolveForMe}
                  disabled={busy}
                  title={`Use "${fieldName}" as prefix and approve`}
                  className="h-9 rounded-md border border-teal-300 bg-teal-50 px-3 text-xs font-semibold text-teal-700 transition hover:bg-teal-100 disabled:opacity-50"
                >
                  {busy ? "Resolving…" : "Resolve it for me"}
                </button>
              </div>
              <p className="text-[10px] text-slate-500">
                Each row will receive: <code className="font-mono text-slate-700">{pendingValue || fieldName}-</code><code className="font-mono text-slate-400">{"{uuid}"}</code>
              </p>
            </div>
          )}

          {isFieldDefault && !isNullable && !isUniquePrefix && (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-slate-700">
                Migration default value
                <span className="ml-1.5 text-[10px] font-normal text-rose-500">required</span>
              </p>
              <p className="text-[10px] text-slate-500">This value will be set on every existing row.</p>
              <input
                value={pendingValue}
                onChange={(e) => setPendingValue(e.target.value)}
                placeholder={
                  targetType === "Int" || targetType === "BigInt" ? "e.g. 0"
                  : targetType === "Float" || targetType === "Decimal" ? "e.g. 0.0"
                  : targetType === "Boolean" ? "true or false"
                  : "default value"
                }
                autoFocus
                className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 font-mono text-sm text-slate-800 focus:border-slate-500 focus:outline-none"
              />
            </div>
          )}

          {isFieldDefault && isNullable && (
            <p className="text-sm text-slate-600">
              This field is nullable — existing rows will be set to <code className="rounded bg-slate-100 px-1 font-mono text-sm">NULL</code>.
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canApprove || busy}
            onClick={() => handleApprove()}
            className="h-9 min-w-32 rounded-md bg-emerald-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {busy ? "Saving…" : "Approve"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
