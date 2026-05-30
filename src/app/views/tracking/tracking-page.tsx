"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useTRPC } from "@/trpc/client";
import { useProjectInfo } from "../shared/project-info-context";
import { useSchemaWarnings } from "../shared/use-schema-warnings";
import { Tabs, TabsList, TabsContent } from "@/components/ui/tabs";
import { TabTrigger } from "./tab-trigger";
import { AllChangesTab } from "./all-changes-tab";
import { WarningsPanel } from "./warnings-panel";

const VALID_TABS = ["all", "tables", "enums", "schema", "relations", "restrictions"] as const;
type TrackingTab = typeof VALID_TABS[number];

export function TrackingPageContent() {
  const { projectId, projectName, versions, version, hasProject } = useProjectInfo();
  const trpc    = useTRPC();
  const router  = useRouter();
  const searchParams = useSearchParams();

  const resolveParam = searchParams.get("resolve") as TrackingTab | null;
  const activeTab: TrackingTab = VALID_TABS.includes(resolveParam as TrackingTab)
    ? (resolveParam as TrackingTab)
    : "all";

  function setActiveTab(tab: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (tab === "all") { params.delete("resolve"); } else { params.set("resolve", tab); }
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : "?", { scroll: false });
  }

  const versionIdx  = versions.indexOf(version);
  const fromVersion = versionIdx > 0 ? versions[versionIdx - 1]! : "";
  const toVersion   = version;
  const hasPair     = versionIdx > 0;

  const { data: countsData } = useQuery(
    trpc.tracking.pendingCounts.queryOptions(
      { projectId, fromVersion, toVersion },
      { enabled: Boolean(projectId && hasPair) },
    ),
  );
  const pending = countsData ?? { table: 0, field: 0, enum: 0, relation: 0, total: 0 };
  const { warnings, defaultsRequiredCount } = useSchemaWarnings(projectId, fromVersion, toVersion);

  const incompleteByKind = {
    field: warnings.filter(
      (w) => w.entityKind === "field" && w.approvedAt && !w.replacementValue &&
             w.targetNullable === false &&
             (w.resolution === "backfill_required" || w.resolution === "lossy_convert" || w.resolution === "precision_loss"),
    ).length,
    enum: warnings.filter(
      (w) => w.entityKind === "enum" && w.approvedAt && !w.replacementValue && w.changeKind === "value_removed",
    ).length,
    table:    0,
    relation: 0,
  };

  const totalResolved = hasPair && countsData
    ? warnings.filter((w) => !!w.approvedAt).length - Object.values(incompleteByKind).reduce((s, v) => s + v, 0)
    : 0;

  const allResolved = hasPair && countsData && pending.total === 0 && defaultsRequiredCount === 0;

  if (!hasProject) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-8 text-center">
        <p className="text-slate-600">Select a project to view change tracking.</p>
      </div>
    );
  }

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

          {hasPair && countsData && (
            <div className={`shrink-0 flex items-center gap-2 rounded-lg border px-4 py-2.5 ${
              allResolved ? "border-emerald-200 bg-emerald-50" : pending.total > 0 ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50"
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
          <div className="border-b border-slate-200 bg-white">
            <TabsList style={{ height: "72px" }} className="w-full justify-stretch rounded-none border-none bg-transparent p-0 gap-0">
              <TabTrigger value="all" />
              <TabTrigger value="tables"       count={pending.table}    incompleteCount={incompleteByKind.table}    allClear={hasPair && !!countsData && pending.table    === 0 && incompleteByKind.table    === 0} />
              <TabTrigger value="enums"        count={pending.enum}     incompleteCount={incompleteByKind.enum}     allClear={hasPair && !!countsData && pending.enum     === 0 && incompleteByKind.enum     === 0} />
              <TabTrigger value="schema"       count={pending.field}    incompleteCount={incompleteByKind.field}    allClear={hasPair && !!countsData && pending.field    === 0 && incompleteByKind.field    === 0} />
              <TabTrigger value="relations"    count={pending.relation} incompleteCount={incompleteByKind.relation} allClear={hasPair && !!countsData && pending.relation === 0 && incompleteByKind.relation === 0} />
              <TabTrigger value="restrictions" allClear={hasPair && !!countsData} />
            </TabsList>
          </div>

          <div className="p-5">
            <TabsContent value="all">
              {hasPair
                ? <AllChangesTab projectId={projectId} fromVersion={fromVersion} toVersion={toVersion} />
                : <p className="text-sm text-slate-500">This is the first version — no previous version to compare against.</p>}
            </TabsContent>
            <TabsContent value="tables">
              <WarningsPanel projectId={projectId} fromVersion={fromVersion} toVersion={toVersion} entityKind="table"
                color="bg-cyan-500" title="Table Resolver"
                description="Approve table removals and PK type changes. Removed tables will have all their rows permanently dropped on migration."
                pendingCount={pending.table} incompleteCount={incompleteByKind.table} />
            </TabsContent>
            <TabsContent value="enums">
              <WarningsPanel projectId={projectId} fromVersion={fromVersion} toVersion={toVersion} entityKind="enum"
                color="bg-indigo-500" title="Enum Resolver"
                description="Map removed enum values to replacements. Any row holding a removed value must be remapped — otherwise the insert will fail."
                pendingCount={pending.enum} incompleteCount={incompleteByKind.enum} />
            </TabsContent>
            <TabsContent value="schema">
              <WarningsPanel projectId={projectId} fromVersion={fromVersion} toVersion={toVersion} entityKind="field"
                color="bg-rose-500" title="Schema Field Resolver"
                description="Set default values for new required fields and type-incompatible changes. Without an explicit default, migration will auto-generate a placeholder — which is almost never what you want."
                pendingCount={pending.field} incompleteCount={incompleteByKind.field} />
            </TabsContent>
            <TabsContent value="relations">
              <WarningsPanel projectId={projectId} fromVersion={fromVersion} toVersion={toVersion} entityKind="relation"
                color="bg-violet-500" title="Relation Resolver"
                description="Approve removed relations. The FK column and its values will be dropped on migration."
                pendingCount={pending.relation} incompleteCount={incompleteByKind.relation} />
            </TabsContent>
            <TabsContent value="restrictions">
              <WarningsPanel projectId={projectId} fromVersion={fromVersion} toVersion={toVersion} entityKind="restriction"
                color="bg-blue-500" title="Restriction Resolver"
                description="Approve UNIQUE constraint additions. Migration fails if duplicate values exist in the column — deduplicate before proceeding." />
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
              Tracks when a field&apos;s <code className="font-mono">@default</code> is added, changed, or removed. Existing rows may need backfilling when a default is added.
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
