"use client";

import { useState } from "react";
import { classNames } from "@/lib/utils";

type MigrationSession = {
  id: string;
  projectId: string;
  projectName: string;
  connectionId: string;
  fromVersion: string;
  toVersion: string;
  collectTimestamp: string | null;
  collectTableCount: number | null;
  collectRowCount: number | null;
  collectTables: { name: string; count: number }[] | null;
  runStatus: string | null;
  runLogPath: string | null;
  updatedAt: string;
};

type SessionHistoryProps = {
  sessions: MigrationSession[];
  onResume: (session: MigrationSession) => void;
};

export function SessionHistory({ sessions, onResume }: SessionHistoryProps) {
  const [open, setOpen] = useState(false);

  if (sessions.length === 0) return null;

  const successCount = sessions.filter((s) => s.runStatus === "success").length;
  const partialCount = sessions.filter((s) => s.runStatus === "partial").length;
  const failCount    = sessions.filter((s) => s.runStatus && s.runStatus !== "success" && s.runStatus !== "partial").length;

  return (
    <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
      {/* ── Accordion header (always visible) ─────────────────────────────── */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-slate-50/60"
      >
        <div className="flex items-center gap-3">
          {/* Chevron */}
          <svg
            viewBox="0 0 16 16"
            fill="none"
            strokeWidth={2}
            stroke="currentColor"
            className={classNames("h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200", open && "rotate-90")}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 4l4 4-4 4" />
          </svg>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              Session History
              <span className="ml-2 font-mono normal-case tracking-normal text-slate-400">({sessions.length})</span>
            </p>
            {!open && (
              <p className="mt-0.5 text-[11px] text-slate-400">
                Click to expand past migration runs.
              </p>
            )}
          </div>
        </div>

        {/* Summary pills — visible when collapsed */}
        {!open && (
          <div className="flex shrink-0 items-center gap-1.5">
            {successCount > 0 && (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                {successCount} success
              </span>
            )}
            {partialCount > 0 && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                {partialCount} partial
              </span>
            )}
            {failCount > 0 && (
              <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
                {failCount} failed
              </span>
            )}
          </div>
        )}
      </button>

      {/* ── Expandable table ─────────────────────────────────────────────── */}
      {open && (
        <>
          <div className="border-t border-slate-100 px-5 pb-1 pt-1.5">
            <p className="text-[11px] text-slate-400">Click a row to resume that session.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                  <th className="px-4 py-2.5 text-left">Project</th>
                  <th className="px-4 py-2.5 text-left">From</th>
                  <th className="px-4 py-2.5 text-left">To</th>
                  <th className="px-4 py-2.5 text-right">Tables</th>
                  <th className="px-4 py-2.5 text-right">Rows</th>
                  <th className="px-4 py-2.5 text-left">Snapshot</th>
                  <th className="px-4 py-2.5 text-left">Run</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sessions.map((s) => (
                  <tr key={s.id} className="group transition hover:bg-slate-50">
                    <td className="px-4 py-3 font-semibold text-slate-800">{s.projectName}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-700">{s.fromVersion}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-700">{s.toVersion}</td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-slate-600">
                      {s.collectTableCount ?? <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-slate-600">
                      {s.collectRowCount != null ? s.collectRowCount.toLocaleString() : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-500">
                      {s.collectTimestamp ?? <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {s.runStatus ? (
                        <span className={classNames(
                          "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                          s.runStatus === "success" ? "bg-emerald-100 text-emerald-700"
                          : s.runStatus === "partial" ? "bg-amber-100 text-amber-700"
                          : "bg-rose-100 text-rose-700",
                        )}>
                          {s.runStatus}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => onResume(s)}
                        className="rounded-md border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 opacity-0 transition hover:border-slate-300 hover:bg-slate-50 group-hover:opacity-100"
                      >
                        Resume
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
