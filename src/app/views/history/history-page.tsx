"use client";

import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { classNames } from "../shared/dashboard-data";
import { useDashboard } from "../shared/dashboard-context";
import { useProjectInfo } from "../shared/project-info-context";

type VersionHistory = {
  name: string;
  createdAt: string;
  tables: number;
  fields: number;
  relations: number;
  restrictions: number;
};

function formatDate(iso: string) {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
    }).format(new Date(iso));
  } catch { return "—"; }
}

function StatBadge({ label, value }: { label: string; value: number }) {
  return (
    <span className="inline-flex flex-col items-center rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-center">
      <span className="text-base font-bold text-slate-950">{value}</span>
      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</span>
    </span>
  );
}

export function HistoryPageContent() {
  const { setSelectedVersion } = useDashboard();
  const { projectId: activeProjectId, projectName, version: selectedVersion, hasProject } = useProjectInfo();
  const trpc = useTRPC();

  const historyQuery = useQuery(
    trpc.history.list.queryOptions(
      { projectId: activeProjectId },
      { enabled: !!activeProjectId },
    ),
  );
  const versions: VersionHistory[] = (historyQuery.data?.versions ?? []) as VersionHistory[];

  if (!hasProject) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-8 text-center">
        <p className="text-slate-600">Select a project to view its version history.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        {/* Header */}
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Main Window
              </p>
              <h3 className="mt-1 text-xl font-semibold text-slate-950">
                Version History
              </h3>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-700">
                {projectName}
              </span>
              <span className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600">
                {versions.length} {versions.length === 1 ? "version" : "versions"}
              </span>
            </div>
          </div>
        </div>

        <div className="p-5">
          {historyQuery.isLoading ? (
            <div className="py-12 text-center text-sm font-medium text-slate-500">
              Loading history…
            </div>
          ) : versions.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
              <p className="text-sm font-medium text-slate-500">No version history found for this project.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {versions.map((v) => {
                const isActive = v.name === selectedVersion;
                return (
                  <div
                    key={v.name}
                    className={classNames(
                      "rounded-lg border p-4 transition",
                      isActive
                        ? "border-teal-300 bg-teal-50"
                        : "border-slate-200 bg-white hover:border-slate-300",
                    )}
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      {/* Left: version name + date */}
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={classNames(
                              "rounded-md px-2.5 py-1 text-sm font-bold",
                              isActive
                                ? "bg-teal-600 text-white"
                                : "bg-slate-100 text-slate-700",
                            )}
                          >
                            {v.name}
                          </span>
                          {isActive && (
                            <span className="rounded-md border border-teal-300 bg-white px-2 py-0.5 text-xs font-semibold text-teal-700">
                              Active
                            </span>
                          )}
                        </div>
                        <p className="mt-2 text-xs font-medium text-slate-400">
                          Created {formatDate(v.createdAt)}
                        </p>
                      </div>

                      {/* Center: stat badges */}
                      <div className="flex flex-wrap gap-2">
                        <StatBadge label="Tables" value={v.tables} />
                        <StatBadge label="Fields" value={v.fields} />
                        <StatBadge label="Relations" value={v.relations} />
                        <StatBadge label="Restrictions" value={v.restrictions} />
                      </div>

                      {/* Right: use button */}
                      <button
                        type="button"
                        disabled={isActive}
                        onClick={() => setSelectedVersion(v.name)}
                        className={classNames(
                          "h-9 shrink-0 rounded-md border px-4 text-sm font-semibold transition",
                          isActive
                            ? "cursor-default border-teal-200 bg-teal-50 text-teal-400"
                            : "border-slate-300 bg-white text-slate-700 hover:border-teal-300 hover:text-teal-700",
                        )}
                      >
                        {isActive ? "In use" : "Use"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
