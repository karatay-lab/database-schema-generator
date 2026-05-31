"use client";

type ProgressEvent = { name: string };

export function MigrationProgressBar({
  phase,
  progressPct,
  progressTables,
  progressTotal,
}: {
  phase: "idle" | "schema_push" | "inserting";
  progressPct: number;
  progressTables: ProgressEvent[];
  progressTotal: number;
}) {
  if (phase === "idle") return null;

  return (
    <div className="fixed left-0 right-0 top-0 z-60">
      <div className="h-1 bg-slate-200">
        <div
          className="h-full bg-emerald-500 transition-all duration-500 ease-out"
          style={{ width: `${progressPct}%` }}
        />
      </div>
      <div className="flex items-center gap-3 border-b border-slate-200 bg-white px-5 py-2 shadow-sm">
        <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
        <p className="text-xs font-semibold text-slate-700">
          {phase === "schema_push"
            ? "Applying schema…"
            : `Inserting records — ${progressTables.length} / ${progressTotal} tables`}
        </p>
        {phase === "inserting" && progressTables.length > 0 && (
          <span className="ml-auto font-mono text-[11px] text-slate-500">
            {progressTables[progressTables.length - 1]!.name}
          </span>
        )}
      </div>
    </div>
  );
}
