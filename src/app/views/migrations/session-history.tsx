"use client";

import { classNames } from "../shared/dashboard-data";

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
  if (sessions.length === 0) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Session History</p>
        <p className="mt-0.5 text-sm text-slate-500">Past migration runs for this project. Click a row to resume.</p>
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
    </div>
  );
}
