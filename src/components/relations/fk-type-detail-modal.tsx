"use client";

import { useEffect } from "react";
import { VersionDiffBadge } from "@/components/shared/version-diff-badge";

export type FkTypeMismatch = {
  fieldName: string;
  targetTableName: string;
  fromType: string;
  toType: string;
};

export function FkTypeDetailModal({
  relationName,
  sourceTableName,
  targetTableName,
  mismatches,
  fromVersion,
  toVersion,
  onClose,
}: {
  relationName: string;
  sourceTableName: string;
  targetTableName: string;
  mismatches: FkTypeMismatch[];
  fromVersion: string;
  toVersion: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6"
      role="dialog"
      aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              FK Type Mismatch
            </p>
            <h3 className="mt-0.5 text-lg font-semibold text-slate-950">
              {sourceTableName}.{relationName} → {targetTableName}
            </h3>
            {fromVersion && (
              <p className="mt-0.5 font-mono text-[11px] text-slate-400">
                {fromVersion} → {toVersion}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-4 w-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <p className="px-5 py-3 text-xs text-slate-500">
            The PK on <span className="font-semibold text-slate-700">{targetTableName}</span> changed since the previous version. The FK fields below still use the old type — update them in the <span className="font-semibold text-slate-700">Schema</span> workflow.
          </p>
          <ul className="divide-y divide-slate-100">
            {mismatches.map((m) => (
              <li key={m.fieldName} className="bg-red-50/50 px-5 py-3">
                <div className="flex flex-wrap items-start gap-2">
                  <VersionDiffBadge severity="breaking" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <span className="text-sm font-semibold text-slate-900">{m.fieldName}</span>
                      <span className="font-mono text-xs text-slate-500">
                        <span className="text-slate-400">{m.fromType}</span>
                        {" → "}
                        <span className="font-semibold text-slate-700">{m.toType}</span>
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">
                      FK field type still <span className="font-mono font-semibold">{m.fromType}</span> but <span className="font-semibold">{m.targetTableName}</span> PK is now <span className="font-mono font-semibold">{m.toType}</span>.
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="h-8 rounded-md border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-800"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
