"use client";

import { classNames } from "../shared/dashboard-data";
import type { MigrationOrderItem } from "@/types/migrations";

type CollectTable = { name: string; count: number };
type CollectMismatch = { schemaTable: string; resolvedTable: string | null };

type CollectResultModalProps = {
  isOpen: boolean;
  isVersionPlan: boolean;
  syncVersion: string;
  collectTotal: number;
  collectTables: CollectTable[];
  collectQueryError: string;
  collectMismatches: CollectMismatch[];
  collectTimestamp: string;
  collectModalPage: number;
  migrationOrder: MigrationOrderItem[];
  onPageChange: (p: number) => void;
  onCancel: () => void;
  onProceed: () => void;
};

export function CollectResultModal({
  isOpen, isVersionPlan, syncVersion,
  collectTotal, collectTables, collectQueryError, collectMismatches,
  collectTimestamp, collectModalPage, migrationOrder,
  onPageChange, onCancel, onProceed,
}: CollectResultModalProps) {
  if (!isOpen || !isVersionPlan) return null;

  const PAGE_SIZE = 15;
  const totalPages = Math.ceil(collectTables.length / PAGE_SIZE);
  const page = collectTables.slice(collectModalPage * PAGE_SIZE, collectModalPage * PAGE_SIZE + PAGE_SIZE);
  const padded = [...page, ...Array.from({ length: PAGE_SIZE - page.length }, () => null)];

  const allMissing = collectTables.length > 0 && collectTables.every((t) => t.count === 0);
  const titleText = !collectQueryError
    ? (collectTotal === 0 ? "No data found on database" : `${collectTables.length} table${collectTables.length !== 1 ? "s" : ""} · ${collectTotal.toLocaleString()} rows`)
    : (allMissing ? "Tables not found on database" : "Some tables could not be queried");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
      <div className="flex w-full max-w-2xl flex-col rounded-lg border border-slate-200 bg-white shadow-2xl" style={{ maxHeight: "80vh" }}>
        <div className="shrink-0 border-b border-slate-200 px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Collect Data</p>
          <h3 className="mt-1 text-lg font-semibold text-slate-950">{titleText}</h3>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
          {collectMismatches.length > 0 && (
            <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3">
              <p className="text-xs font-semibold text-rose-700">
                {collectMismatches.filter((m) => !m.resolvedTable).length} schema table{collectMismatches.filter((m) => !m.resolvedTable).length !== 1 ? "s" : ""} not found in the database.
                {" "}Check that your sync version matches the current database state.
              </p>
              <div className="mt-2 space-y-1">
                {collectMismatches.map((m) => (
                  <div key={m.schemaTable} className="flex items-center gap-2 font-mono text-[11px]">
                    <span className="rounded bg-rose-100 px-1.5 py-0.5 text-rose-700">{m.schemaTable}</span>
                    <span className="text-rose-400">→</span>
                    {m.resolvedTable
                      ? <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-700">{m.resolvedTable} (case-fixed)</span>
                      : <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-500">not found in DB</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {collectQueryError && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-xs font-semibold text-amber-700">
                {allMissing
                  ? `None of the ${collectTables.length} tables exist on this database yet. Snapshot saved with 0 rows — you can proceed to migrate from scratch.`
                  : `${collectQueryError.split(" | ").length} table${collectQueryError.split(" | ").length !== 1 ? "s" : ""} could not be queried.`}
              </p>
              <div className="mt-2 max-h-40 space-y-0.5 overflow-y-auto">
                {collectQueryError.split(" | ").map((err, i) => (
                  <p key={i} className="font-mono text-[11px] text-amber-600">{err}</p>
                ))}
              </div>
            </div>
          )}

          {collectTables.length > 0 ? (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                {padded.map((t, i) => (
                  <div key={t ? t.name : `empty-${i}`}
                    className={classNames("rounded-md border px-3 py-2.5", t ? "border-slate-200 bg-white" : "border-transparent")}>
                    {t && (
                      <>
                        <p className="truncate font-mono text-[11px] font-semibold text-slate-800">{t.name}</p>
                        <p className={classNames("mt-0.5 font-mono text-xs", t.count === 0 ? "text-slate-400" : "font-semibold text-emerald-700")}>
                          {t.count.toLocaleString()} rows
                        </p>
                      </>
                    )}
                  </div>
                ))}
              </div>
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-1">
                  <button type="button" onClick={() => onPageChange(Math.max(0, collectModalPage - 1))}
                    disabled={collectModalPage === 0 || undefined}
                    className="h-7 rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">
                    ← Prev
                  </button>
                  <span className="text-xs text-slate-500">Page {collectModalPage + 1} of {totalPages} <span className="ml-2 text-slate-400">({collectTables.length} tables)</span></span>
                  <button type="button" onClick={() => onPageChange(Math.min(totalPages - 1, collectModalPage + 1))}
                    disabled={collectModalPage === totalPages - 1 || undefined}
                    className="h-7 rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">
                    Next →
                  </button>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-600">No models were found in schema version <span className="font-semibold">{syncVersion}</span>.</p>
          )}

          {collectTables.length > 0 && collectTotal === 0 && !collectQueryError && (
            <p className="text-xs text-slate-500">All tables are empty. You can proceed to migrate the schema structure, or populate the database first and collect again.</p>
          )}
          {collectTables.length > 0 && collectTotal === 0 && collectQueryError && (
            <p className="text-xs text-slate-500">Snapshots with 0 rows were saved. Click Proceed Anyway to continue; the migration will create and populate the tables from scratch.</p>
          )}

          {migrationOrder.length > 0 && (
            <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Migration order</p>
              <p className="mt-1 font-mono text-xs text-slate-700">{migrationOrder.map((item) => item.modelName).join(" -> ")}</p>
            </div>
          )}
        </div>

        <div className="shrink-0 flex items-center justify-end gap-3 border-t border-slate-200 px-5 py-4">
          <button type="button" onClick={onCancel}
            className="h-9 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
            Cancel
          </button>
          {collectTables.length > 0 && (
            <button type="button" onClick={onProceed}
              className="h-9 min-w-32 rounded-md bg-slate-800 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700">
              {collectQueryError ? "Proceed Anyway" : "Proceed"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
