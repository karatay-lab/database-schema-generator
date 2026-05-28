"use client";

import type { ChangeSeverity, FieldDiff, TableDiff } from "@/lib/version-diff/detect-changes";

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

// Summary banner for a table showing count of changes.
export function TableDiffSummary({ tableDiff }: { tableDiff: TableDiff }) {
  const { fieldDiffs, severity } = tableDiff;
  const breaking = fieldDiffs.filter((d) => d.severity === "breaking").length;
  const warnings = fieldDiffs.filter((d) => d.severity === "warning").length;
  const infos = fieldDiffs.filter((d) => d.severity === "info").length;

  const parts: string[] = [];
  if (breaking > 0) parts.push(`${breaking} breaking`);
  if (warnings > 0) parts.push(`${warnings} changed`);
  if (infos > 0) parts.push(`${infos} new`);

  const label = parts.length > 0 ? parts.join(", ") : tableDiff.message;

  return (
    <VersionDiffBadge
      severity={severity}
      label={label}
      title={tableDiff.message}
    />
  );
}
