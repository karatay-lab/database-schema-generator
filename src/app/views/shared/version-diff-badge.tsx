"use client";

import { useEffect, useState } from "react";
import type { ChangeSeverity, FieldDiff, TableDiff } from "@/lib/version-diff/detect-changes";
import type { SchemaWarning } from "@/lib/schema-warnings-store";

export type FkTypeMismatch = {
  fieldName: string;
  targetTableName: string;
  fromType: string;
  toType: string;
};

const severityStyles: Record<ChangeSeverity, { badge: string; dot: string; label: string }> = {
  breaking: {
    badge: "bg-red-50 border-red-200 text-red-700",
    dot: "bg-red-500",
    label: "Breaking",
  },
  warning: {
    badge: "bg-amber-50 border-amber-200 text-amber-700",
    dot: "bg-amber-500",
    label: "Changed",
  },
  info: {
    badge: "bg-sky-50 border-sky-200 text-sky-700",
    dot: "bg-sky-400",
    label: "New",
  },
};

function ChangeIcon({ severity }: { severity: ChangeSeverity }) {
  if (severity === "breaking") {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3 shrink-0">
        <path fillRule="evenodd" d="M8 1.75a.75.75 0 0 1 .692.462l5.25 11.5A.75.75 0 0 1 13.25 14.5H2.75a.75.75 0 0 1-.692-1.038l5.25-11.5A.75.75 0 0 1 8 1.75ZM8 5a.75.75 0 0 0-.75.75v3.5a.75.75 0 0 0 1.5 0v-3.5A.75.75 0 0 0 8 5Zm0 7a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
      </svg>
    );
  }
  if (severity === "warning") {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3 shrink-0">
        <path d="M2.5 8a5.5 5.5 0 0 1 8.25-4.764.75.75 0 0 0 .75-1.299A7 7 0 1 0 15 8a.75.75 0 0 0-1.5 0 5.5 5.5 0 1 1-11 0Z" />
        <path d="M13 2.5a.5.5 0 0 1 1 0v4a.5.5 0 0 1-1 0v-4ZM14 8.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z" />
      </svg>
    );
  }
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3 shrink-0">
      <path fillRule="evenodd" d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1Zm.75 4.75a.75.75 0 0 0-1.5 0v3.5a.75.75 0 0 0 1.5 0v-3.5Zm0 6.5a.75.75 0 0 0-1.5 0v.5a.75.75 0 0 0 1.5 0v-.5Z" clipRule="evenodd" />
    </svg>
  );
}

// Small inline approve button for a single warning row.
export function ApproveWarningButton({
  warning,
  onApprove,
}: {
  warning: SchemaWarning | undefined;
  onApprove: (id: string) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  if (!warning || warning.approvedAt) return null;
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await onApprove(warning.id);
        setBusy(false);
      }}
      className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-600 transition hover:border-slate-400 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {busy ? "…" : "✓ Approve"}
    </button>
  );
}

// Compact inline badge showing severity + short label.
export function VersionDiffBadge({
  severity,
  label,
  title,
}: {
  severity: ChangeSeverity;
  label?: string;
  title?: string;
}) {
  const styles = severityStyles[severity];
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-semibold leading-none ${styles.badge}`}
    >
      <ChangeIcon severity={severity} />
      {label ?? styles.label}
    </span>
  );
}

// Tooltip-style popover with change details.
export function FieldDiffTooltip({ diff }: { diff: FieldDiff }) {
  const styles = severityStyles[diff.severity];
  return (
    <div
      className={`rounded-md border px-2.5 py-2 text-xs ${styles.badge}`}
    >
      <p className="font-semibold">{diff.message}</p>
      {diff.from && diff.to && (
        <p className="mt-0.5 font-mono opacity-80">
          {diff.from} → {diff.to}
        </p>
      )}
      {diff.cascade.length > 0 && (
        <div className="mt-1.5 border-t border-current border-opacity-20 pt-1.5">
          <p className="font-semibold">FK fields affected:</p>
          <ul className="mt-0.5 space-y-0.5">
            {diff.cascade.map((hint) => (
              <li key={`${hint.tableId}-${hint.fieldId}`} className="font-mono">
                {hint.tableName}.{hint.fieldName}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// Detail modal opened by clicking a table diff badge.
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

  const rowBg: Record<ChangeSeverity, string> = {
    breaking: "bg-red-50/70",
    warning: "bg-amber-50/70",
    info: "",
  };

  // Tables workflow scope: only PK-field and table-rename/add/remove events.
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
        {/* Header */}
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

        {/* Body */}
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
                        <span className="font-semibold text-slate-900 text-sm">
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

        {/* Footer */}
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

// Detail modal for FK type mismatches — opened by clicking the "FK type" badge in the Relations workflow.
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
        {/* Header */}
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

        {/* Body */}
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

        {/* Footer */}
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

// Summary banner for a table showing only PK/table-level changes (Tables workflow scope).
export function TableDiffSummary({ tableDiff }: { tableDiff: TableDiff }) {
  const pkDiffs = tableDiff.fieldDiffs.filter((d) => d.isPk);
  const wasRenamed = tableDiff.fromName !== "" && tableDiff.fromName !== tableDiff.tableName;
  const isAdded = tableDiff.changeKind === "added";
  const isRemoved = tableDiff.changeKind === "removed";

  if (pkDiffs.length === 0 && !wasRenamed && !isAdded && !isRemoved) {
    return null;
  }

  const breaking = pkDiffs.filter((d) => d.severity === "breaking").length;
  const warnings = pkDiffs.filter((d) => d.severity === "warning").length;

  return (
    <span className="inline-flex items-center gap-1">
      {wasRenamed && <VersionDiffBadge severity="warning" label="renamed" title={`${tableDiff.fromName} → ${tableDiff.tableName}`} />}
      {isAdded && <VersionDiffBadge severity="info" label="added" />}
      {isRemoved && <VersionDiffBadge severity="breaking" label="removed" />}
      {breaking > 0 && <VersionDiffBadge severity="breaking" label={`${breaking} breaking`} />}
      {warnings > 0 && <VersionDiffBadge severity="warning" label={`${warnings} changed`} />}
    </span>
  );
}
