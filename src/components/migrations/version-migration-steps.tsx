"use client";

import Link from "next/link";
import { classNames } from "@/lib/utils";
import { Card, CardHeader, CardBody } from "@/components/built";
import { StateChip, StepBadge } from "@/components/migrations/phase-state";
import { ErrorBox } from "@/components/migrations/error-box";
import { IssueSection } from "@/components/migrations/issue-section";
import { ModelDiff } from "@/components/migrations/model-diff";
import { shortUuid } from "@/constants/migrations";
import type {
  ConnectionRecord,
  ModelComparisonResult,
  MigrationOrderItem,
  PhaseState,
  RunResponse,
  SchemaCheckResponse,
  ValidationIssue,
} from "@/types/migrations";
import type { SchemaWarning } from "@/lib/schema-warnings-store";

type CollectTable = { name: string; count: number };

type VersionMigrationStepsProps = {
  isVersionPlan: boolean;
  // Step 2 — Model Diff
  projectName: string;
  versions: string[];
  syncVersion: string;
  targetVersion: string;
  modelDiffState: PhaseState;
  comparison: ModelComparisonResult | null;
  warnings: SchemaWarning[];
  breakingPendingCount: number;
  defaultsRequiredCount: number;
  trackingHref: string;
  canModelDiff: boolean;
  onZodGenerated: () => void;
  onOpenFullScreen: () => void;
  onComparisonReady: (c: ModelComparisonResult) => void;
  // Step 3 — Schema Check
  canSchemaCheck: boolean;
  schemaCheckState: PhaseState;
  schemaCheckResult: SchemaCheckResponse | null;
  onSchemaCheck: () => void;
  // Step 4 — Collect
  canCollect: boolean;
  collectState: PhaseState;
  collectError: string;
  collectTables: CollectTable[];
  collectTotal: number;
  collectTimestamp: string;
  migrationOrder: MigrationOrderItem[];
  restoreState: "idle" | "loading" | "success" | "error";
  restoreError: string;
  restoreTables: { name: string; created: number; updated: number; errors: number }[];
  collectBtnDisabled: boolean | undefined;
  onCollect: () => void;
  onRestore: () => void;
  // Step 5 — Validate & Migrate
  canMigrate: boolean;
  migrateState: PhaseState;
  migrateError: string;
  validateState: PhaseState;
  validateError: string;
  stage1Issues: ValidationIssue[];
  stage2Issues: ValidationIssue[];
  errorCount: number;
  migrateTables: RunResponse["tables"];
  migrateVersion: string;
  activeConnection: ConnectionRecord | null;
  validateBtnDisabled: boolean | undefined;
  migrateBtnDisabled: boolean | undefined;
  onValidate: () => void;
  onShowPreflight: () => void;
  // Full-screen diff modal
  showModelDiffModal: boolean;
  onCloseModelDiff: () => void;
};

