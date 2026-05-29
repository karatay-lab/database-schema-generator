"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTRPC } from "@/trpc/client";
import { useProjectInfo } from "../shared/project-info-context";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { WarningsPanel } from "./warnings-panel";
import { useSchemaWarnings } from "../shared/use-schema-warnings";
import { formatDefault } from "@/lib/tracking-utils";
import type { TrackingEntry, TrackingEntryKind, TrackingChangeKind } from "@/lib/tracking-utils";

// ─── helpers ─────────────────────────────────────────────────────────────────

const changeBadge: Record<TrackingChangeKind, { cls: string; label: string }> = {
  added:         { cls: "border-emerald-200 bg-emerald-50 text-emerald-700",  label: "Added"         },
  removed:       { cls: "border-red-200 bg-red-50 text-red-700",              label: "Removed"       },
  changed:       { cls: "border-amber-200 bg-amber-50 text-amber-700",        label: "Changed"       },
  renamed:       { cls: "border-sky-200 bg-sky-50 text-sky-700",              label: "Renamed"       },
  value_added:   { cls: "border-emerald-200 bg-emerald-50 text-emerald-700",  label: "Value added"   },
  value_removed: { cls: "border-red-200 bg-red-50 text-red-700",              label: "Value removed" },
};

const rowTint: Partial<Record<TrackingChangeKind, string>> = {
  added: "bg-emerald-50/40", removed: "bg-red-50/40", changed: "bg-amber-50/40",
  renamed: "bg-sky-50/40",   value_added: "bg-emerald-50/40", value_removed: "bg-red-50/40",
};

const kindLabel: Record<TrackingEntryKind, string> = {
  field_default: "Field default",
  enum:          "Enum",
  enum_value:    "Enum value",
};

