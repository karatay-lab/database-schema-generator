"use client";

import { Card, CardHeader, CardBody } from "@/components/built";
import { StateChip, StepBadge } from "@/components/migrations/phase-state";
import { ErrorBox } from "@/components/migrations/error-box";
import { MigrationLabel as Label } from "@/components/migrations/migration-form";
import type { PhaseState } from "@/types/migrations";

type DeploySchemaCardProps = {
  connectState: PhaseState;
  pushState: PhaseState;
  pushError: string;
  lastPushMode: "safe" | "destroy" | null;
  newTargetVersion: string;
  versions: string[];
  onVersionChange: (v: string) => void;
  onDeploySchema: () => void;
  onDestroyOpen: () => void;
  onDeployAgain: () => void;
};

export function DeploySchemaCard({
  connectState, pushState, pushError, lastPushMode,
  newTargetVersion, versions,
  onVersionChange, onDeploySchema, onDestroyOpen, onDeployAgain,
}: DeploySchemaCardProps) {
  return (
    <Card locked={connectState !== "success"}>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <StepBadge n={2} state={pushState} />
            <div>
              <p className="text-sm font-semibold text-slate-950">Deploy Schema</p>
              <p className="text-xs text-slate-500">
                Deploy Schema applies changes non-destructively. Destroy &amp; Deploy force-resets the entire database.
              </p>
            </div>
          </div>
          <StateChip state={pushState} />
        </div>
      </CardHeader>

      <CardBody>
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1">
            <Label>Deploy version</Label>
            <select value={newTargetVersion} onChange={(e) => onVersionChange(e.target.value)}
              className="h-9 min-w-40 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-slate-500">
              {versions.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>

          <button type="button" onClick={onDeploySchema}
            disabled={pushState === "loading" || pushState === "success" || undefined}
            className="h-9 min-w-40 rounded-md border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">
            {pushState === "loading" && lastPushMode === "safe" ? "Deploying…" : "Deploy Schema"}
          </button>

          <button type="button" onClick={onDestroyOpen}
            disabled={pushState === "loading" || pushState === "success" || undefined}
            className="h-9 min-w-44 rounded-md bg-rose-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-slate-300">
            {pushState === "loading" && lastPushMode === "destroy" ? "Deploying…" : "Destroy & Deploy"}
          </button>

          {pushState === "success" && (
            <button type="button" onClick={onDeployAgain}
              className="h-9 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
              Deploy Again
            </button>
          )}
        </div>

        {pushState === "success" && (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3">
            <p className="text-sm font-semibold text-emerald-700">
              ✓ Schema version {newTargetVersion} successfully deployed
              {lastPushMode === "destroy" ? " (database force-reset)" : ""}.
            </p>
          </div>
        )}

        {pushError && (
          <>
            <ErrorBox message={pushError} />
            {lastPushMode === "safe" && /cannot be executed|force.reset/i.test(pushError) && (
              <p className="text-xs font-semibold text-amber-700">
                The schema has incompatible changes that require a full reset. Use <span className="font-mono">Destroy &amp; Deploy</span> to force-reset the database.
              </p>
            )}
          </>
        )}
      </CardBody>
    </Card>
  );
}
