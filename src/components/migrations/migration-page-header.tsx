"use client";

import type { MigrationPlan } from "@/types/migrations";

type ActiveConnection = { name: string } | null;

export function MigrationPageHeader({
  provider,
  projectName,
  migrationPlan,
  isNewPlan,
  newTargetVersion,
  targetVersion,
  activeConnection,
}: {
  provider: string;
  projectName: string;
  migrationPlan: MigrationPlan | null;
  isNewPlan: boolean;
  newTargetVersion: string;
  targetVersion: string;
  activeConnection: ActiveConnection;
}) {
  const displayTarget = migrationPlan && (isNewPlan ? newTargetVersion : targetVersion);

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-5 py-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Migrations</p>
          <h3 className="mt-1 text-xl font-semibold text-slate-950">Schema Migration Workflow</h3>
          <p className="mt-1 text-sm text-slate-500">
            Connect to a database, then deploy a fresh schema or migrate data between versions.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600">
            {provider}
          </span>
          <span className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600">
            {projectName}
          </span>
          {displayTarget && (
            <span className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600">
              Target: {displayTarget}
            </span>
          )}
          {activeConnection && (
            <span className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
              ● {activeConnection.name}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