function ChangeBadge({ kind }: { kind: TrackingChangeKind }) {
  const c = changeBadge[kind];
  return (
    <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-semibold ${c.cls}`}>
      {c.label}
    </span>
  );
}

function ValueDisplay({ text }: { text: string }) {
  if (text === "—") return <span className="text-slate-400">—</span>;
  return <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-700">{text}</code>;
}

// ─── tab trigger helpers ──────────────────────────────────────────────────────

const tabMeta: Record<string, { dot: string; label: string }> = {
  all:          { dot: "bg-slate-400",   label: "All Changes"  },
  tables:       { dot: "bg-cyan-500",    label: "Tables"       },
  enums:        { dot: "bg-indigo-500",  label: "Enums"        },
  schema:       { dot: "bg-rose-500",    label: "Schema"       },
  relations:    { dot: "bg-violet-500",  label: "Relations"    },
  restrictions: { dot: "bg-blue-500",    label: "Restrictions" },
};

// Active underline accent per tab
const tabAccent: Record<string, string> = {
  all:          "data-active:border-slate-700",
  tables:       "data-active:border-cyan-600",
  enums:        "data-active:border-indigo-600",
  schema:       "data-active:border-rose-600",
  relations:    "data-active:border-violet-600",
  restrictions: "data-active:border-blue-600",
};

function TabTrigger({
  value,
  count,
  incompleteCount,
  allClear,
}: {
  value: string;
  count?: number;
  incompleteCount?: number;
  allClear?: boolean;
}) {
  const meta = tabMeta[value]!;
  const hasPending   = (count ?? 0) > 0;
  const hasIncomplete = !hasPending && (incompleteCount ?? 0) > 0;
  const isResolver = value !== "all";

  // Status line only when action is needed — green bg already signals all resolved
  const statusLine = hasPending
    ? <span className="text-[10px] font-semibold text-red-500">{count} pending</span>
    : hasIncomplete
      ? <span className="text-[10px] font-semibold text-amber-500">needs value</span>
      : null;

  const dotCls = allClear && isResolver ? "bg-emerald-500"
    : hasPending    ? "bg-red-500"
    : hasIncomplete ? "bg-amber-500"
    : meta.dot;

  // Use inline style for bg — dynamic Tailwind classes aren't JIT-scanned
  const bgColor = !isResolver ? undefined
    : allClear      ? "#f0fdf4"   // emerald-50
    : hasPending    ? "#fef2f2"   // red-50
    : hasIncomplete ? "#fffbeb"   // amber-50
    : undefined;

  const borderColor = !isResolver ? undefined
    : allClear      ? "#22c55e"   // emerald-500
    : hasPending    ? "#ef4444"   // red-500
    : hasIncomplete ? "#f59e0b"   // amber-500
    : undefined;

  return (
    <TabsTrigger
      value={value}
      style={{
        ...(bgColor ? { backgroundColor: bgColor } : {}),
        ...(borderColor ? { "--tab-accent": borderColor } as React.CSSProperties : {}),
      }}
      className={[
        "flex-1 flex-col justify-center gap-0.5 py-0",
        "rounded-none border-b-2 border-transparent px-2",
        "text-sm font-medium text-slate-600 shadow-none transition-colors",
        "hover:brightness-95",
        "data-active:text-slate-950 data-active:font-semibold data-active:shadow-none",
        borderColor
          ? "data-active:[border-bottom-color:var(--tab-accent)]"
          : (tabAccent[value] ?? "data-active:border-slate-700"),
        "-mb-px",
      ].join(" ")}
    >
      {/* Label row */}
      <span className="flex items-center gap-1.5">
        <span className={`h-2 w-2 shrink-0 rounded-full transition-colors ${dotCls}`} />
        <span className="text-xs font-semibold tracking-wide">{meta.label}</span>
      </span>
      {/* Status sub-line */}
      {statusLine}
    </TabsTrigger>
  );
}

// ─── "All Changes" tab content ────────────────────────────────────────────────

function AllChangesTab({
  projectId,
  fromVersion,
  toVersion,
}: {
  projectId: string;
  fromVersion: string;
  toVersion: string;
}) {
  const trpc = useTRPC();
  const [kindFilter, setKindFilter] = useState<TrackingEntryKind | "all">("all");
  const [changeFilter, setChangeFilter] = useState<TrackingChangeKind | "all">("all");
  const [entityFilter, setEntityFilter] = useState("all");

  const { data, isLoading } = useQuery(
    trpc.tracking.allChanges.queryOptions({ projectId }, { enabled: !!projectId }),
  );

  // Only entries for the current version transition
  const allEntries: TrackingEntry[] = useMemo(() => {
    if (!data?.entries) return [];
    return data.entries.filter(
      (e) => e.fromVersion === fromVersion && e.toVersion === toVersion,
    );
  }, [data?.entries, fromVersion, toVersion]);

  const entityNames = useMemo(() => {
    const seen = new Set<string>();
    for (const e of allEntries) seen.add(e.entityName);
    return [...seen].sort();
  }, [allEntries]);

  const filtered = useMemo(() => allEntries.filter((e) => {
    if (kindFilter !== "all" && e.entityKind !== kindFilter) return false;
    if (changeFilter !== "all" && e.changeKind !== changeFilter) return false;
    if (entityFilter !== "all" && e.entityName !== entityFilter) return false;
    return true;
  }), [allEntries, kindFilter, changeFilter, entityFilter]);

  const counts = useMemo(() => {
    const c = { field_default: 0, enum: 0, enum_value: 0 };
    for (const e of allEntries) c[e.entityKind]++;
    return c;
  }, [allEntries]);

  const anyFilter = kindFilter !== "all" || changeFilter !== "all" || entityFilter !== "all";
  const reset = () => { setKindFilter("all"); setChangeFilter("all"); setEntityFilter("all"); };

  if (isLoading) return <div className="py-12 text-center text-sm font-medium text-slate-500">Loading…</div>;

  if (allEntries.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
        <p className="text-sm font-semibold text-slate-600">No schema changes detected for this version.</p>
        <p className="mt-1 text-xs text-slate-400">Modify field defaults or enums between {fromVersion} and {toVersion} to see entries here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary chips */}
      <div className="flex flex-wrap items-center gap-2">
        {counts.field_default > 0 && (
          <span className="rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">
            {counts.field_default} field default{counts.field_default !== 1 ? "s" : ""}
          </span>
        )}
        {counts.enum > 0 && (
          <span className="rounded-md border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700">
            {counts.enum} enum{counts.enum !== 1 ? "s" : ""}
          </span>
        )}
        {counts.enum_value > 0 && (
          <span className="rounded-md border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700">
            {counts.enum_value} enum value{counts.enum_value !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Filters — full-width button groups */}
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
        {/* Kind */}
        <div className="flex items-center gap-3">
          <span className="w-14 shrink-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Kind</span>
          <div className="flex flex-1 divide-x divide-slate-200 overflow-hidden rounded-md border border-slate-200">
            {([ ["all", "All"], ["field_default", "Field defaults"], ["enum", "Enums"], ["enum_value", "Enum values"] ] as [TrackingEntryKind | "all", string][]).map(([v, label]) => (
              <button key={v} type="button" onClick={() => setKindFilter(v)}
                className={`flex-1 py-1.5 text-xs font-medium transition ${kindFilter === v ? "bg-slate-800 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Change */}
        <div className="flex items-center gap-3">
          <span className="w-14 shrink-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Change</span>
          <div className="flex flex-1 divide-x divide-slate-200 overflow-hidden rounded-md border border-slate-200">
            {([ ["all","All"], ["added","Added"], ["removed","Removed"], ["changed","Changed"], ["renamed","Renamed"], ["value_added","Val. added"], ["value_removed","Val. removed"] ] as [TrackingChangeKind | "all", string][]).map(([v, label]) => (
              <button key={v} type="button" onClick={() => setChangeFilter(v)}
                className={`flex-1 py-1.5 text-xs font-medium transition ${changeFilter === v ? "bg-slate-800 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Entity (only when multiple) */}
        {entityNames.length > 1 && (
          <div className="flex items-center gap-3">
            <span className="w-14 shrink-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Entity</span>
            <div className="flex flex-1 divide-x divide-slate-200 overflow-hidden rounded-md border border-slate-200">
              {(["all", ...entityNames] as string[]).map((v) => (
                <button key={v} type="button" onClick={() => setEntityFilter(v)}
                  className={`flex-1 py-1.5 text-xs font-medium transition truncate ${entityFilter === v ? "bg-slate-800 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}>
                  {v === "all" ? "All" : v}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Footer row */}
        <div className="flex items-center justify-between pt-0.5">
          {anyFilter
            ? <button type="button" onClick={reset} className="text-[10px] font-medium text-slate-400 underline underline-offset-2 hover:text-slate-700">Reset filters</button>
            : <span />}
          <span className="text-[10px] font-semibold text-slate-400">{filtered.length} of {allEntries.length} entries</span>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
          <p className="text-sm font-medium text-slate-500">No entries match the current filters.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                {(["Entity", "Kind", "Change", "From", "To", "View"] as const).map((h) => (
                  <th key={h} className="pb-2 pr-4 text-left text-xs font-semibold uppercase tracking-[0.14em] text-slate-400 last:pr-0">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((entry, idx) => {
                const isField = entry.entityKind === "field_default";
                return (
                  <tr key={idx} className={`${rowTint[entry.changeKind] ?? ""} transition-colors`}>
                    <td className="py-2.5 pr-4 align-middle">
                      <span className="font-semibold text-slate-800">{entry.entityName}</span>
                      {entry.subName && (
                        <><span className="mx-1 text-slate-300">·</span><span className="text-slate-600">{entry.subName}</span></>
                      )}
                    </td>
                    <td className="py-2.5 pr-4 align-middle">
                      <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-semibold ${
                        entry.entityKind === "field_default" ? "border-amber-100 bg-amber-50 text-amber-600"
                        : entry.entityKind === "enum" ? "border-indigo-100 bg-indigo-50 text-indigo-600"
                        : "border-violet-100 bg-violet-50 text-violet-600"
                      }`}>
                        {kindLabel[entry.entityKind]}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 align-middle"><ChangeBadge kind={entry.changeKind} /></td>
                    <td className="py-2.5 pr-4 align-middle"><ValueDisplay text={entry.fromDisplay} /></td>
                    <td className="py-2.5 pr-4 align-middle"><ValueDisplay text={entry.toDisplay} /></td>
                    <td className="py-2.5 align-middle">
                      <Link href={isField ? `/schema?table=${entry.entityName}` : "/enums"}
                        className="rounded border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-600 transition hover:border-teal-300 hover:text-teal-700">
                        View →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── main page ────────────────────────────────────────────────────────────────

function ResolverPanelHeader({
  color, title, description, pendingCount, incompleteCount,
}: {
  color: string;
  title: string;
  description: string;
  pendingCount: number;
  incompleteCount: number;
}) {
  const hasIssues = pendingCount > 0 || incompleteCount > 0;
  return (
    <div className={`mb-5 rounded-lg border p-4 ${
      pendingCount > 0 ? "border-red-200 bg-red-50/50" :
      incompleteCount > 0 ? "border-amber-200 bg-amber-50/50" :
      "border-emerald-200 bg-emerald-50/40"
    }`}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${color}`} />
          <p className="font-semibold text-slate-950">{title}</p>
        </div>
        <span className={`rounded-md border px-2.5 py-1 text-xs font-semibold ${
          pendingCount > 0 ? "border-red-200 bg-white text-red-700" :
          incompleteCount > 0 ? "border-amber-200 bg-white text-amber-700" :
          "border-emerald-200 bg-white text-emerald-700"
        }`}>
          {pendingCount > 0
            ? `${pendingCount} need${pendingCount === 1 ? "s" : ""} approval`
            : incompleteCount > 0
              ? `${incompleteCount} need${incompleteCount === 1 ? "s" : ""} default value`
              : "All resolved ✓"}
        </span>
      </div>
      <p className="mt-2 text-xs text-slate-600 leading-relaxed">{description}</p>
      {hasIssues && (
        <p className={`mt-2 text-[10px] font-semibold uppercase tracking-wider ${
          pendingCount > 0 ? "text-red-500" : "text-amber-500"
        }`}>
          {pendingCount > 0 ? "↓ Approve each item below" : "↓ Set default values below"}
        </p>
      )}
    </div>
  );
}

const VALID_TABS = ["all", "tables", "enums", "schema", "relations", "restrictions"] as const;
type TrackingTab = typeof VALID_TABS[number];

export function TrackingPageContent() {
  const { projectId, projectName, versions, version, hasProject } = useProjectInfo();
  const trpc = useTRPC();
  const router = useRouter();
  const searchParams = useSearchParams();

  const resolveParam = searchParams.get("resolve") as TrackingTab | null;
  const activeTab: TrackingTab = VALID_TABS.includes(resolveParam as TrackingTab)
    ? (resolveParam as TrackingTab)
    : "all";

  function setActiveTab(tab: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (tab === "all") {
      params.delete("resolve");
    } else {
      params.set("resolve", tab);
    }
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : "?", { scroll: false });
  }

  // Derive the single relevant version pair from the currently selected version
  const versionIdx = versions.indexOf(version);
  const fromVersion = versionIdx > 0 ? versions[versionIdx - 1]! : "";
  const toVersion = version;
  const hasPair = versionIdx > 0;

  const { data: countsData } = useQuery(
    trpc.tracking.pendingCounts.queryOptions(
      { projectId, fromVersion, toVersion },
      { enabled: Boolean(projectId && hasPair) },
    ),
  );
  const pending = countsData ?? { table: 0, field: 0, enum: 0, relation: 0, total: 0 };
  const { warnings, defaultsRequiredCount } = useSchemaWarnings(projectId, fromVersion, toVersion);

  // Per-category incomplete counts (approved but missing required default value)
  const incompleteByKind = {
    field: warnings.filter(
      (w) => w.entityKind === "field" && w.approvedAt && !w.replacementValue &&
             w.targetNullable === false &&
             (w.resolution === "backfill_required" || w.resolution === "lossy_convert" || w.resolution === "precision_loss"),
    ).length,
    enum: warnings.filter(
      (w) => w.entityKind === "enum" && w.approvedAt && !w.replacementValue &&
             w.changeKind === "value_removed",
    ).length,
    table: 0,
    relation: 0,
  };

  const totalResolvable = pending.total + defaultsRequiredCount;
  const totalResolved = hasPair && countsData ? (
    // total warnings minus pending and incomplete
    warnings.filter((w) => !!w.approvedAt).length -
    Object.values(incompleteByKind).reduce((s, v) => s + v, 0)
  ) : 0;

  if (!hasProject) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-8 text-center">
        <p className="text-slate-600">Select a project to view change tracking.</p>
      </div>
    );
  }

  const allResolved = hasPair && countsData && pending.total === 0 && defaultsRequiredCount === 0;

  return (
    <div className="space-y-4">
      {/* ── Resolver header ── */}
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="rounded border border-teal-200 bg-teal-50 px-2 py-0.5 text-xs font-semibold text-teal-700">
                {projectName}
              </span>
              {hasPair && (
                <span className="font-mono text-xs font-semibold text-slate-500">
                  {fromVersion} → {toVersion}
                </span>
              )}
            </div>
            <h2 className="text-base font-semibold text-slate-950">
              {allResolved
                ? "All schema changes reviewed — ready to migrate"
                : pending.total > 0
                  ? `${pending.total} change${pending.total !== 1 ? "s" : ""} require${pending.total === 1 ? "s" : ""} approval before migration`
                  : defaultsRequiredCount > 0
                    ? `${defaultsRequiredCount} field${defaultsRequiredCount !== 1 ? "s" : ""} need${defaultsRequiredCount === 1 ? "s" : ""} a migration default value`
                    : "Review schema changes before migrating"}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {allResolved
                ? "Every breaking change, type incompatibility, and backfill requirement has been resolved."
                : "Approve each change below. For type mismatches and new required fields, set an explicit default so migration doesn't guess."}
            </p>
          </div>

          {/* Resolution status badge */}
          {hasPair && countsData && (
            <div className={`shrink-0 flex items-center gap-2 rounded-lg border px-4 py-2.5 ${
              allResolved
                ? "border-emerald-200 bg-emerald-50"
                : pending.total > 0
                  ? "border-red-200 bg-red-50"
                  : "border-amber-200 bg-amber-50"
            }`}>
              <span className={`text-xl ${allResolved ? "text-emerald-600" : pending.total > 0 ? "text-red-600" : "text-amber-600"}`}>
                {allResolved ? "✓" : pending.total > 0 ? "✗" : "⚠"}
              </span>
              <div>
                <p className={`text-xs font-semibold ${allResolved ? "text-emerald-700" : pending.total > 0 ? "text-red-700" : "text-amber-700"}`}>
                  {allResolved ? "All resolved" : pending.total > 0 ? `${pending.total} pending` : `${defaultsRequiredCount} incomplete`}
                </p>
                {hasPair && warnings.length > 0 && (
                  <p className="text-[10px] text-slate-500">{totalResolved} of {warnings.length} complete</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Progress bar */}
        {hasPair && warnings.length > 0 && (
          <div className="mt-4">
            <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${allResolved ? "bg-emerald-500" : pending.total > 0 ? "bg-red-400" : "bg-amber-400"}`}
                style={{ width: `${Math.round((totalResolved / warnings.length) * 100)}%` }}
              />
            </div>
            <p className="mt-1 text-right text-[10px] text-slate-400">
              {Math.round((totalResolved / warnings.length) * 100)}% resolved
            </p>
          </div>
        )}
      </div>

      {/* ── Tabbed resolver card ── */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="rounded-lg border border-slate-200 bg-white shadow-sm">

          {/* Tab bar */}
          <div className="border-b border-slate-200 bg-white">
            <TabsList style={{ height: "72px" }} className="w-full justify-stretch rounded-none border-none bg-transparent p-0 gap-0">
              <TabTrigger value="all" />
              <TabTrigger value="tables"       count={pending.table}    incompleteCount={incompleteByKind.table}    allClear={hasPair && !!countsData && pending.table === 0 && incompleteByKind.table === 0} />
              <TabTrigger value="enums"        count={pending.enum}     incompleteCount={incompleteByKind.enum}     allClear={hasPair && !!countsData && pending.enum === 0 && incompleteByKind.enum === 0} />
              <TabTrigger value="schema"       count={pending.field}    incompleteCount={incompleteByKind.field}    allClear={hasPair && !!countsData && pending.field === 0 && incompleteByKind.field === 0} />
              <TabTrigger value="relations"    count={pending.relation}  incompleteCount={incompleteByKind.relation} allClear={hasPair && !!countsData && pending.relation === 0 && incompleteByKind.relation === 0} />
              <TabTrigger value="restrictions" allClear={hasPair && !!countsData} />
            </TabsList>
          </div>

          {/* Tab panels */}
          <div className="p-5">

            {/* All Changes */}
            <TabsContent value="all">
              {hasPair
                ? <AllChangesTab projectId={projectId} fromVersion={fromVersion} toVersion={toVersion} />
                : <p className="text-sm text-slate-500">This is the first version — no previous version to compare against.</p>}
            </TabsContent>

            {/* Tables */}
            <TabsContent value="tables">
              <ResolverPanelHeader
                color="bg-cyan-500"
                title="Table Resolver"
                description="Approve table removals and PK type changes. Removed tables will have all their rows permanently dropped on migration."
                pendingCount={pending.table}
                incompleteCount={incompleteByKind.table}
              />
              <WarningsPanel projectId={projectId} fromVersion={fromVersion} toVersion={toVersion} entityKind="table" />
            </TabsContent>

            {/* Enums */}
            <TabsContent value="enums">
              <ResolverPanelHeader
                color="bg-indigo-500"
                title="Enum Resolver"
                description="Map removed enum values to replacements. Any row holding a removed value must be remapped — otherwise the insert will fail."
                pendingCount={pending.enum}
                incompleteCount={incompleteByKind.enum}
              />
              <WarningsPanel projectId={projectId} fromVersion={fromVersion} toVersion={toVersion} entityKind="enum" />
            </TabsContent>

            {/* Schema */}
            <TabsContent value="schema">
              <ResolverPanelHeader
                color="bg-rose-500"
                title="Schema Field Resolver"
                description="Set default values for new required fields and type-incompatible changes. Without an explicit default, migration will auto-generate a placeholder — which is almost never what you want."
                pendingCount={pending.field}
                incompleteCount={incompleteByKind.field}
              />
              <WarningsPanel projectId={projectId} fromVersion={fromVersion} toVersion={toVersion} entityKind="field" />
            </TabsContent>

            {/* Relations */}
            <TabsContent value="relations">
              <ResolverPanelHeader
                color="bg-violet-500"
                title="Relation Resolver"
                description="Approve removed relations. The FK column and its values will be dropped on migration."
                pendingCount={pending.relation}
                incompleteCount={incompleteByKind.relation}
              />
              <WarningsPanel projectId={projectId} fromVersion={fromVersion} toVersion={toVersion} entityKind="relation" />
            </TabsContent>

            {/* Restrictions */}
            <TabsContent value="restrictions">
              <div className="mb-5 flex items-start gap-3">
                <span className="mt-0.5 h-3 w-3 shrink-0 rounded-full bg-blue-500" />
                <div>
                  <p className="font-semibold text-slate-950">Restriction warnings</p>
                  <p className="mt-0.5 text-xs text-slate-500">UNIQUE and INDEX constraint changes.</p>
                </div>
              </div>
              <WarningsPanel projectId={projectId} fromVersion={fromVersion} toVersion={toVersion} entityKind="restriction" />
            </TabsContent>

          </div>
        </div>
      </Tabs>

      {/* ── Legend ── */}
      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Legend</p>
          <h3 className="mt-1 text-lg font-semibold text-slate-950">What gets tracked</h3>
        </div>
        <div className="grid grid-cols-1 divide-y divide-slate-100 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <div className="px-5 py-4">
            <p className="font-semibold text-amber-700">Field defaults</p>
            <p className="mt-1 text-xs text-slate-500">
              Tracks when a field's <code className="font-mono">@default</code> is added, changed, or removed. Existing rows may need backfilling when a default is added.
            </p>
          </div>
          <div className="px-5 py-4">
            <p className="font-semibold text-indigo-700">Enums</p>
            <p className="mt-1 text-xs text-slate-500">
              Tracks whole-enum additions, removals, and renames. Removed values require remapping existing rows before migration.
            </p>
          </div>
          <div className="px-5 py-4">
            <p className="font-semibold text-red-700">Approvals</p>
            <p className="mt-1 text-xs text-slate-500">
              Breaking and lossy changes must be approved in the warning tabs before migration can run. Reds must be resolved first.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
