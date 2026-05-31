"use client";

import { classNames } from "@/lib/utils";
import { MigrationLabel as Label } from "@/components/migrations/migration-form";
import type { CheckSyncResponse, MigrationPlan } from "@/types/migrations";

type SyncCheckState = "idle" | "loading" | "compatible" | "incompatible";

type MigrationTypeSelectorProps = {
  canDoAnyMigration: boolean;
  /** When true the selector is dimmed and interactions are blocked — shown before a connection is established. */
  connectionRequired?: boolean;
  isNewPlan: boolean;
  isVersionPlan: boolean;
  canVersionMigrate: boolean;
  dbIsEmpty: boolean;
  syncVersion: string;
  targetVersion: string;
  versions: string[];
  syncCheckState: SyncCheckState;
  syncCheckResult: CheckSyncResponse | null;
  onChangePlan: (plan: MigrationPlan) => void;
  onSyncVersionChange: (v: string) => void;
  onTargetVersionChange: (v: string) => void;
};

export function MigrationTypeSelector({
  canDoAnyMigration, connectionRequired, isNewPlan, isVersionPlan, canVersionMigrate, dbIsEmpty,
  syncVersion, targetVersion, versions, syncCheckState, syncCheckResult,
  onChangePlan, onSyncVersionChange, onTargetVersionChange,
}: MigrationTypeSelectorProps) {
  return (
    <div className={classNames("rounded-lg border border-slate-200 bg-white px-5 py-4 shadow-sm transition",
      connectionRequired && "pointer-events-none select-none opacity-50")}>
      <div className="mb-3 flex items-center gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Migration Type</p>
        {connectionRequired && (
          <span className="rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400">
            Connect first
          </span>
        )}
      </div>

      {!canDoAnyMigration ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm font-semibold text-amber-700">At least one project version is required to run a migration.</p>
          <p className="mt-1 text-xs text-amber-600">Go to the Projects workspace and create a version before continuing.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button type="button" onClick={() => onChangePlan("new")}
            className={classNames("rounded-lg border-2 p-4 text-left transition",
              isNewPlan ? "border-cyan-500 bg-cyan-50" : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50")}>
            <div className="flex items-start gap-3">
              <span className={classNames("mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition",
                isNewPlan ? "border-cyan-500 bg-cyan-500" : "border-slate-300")}>
                {isNewPlan && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-950">Destroy and Deploy Schema</p>
                <p className="mt-0.5 text-xs text-slate-500">Wipe the database and deploy a schema version from scratch. All existing data will be lost.</p>
                {dbIsEmpty && <span className="mt-2 inline-block rounded-full bg-cyan-100 px-2 py-0.5 text-[10px] font-semibold text-cyan-700">Empty DB detected</span>}
              </div>
            </div>
          </button>

          <button type="button"
            onClick={() => { if (!dbIsEmpty && canVersionMigrate) onChangePlan("version"); }}
            disabled={dbIsEmpty || !canVersionMigrate || undefined}
            className={classNames("rounded-lg border-2 p-4 text-left transition",
              isVersionPlan ? "border-cyan-500 bg-cyan-50"
              : dbIsEmpty || !canVersionMigrate ? "cursor-not-allowed border-slate-200 bg-slate-50 opacity-50"
              : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50")}>
            <div className="flex items-start gap-3">
              <span className={classNames("mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition",
                isVersionPlan ? "border-cyan-500 bg-cyan-500" : "border-slate-300")}>
                {isVersionPlan && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-950">Sync and Migrate to Another Version</p>
                <p className="mt-0.5 text-xs text-slate-500">Collect existing data, validate, and migrate between schema versions.</p>
                {dbIsEmpty && <span className="mt-2 inline-block rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-500">DB is empty — use Destroy and Deploy Schema</span>}
                {!canVersionMigrate && !dbIsEmpty && <span className="mt-2 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">Requires 2+ project versions</span>}
              </div>
            </div>
          </button>
        </div>
      )}

      {isVersionPlan && (
        <div className="mt-4 flex flex-wrap items-start gap-3 border-t border-slate-100 pt-4">
          <div className="flex min-w-[220px] flex-1 flex-col gap-1">
            <Label>Database is currently at</Label>
            <select value={syncVersion} onChange={(e) => onSyncVersionChange(e.target.value)}
              className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-slate-500">
              <option value="" disabled>Select a version…</option>
              {versions.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
            {syncVersion && syncCheckState === "loading" && <p className="text-[11px] text-slate-500">Checking compatibility…</p>}
            {syncVersion && syncCheckState === "compatible" && <p className="text-[11px] font-semibold text-emerald-600">✓ Schema matches database</p>}
            {syncVersion && syncCheckState === "incompatible" && (
              <div className="rounded-md border border-rose-200 bg-rose-50 px-2.5 py-2 space-y-1">
                <p className="text-[11px] font-semibold text-rose-600">✗ Schema does not match this database</p>
                {syncCheckResult?.error && <p className="text-[11px] text-rose-500">{syncCheckResult.error}</p>}
                {(syncCheckResult?.missingTables?.length ?? 0) > 0 && (
                  <p className="text-[11px] text-rose-500">Missing tables: <span className="font-mono">{syncCheckResult!.missingTables!.join(", ")}</span></p>
                )}
                {(syncCheckResult?.columnIssues?.length ?? 0) > 0 && (
                  <div className="space-y-0.5">
                    {syncCheckResult!.columnIssues!.map((issue) => (
                      <p key={issue.table} className="text-[11px] text-rose-500">
                        <span className="font-mono font-semibold">{issue.table}</span>: missing <span className="font-mono">{issue.missingColumns.join(", ")}</span>
                      </p>
                    ))}
                  </div>
                )}
                <p className="text-[11px] italic text-rose-400">Select the version that reflects the database&apos;s current state.</p>
              </div>
            )}
          </div>

          {syncVersion && syncCheckState === "compatible" && (
            <>
              <span className="mt-6 shrink-0 text-slate-400">→</span>
              <div className="flex min-w-[220px] flex-1 flex-col gap-1">
                <Label>Migrate to</Label>
                <select value={targetVersion} onChange={(e) => onTargetVersionChange(e.target.value)}
                  className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-slate-500">
                  <option value="" disabled>Select a version…</option>
                  {versions.filter((_, idx) => idx > versions.indexOf(syncVersion)).map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
