"use client";

import { useState } from "react";
import type { ChangeSeverity, FieldDiff, TableDiff } from "@/lib/version-diff/detect-changes";
import type { SchemaWarning } from "@/lib/schema-warnings-store";

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

export function ApproveWarningButton({
  warning,
  onApprove,
  onUnapprove,
}: {
  warning: SchemaWarning | undefined;
  onApprove: (id: string) => Promise<void>;
  onUnapprove?: (id: string) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  if (!warning) return null;

  if (warning.approvedAt) {
    if (!onUnapprove) return null;
    return (
      <span className="inline-flex divide-x divide-emerald-200 overflow-hidden rounded-md border border-emerald-200">
        <span className="flex items-center gap-1 bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700">
          <span className="text-emerald-500">✓</span> Approved
        </span>
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await onUnapprove(warning.id);
            setBusy(false);
          }}
          title="Undo approval"
          className="flex items-center bg-white px-2 py-1 text-[10px] font-bold text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "…" : "✗"}
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await onApprove(warning.id);
        setBusy(false);
      }}
      className="inline-flex h-7 items-center gap-1.5 rounded-md border border-emerald-300 bg-emerald-50 px-3 text-[10px] font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {busy ? "…" : <><span className="text-emerald-500">✓</span> Approve</>}
    </button>
  );
}

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

export function FieldDiffTooltip({ diff }: { diff: FieldDiff }) {
  const styles = severityStyles[diff.severity];
  return (
    <div className={`rounded-md border px-2.5 py-2 text-xs ${styles.badge}`}>
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
