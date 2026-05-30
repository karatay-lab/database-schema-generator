"use client";

import { classNames } from "../shared/dashboard-data";
import type { MigrateResult } from "@/types/sql-query";

type MigrationModalProps = {
  isOpen: boolean;
  migrating: boolean;
  migrateResult: MigrateResult | null;
  deletingSchema: boolean;
  onDeleteSchema: () => void;
  onClose: () => void;
};

export function MigrationModal({
  isOpen, migrating, migrateResult, deletingSchema, onDeleteSchema, onClose,
}: MigrationModalProps) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-3">
      <div className="flex max-h-[85vh] w-[96vw] max-w-3xl flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Database Migration</p>
            <h3 className="mt-1 text-lg font-semibold text-slate-950">
              {migrating
                ? "Validating and pushing schema…"
                : migrateResult?.success
                  ? "Migration succeeded"
                  : migrateResult?.stage === "validate"
                    ? "Schema validation failed"
                    : "Push failed"}
            </h3>
            {!migrating && migrateResult?.relPath && (
              <p className="mt-1 font-mono text-xs text-slate-400">{migrateResult.relPath}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!migrating && migrateResult?.stage === "validate" && migrateResult.schemaRelPath && (
              <button
                type="button"
                onClick={onDeleteSchema}
                disabled={deletingSchema}
                className="h-9 rounded-md border border-rose-300 bg-white px-3 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {deletingSchema ? "Deleting…" : "Delete Schema"}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              disabled={migrating}
              className="h-9 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Close
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {migrating ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-8 text-center text-sm font-semibold text-slate-500">
              Running prisma validate then prisma db push…
            </div>
          ) : migrateResult ? (
            <>
              <div className={classNames(
                "rounded-md border px-4 py-3",
                migrateResult.success ? "border-emerald-200 bg-emerald-50"
                : migrateResult.stage === "validate" ? "border-amber-200 bg-amber-50"
                : "border-rose-200 bg-rose-50",
              )}>
                <p className={classNames(
                  "text-sm font-semibold",
                  migrateResult.success ? "text-emerald-700"
                  : migrateResult.stage === "validate" ? "text-amber-700"
                  : "text-rose-700",
                )}>
                  {migrateResult.success
                    ? "SQLite database created and schema pushed."
                    : migrateResult.stage === "validate"
                      ? "The SQLite schema has validation errors. Fix the issues in your project schema (Relations page) then try again."
                      : "Schema is valid but the push failed — see output below."}
                </p>
                {migrateResult.success && migrateResult.schemaRelPath && (
                  <p className="mt-1 font-mono text-xs text-emerald-600">Schema written to {migrateResult.schemaRelPath}</p>
                )}
                {!migrateResult.success && migrateResult.schemaRelPath && (
                  <p className="mt-1 font-mono text-xs text-slate-500">Generated schema: {migrateResult.schemaRelPath}</p>
                )}
                {migrateResult.backupRelPath && (
                  <p className="mt-1 font-mono text-xs text-amber-600">Backup saved to {migrateResult.backupRelPath}</p>
                )}
              </div>
              {(migrateResult.steps ?? []).map((step) => (
                <div key={step.name} className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className={classNames("inline-flex h-2 w-2 rounded-full", step.success ? "bg-emerald-500" : "bg-rose-500")} />
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                      {step.name === "validate" ? "prisma validate" : "prisma db push"}
                    </p>
                    <span className={classNames("rounded px-1.5 py-0.5 text-[11px] font-bold", step.success ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700")}>
                      {step.success ? "passed" : "failed"}
                    </span>
                  </div>
                  {step.output && (
                    <pre className="overflow-x-auto rounded-md border border-slate-200 bg-slate-950 px-4 py-3 font-mono text-xs leading-6 text-slate-200 whitespace-pre-wrap">
                      {step.output}
                    </pre>
                  )}
                </div>
              ))}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
