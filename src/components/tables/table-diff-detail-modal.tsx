"use client";

import { useEffect, useState } from "react";
import type { TableDiff } from "@/lib/version-diff/detect-changes";
import { VersionDiffBadge } from "@/components/shared/version-diff-badge";

export function TableDiffDetailModal({
  tableDiff,
  fromVersion,
  toVersion,
  pendingWarningIds,
  onApproveAll,
  onClose,
}: {
  tableDiff: TableDiff;
  fromVersion: string;
  toVersion: string;
  pendingWarningIds?: string[];
  onApproveAll?: (ids: string[]) => Promise<void>;
  onClose: () => void;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const [approving, setApproving] = useState(false);

  const rowBg = {
    breaking: "bg-red-50/70",
    warning: "bg-amber-50/70",
    info: "",
  } as const;

  const visibleDiffs = tableDiff.fieldDiffs.filter((d) => d.isPk);
  const wasRenamed = tableDiff.fromName !== "" && tableDiff.fromName !== tableDiff.tableName;
  const isTableEvent = visibleDiffs.length === 0;

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
              Schema Changes
            </p>
            <h3 className="mt-0.5 text-lg font-semibold text-slate-950">
              {tableDiff.fromName && tableDiff.fromName !== tableDiff.tableName
                ? `${tableDiff.fromName} → ${tableDiff.tableName}`
                : tableDiff.tableName}
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
          {wasRenamed && (
            <div className="flex items-center gap-2 border-b border-slate-100 bg-amber-50/60 px-5 py-3">
              <VersionDiffBadge severity="warning" label="renamed" />
              <span className="font-mono text-sm text-slate-700">
                <span className="text-slate-400">{tableDiff.fromName}</span>
                {" → "}
                <span className="font-semibold">{tableDiff.tableName}</span>
              </span>
            </div>
          )}
          {isTableEvent ? (
            !wasRenamed && (
              <div className="px-5 py-6 text-center text-sm text-slate-500">
                {tableDiff.message}
              </div>
            )
          ) : (
            <ul className="divide-y divide-slate-100">
              {visibleDiffs.map((fd) => (
                <li key={fd.fieldId} className={`px-5 py-3 ${rowBg[fd.severity]}`}>
                  <div className="flex flex-wrap items-start gap-2">
                    <VersionDiffBadge severity={fd.severity} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <span className="text-sm font-semibold text-slate-900">
                          {fd.fieldName}
                        </span>
                        {fd.from && fd.to && (
                          <span className="font-mono text-xs text-slate-500">
                            <span className="text-slate-400">{fd.from}</span>
                            {" → "}
                            <span className="font-semibold text-slate-700">{fd.to}</span>
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500">{fd.message}</p>
                      {fd.cascade.length > 0 && (
                        <p className="mt-1 text-xs text-slate-400">
                          {fd.cascade.length} FK field{fd.cascade.length > 1 ? "s" : ""} affected — check the <span className="font-semibold">Relations</span> workflow.
                        </p>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-5 py-3">
          <div>
            {pendingWarningIds && pendingWarningIds.length > 0 && onApproveAll && (
              <button
                type="button"
                disabled={approving}
                onClick={async () => {
                  setApproving(true);
                  await onApproveAll(pendingWarningIds);
                  setApproving(false);
                }}
                className="inline-flex items-center gap-1.5 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {approving ? "Approving…" : `✓ I understand — approve ${pendingWarningIds.length > 1 ? "all changes" : "this change"}`}
              </button>
            )}
          </div>
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