export function VersionMigrationSteps({
  isVersionPlan,
  projectName, versions, syncVersion, targetVersion,
  modelDiffState, comparison, warnings, breakingPendingCount, defaultsRequiredCount,
  trackingHref, canModelDiff,
  onZodGenerated, onOpenFullScreen, onComparisonReady,
  canSchemaCheck, schemaCheckState, schemaCheckResult, onSchemaCheck,
  canCollect, collectState, collectError, collectTables, collectTotal,
  collectTimestamp, migrationOrder, restoreState, restoreError, restoreTables,
  collectBtnDisabled, onCollect, onRestore,
  canMigrate, migrateState, migrateError, validateState, validateError,
  stage1Issues, stage2Issues, errorCount, migrateTables, migrateVersion,
  activeConnection, validateBtnDisabled, migrateBtnDisabled, onValidate, onShowPreflight,
  showModelDiffModal, onCloseModelDiff,
}: VersionMigrationStepsProps) {
  if (!isVersionPlan) return null;

  return (
    <>
      {/* Step 2: Schema Change Review */}
      <Card locked={!canModelDiff}>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <StepBadge n={3} state={modelDiffState} />
              <div>
                <p className="text-sm font-semibold text-slate-950">Schema Change Review</p>
                <p className="text-xs text-slate-500">Compare schema versions, flag breaking changes, and generate validators to proceed.</p>
              </div>
            </div>
            <StateChip state={modelDiffState} />
          </div>
        </CardHeader>
        <CardBody>
          <ModelDiff inline projectName={projectName} versions={versions}
            fromVersion={syncVersion} toVersion={targetVersion}
            onZodGenerated={onZodGenerated}
            onOpenFullScreen={onOpenFullScreen}
            onComparisonReady={onComparisonReady}
          />

          {warnings.length > 0 && (
            <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Tracking Workflow Review</p>
                <Link href={trackingHref}
                  className="flex h-7 items-center rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50">
                  Go To Tracking Workflow →
                </Link>
              </div>
              <div className="flex flex-wrap gap-2">
                {([
                  { label: "Tables", count: warnings.filter((w) => w.entityKind === "table").length },
                  { label: "Enums", count: warnings.filter((w) => w.entityKind === "enum").length },
                  { label: "Schema", count: warnings.filter((w) => w.entityKind === "field").length },
                  { label: "Relations", count: warnings.filter((w) => w.entityKind === "relation").length },
                  { label: "Restrictions", count: 0 },
                ]).map(({ label, count }) => (
                  <div key={label} className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5">
                    <span className="text-xs font-semibold text-slate-700">{label}</span>
                    <span className={classNames("rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                      count > 0 ? "bg-slate-100 text-slate-600" : "bg-slate-50 text-slate-400")}>{count}</span>
                  </div>
                ))}
              </div>
              {breakingPendingCount > 0 ? (
                <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3">
                  <p className="text-sm font-semibold text-rose-700">
                    {breakingPendingCount} breaking {breakingPendingCount === 1 ? "change requires" : "changes require"} approval before you can proceed.
                  </p>
                  <p className="mt-0.5 text-xs text-rose-600">Approve all breaking changes in the Tracking Workflow to unlock schema validation.</p>
                </div>
              ) : defaultsRequiredCount > 0 ? (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3">
                  <p className="text-sm font-semibold text-amber-700">
                    {defaultsRequiredCount} {defaultsRequiredCount === 1 ? "item needs" : "items need"} an explicit decision before migration.
                  </p>
                  <p className="mt-0.5 text-xs text-amber-600">Set replacement values for removed enum values and default values for new required fields in Tracking.</p>
                </div>
              ) : (
                <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2.5">
                  <svg viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4 shrink-0 text-emerald-600">
                    <path fillRule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" />
                  </svg>
                  <p className="text-sm font-semibold text-emerald-700">All changes approved in Tracking Workflow — approved actions will be taken.</p>
                </div>
              )}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Step 3: Validate Schemas */}
      <Card locked={!canSchemaCheck}>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <StepBadge n={4} state={schemaCheckState} />
              <div>
                <p className="text-sm font-semibold text-slate-950">Validate Schemas</p>
                <p className="text-xs text-slate-500">Run <code className="font-mono text-[11px]">prisma validate</code> on both schema versions before touching the database.</p>
              </div>
            </div>
            <StateChip state={schemaCheckState} />
          </div>
        </CardHeader>
        <CardBody>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { label: "Source schema", version: syncVersion, result: schemaCheckResult?.sync },
              { label: "Target schema", version: targetVersion, result: schemaCheckResult?.target },
            ].map(({ label, version, result }) => (
              <div key={label} className={classNames("rounded-lg border p-4",
                !result ? "border-slate-200 bg-slate-50"
                : result.valid ? "border-emerald-200 bg-emerald-50"
                : "border-rose-200 bg-rose-50")}>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">{label}</p>
                <p className="mt-1 font-mono text-sm font-semibold text-slate-800">{version}.prisma</p>
                {result && (
                  <p className={classNames("mt-1 text-xs font-semibold", result.valid ? "text-emerald-700" : "text-rose-700")}>
                    {result.valid ? "✓ Valid" : `✗ ${result.errors.length} error${result.errors.length !== 1 ? "s" : ""}`}
                  </p>
                )}
                {result && !result.valid && result.errors.length > 0 && (
                  <div className="mt-2 max-h-40 overflow-y-auto rounded-md bg-rose-100/60 p-2">
                    {result.errors.map((e, i) => <p key={i} className="font-mono text-[10px] text-rose-800">{e}</p>)}
                  </div>
                )}
              </div>
            ))}
          </div>
          {schemaCheckState === "error" && !schemaCheckResult?.sync && !schemaCheckResult?.target && (
            <ErrorBox message={schemaCheckResult?.error ?? "Schema check failed."} />
          )}
          {schemaCheckState === "loading" && (
            <p className="text-xs text-slate-500">Running <code className="font-mono text-[11px]">prisma validate</code> on both schemas…</p>
          )}
          {schemaCheckState === "error" && (schemaCheckResult?.sync || schemaCheckResult?.target) && (
            <div className="flex items-start justify-between gap-4 rounded-md border border-rose-200 bg-rose-50 px-4 py-3">
              <p className="text-sm font-semibold text-rose-700">One or more schemas have validation errors. Fix them in the /schema workflow before proceeding.</p>
              <button type="button" onClick={onSchemaCheck}
                className="shrink-0 rounded-md border border-rose-300 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-50">
                Re-validate
              </button>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Step 4: Collect Data */}
      <Card locked={!canCollect}>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <StepBadge n={5} state={collectState} />
              <div>
                <p className="text-sm font-semibold text-slate-950">Collect Data</p>
                <p className="text-xs text-slate-500">Query all tables from the source database and store a local snapshot.</p>
              </div>
            </div>
            <StateChip state={collectState} />
          </div>
        </CardHeader>
        <CardBody>
          {collectState === "success" && collectTables.length > 0 && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2.5">
                <span className="text-sm font-semibold text-emerald-800">✓ Snapshot collected</span>
                <span className="text-emerald-300">·</span>
                <span className="text-xs text-emerald-700">{collectTables.length} table{collectTables.length !== 1 ? "s" : ""}</span>
                <span className="text-emerald-300">·</span>
                <span className="text-xs font-semibold text-emerald-700">{collectTotal.toLocaleString()} rows total</span>
                <span className="ml-auto font-mono text-[11px] text-emerald-600">{collectTimestamp}</span>
              </div>
              {(() => {
                const maxCount = Math.max(...collectTables.map((t) => t.count), 1);
                return (
                  <div className="overflow-hidden rounded-md border border-slate-200">
                    <div className="grid grid-cols-[minmax(0,1fr)_minmax(80px,35%)_4.5rem] items-center gap-4 border-b border-slate-200 bg-slate-50 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                      <span>Table</span><span>Distribution</span><span className="text-right">Rows</span>
                    </div>
                    {collectTables.map((t) => (
                      <div key={t.name} className="grid grid-cols-[minmax(0,1fr)_minmax(80px,35%)_4.5rem] items-center gap-4 border-b border-slate-100 px-4 py-2.5 last:border-0 hover:bg-slate-50">
                        <span className="truncate font-mono text-xs font-semibold text-slate-800">{t.name}</span>
                        <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-slate-500 transition-all duration-500"
                            style={{ width: `${Math.max((t.count / maxCount) * 100, t.count > 0 ? 2 : 0)}%` }} />
                        </div>
                        <span className="text-right font-mono text-xs text-slate-600">{t.count.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                );
              })()}
              {migrationOrder.length > 0 && (
                <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Migration order</p>
                  <p className="mt-1 font-mono text-xs text-slate-700">{migrationOrder.map((item) => item.modelName).join(" -> ")}</p>
                </div>
              )}
            </div>
          )}
          {collectError && <ErrorBox message={collectError} />}
          <div className="flex items-center justify-between gap-3">
            {collectState === "success" && collectTimestamp && (
              <div className="flex flex-col gap-1">
                <button type="button" onClick={onRestore}
                  disabled={restoreState === "loading" || undefined}
                  className="h-8 rounded-md border border-amber-300 bg-amber-50 px-3 text-xs font-semibold text-amber-800 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50">
                  {restoreState === "loading" ? "Restoring…" : restoreState === "success" ? "✓ Restored" : "Restore to Sync Version"}
                </button>
                {restoreState === "success" && restoreTables.length > 0 && (
                  <p className="text-[10px] font-semibold text-emerald-600">
                    ✓ {restoreTables.reduce((s, t) => s + t.created, 0).toLocaleString()} rows re-inserted
                  </p>
                )}
                {restoreState === "error" && restoreError && <p className="text-[10px] text-rose-600">{restoreError}</p>}
              </div>
            )}
            <button type="button" onClick={onCollect} disabled={collectBtnDisabled}
              className="ml-auto h-9 min-w-48 rounded-md bg-slate-800 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300">
              {collectState === "loading" ? "Collecting…" : "Collect All Tables"}
            </button>
          </div>
        </CardBody>
      </Card>

      {/* Step 5: Validate & Migrate */}
      <Card locked={!canMigrate}>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <StepBadge n={6} state={migrateState} />
              <div>
                <p className="text-sm font-semibold text-slate-950">Validate & Migrate</p>
                <p className="text-xs text-slate-500">Check collected data against both schema versions, then run the migration.</p>
              </div>
            </div>
            <StateChip state={migrateState} />
          </div>
        </CardHeader>
        <CardBody>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="grid gap-4 sm:grid-cols-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Connection</p>
                <p className="mt-1 truncate text-sm font-semibold text-slate-950">{activeConnection?.name ?? "—"}</p>
                <p className="font-mono text-[10px] text-slate-400">{activeConnection ? shortUuid(activeConnection.uuid) : ""}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">From</p>
                <p className="mt-1 text-sm font-semibold text-slate-950">{syncVersion}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">To</p>
                <p className="mt-1 text-sm font-semibold text-slate-950">{targetVersion}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Snapshot</p>
                <p className="mt-1 font-mono text-xs text-slate-700">{collectTimestamp || "—"}</p>
              </div>
            </div>
          </div>

          {/* Step A — Validate */}
          <div className="space-y-3 rounded-lg border border-slate-200 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-slate-800">Step A — Validate Data</p>
                <p className="text-[11px] text-slate-500">Check collected rows against both schema versions using Zod.</p>
              </div>
              <div className="flex items-center gap-2">
                {validateState !== "idle" && <StateChip state={validateState} />}
                <button type="button" onClick={onValidate} disabled={validateBtnDisabled}
                  className="h-8 min-w-36 rounded-md bg-slate-800 px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300">
                  {validateState === "loading" ? "Validating…" : "Validate Data"}
                </button>
              </div>
            </div>
            {validateState === "success" && stage1Issues.length === 0 && stage2Issues.length === 0 && (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2.5">
                <p className="text-sm font-semibold text-emerald-700">✓ All records pass both validation stages.</p>
              </div>
            )}
            {validateError && <ErrorBox message={validateError} />}
            {validateState === "success" && (
              <>
                <IssueSection title="Stage 1 — Shape vs Source Schema" issues={stage1Issues} />
                <IssueSection title="Stage 2 — Zod vs Target Schema" issues={stage2Issues} />
              </>
            )}
          </div>

          {validateState === "success" && errorCount > 0 && (
            <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3">
              <p className="text-sm font-semibold text-rose-700">
                {errorCount} blocking error{errorCount !== 1 ? "s" : ""} must be resolved before migrating.
              </p>
            </div>
          )}

          {/* Step B — Migrate */}
          <div className="space-y-3 rounded-lg border border-slate-200 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-slate-800">Step B — Review &amp; Run</p>
                <p className="text-[11px] text-slate-500">Review the migration plan and begin. The target schema will be reset and all validated records re-inserted.</p>
              </div>
              <button type="button" onClick={onShowPreflight} disabled={migrateBtnDisabled}
                className="h-8 min-w-36 rounded-md bg-slate-800 px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300">
                {migrateState === "loading" ? "Migrating…" : "Review & Run"}
              </button>
            </div>
            {migrateState === "success" && migrateTables && migrateTables.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-3 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2.5">
                  <p className="text-sm font-semibold text-emerald-700">✓ Migration complete — now at version {migrateVersion}</p>
                  <span className="ml-auto text-xs text-emerald-600">
                    {migrateTables.reduce((s, t) => s + t.created, 0).toLocaleString()} rows inserted
                  </span>
                </div>
                <div className="overflow-hidden rounded-md border border-slate-200">
                  <div className="grid grid-cols-[1fr_5rem_5rem_5rem] border-b border-slate-200 bg-slate-50 px-4 py-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                    <span>Table</span><span className="text-right">Created</span><span className="text-right">Updated</span><span className="text-right">Errors</span>
                  </div>
                  {migrateTables.map((t) => (
                    <div key={t.name} className="grid grid-cols-[1fr_5rem_5rem_5rem] border-b border-slate-100 px-4 py-2.5 last:border-0 hover:bg-slate-50">
                      <span className="font-mono text-xs font-semibold text-slate-800">{t.name}</span>
                      <span className="text-right font-mono text-xs text-emerald-700">{t.created}</span>
                      <span className="text-right font-mono text-xs text-blue-700">{t.updated}</span>
                      <span className={classNames("text-right font-mono text-xs", t.errors > 0 ? "font-semibold text-rose-700" : "text-slate-400")}>{t.errors}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {migrateError && <ErrorBox message={migrateError} />}
          </div>
        </CardBody>
      </Card>

      {/* Full-screen Model Diff modal */}
      {showModelDiffModal && (
        <ModelDiff
          projectName={projectName}
          versions={versions}
          fromVersion={syncVersion}
          toVersion={targetVersion}
          onClose={onCloseModelDiff}
          onZodGenerated={onZodGenerated}
        />
      )}
    </>
  );
}
