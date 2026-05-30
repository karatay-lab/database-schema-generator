"use client";

import type { InvalidRow } from "@/types/migrations";

type FixRowsModalProps = {
  isOpen: boolean;
  invalidRows: InvalidRow[];
  rowPatches: Record<string, Record<string, string>>;
  fixModalLoading: boolean;
  fixModalError: string;
  onPatch: (patches: Record<string, Record<string, string>>) => void;
  onCancel: () => void;
  onFixAndMigrate: () => void;
};

export function FixRowsModal({
  isOpen, invalidRows, rowPatches, fixModalLoading, fixModalError,
  onPatch, onCancel, onFixAndMigrate,
}: FixRowsModalProps) {
  if (!isOpen) return null;

  const editCount = Object.values(rowPatches).reduce((s, p) => s + Object.keys(p).length, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
      <div className="flex w-full max-w-4xl flex-col rounded-lg border border-slate-200 bg-white shadow-2xl" style={{ maxHeight: "85vh" }}>
        <div className="shrink-0 border-b border-slate-200 px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-rose-600">Validation Failed</p>
          <h3 className="mt-1 text-lg font-semibold text-slate-950">
            {invalidRows.length} row{invalidRows.length !== 1 ? "s" : ""} need to be fixed before migrating
          </h3>
          <p className="mt-0.5 text-sm text-slate-500">
            Edit the values below, then click <span className="font-semibold text-slate-700">Re-validate &amp; Run</span>.
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                <th className="px-4 py-2.5 text-left">Model</th>
                <th className="px-4 py-2.5 text-left">Row</th>
                <th className="px-4 py-2.5 text-left">Field</th>
                <th className="w-56 px-4 py-2.5 text-left">Value</th>
                <th className="px-4 py-2.5 text-left">Error</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invalidRows.map((row, idx) => {
                const patchKey = `${row.table}:${row.rowIndex}`;
                const patchedValue = rowPatches[patchKey]?.[row.field];
                const displayValue = patchedValue !== undefined ? patchedValue : String(row.value ?? "");
                return (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5 font-mono text-xs font-semibold text-slate-800">{row.table}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{row.rowIndex}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-700">{row.field}</td>
                    <td className="px-4 py-2.5">
                      <input
                        type="text"
                        value={displayValue}
                        onChange={(e) => {
                          onPatch({
                            ...rowPatches,
                            [patchKey]: { ...(rowPatches[patchKey] ?? {}), [row.field]: e.target.value },
                          });
                        }}
                        className="h-7 w-full rounded border border-slate-300 bg-white px-2 font-mono text-xs text-slate-900 outline-none focus:border-slate-500"
                      />
                    </td>
                    <td className="px-4 py-2.5 text-xs text-rose-700">{row.error}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {fixModalError && (
          <div className="shrink-0 border-t border-rose-200 bg-rose-50 px-5 py-3">
            <p className="font-mono text-xs text-rose-700">{fixModalError}</p>
          </div>
        )}

        <div className="shrink-0 flex items-center justify-between gap-3 border-t border-slate-200 px-5 py-4">
          <p className="text-xs text-slate-500">
            {editCount > 0 ? `${editCount} field${editCount !== 1 ? "s" : ""} edited` : "No edits yet"}
          </p>
          <div className="flex items-center gap-3">
            <button type="button" onClick={onCancel}
              className="h-9 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
              Cancel
            </button>
            <button type="button" onClick={onFixAndMigrate}
              disabled={fixModalLoading || undefined}
              className="h-9 min-w-44 rounded-md bg-slate-800 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400">
              {fixModalLoading ? "Validating…" : "Re-validate & Run"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
