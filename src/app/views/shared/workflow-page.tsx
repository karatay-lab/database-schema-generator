"use client";

import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { useDashboard, useActiveProject } from "./dashboard-context";
import {
  fieldRows,
  tableSummaries,
  workflowSummaries,
} from "./dashboard-data";
import { classNames } from "@/lib/utils";
import { useRouter } from "next/navigation";

type WorkflowPageProps = {
  label: string;
};

export function WorkflowPage({ label }: WorkflowPageProps) {
  const trpc = useTRPC();
  const { data: projects = [] } = useQuery(trpc.projects.list.queryOptions());
  const activeProject = useActiveProject();
  const { activeProjectId, setActiveProjectId } = useDashboard();
  const router = useRouter();
  const isHistory = label === "History";
  const activeHealth = activeProject?.health ?? "No project";
  const activeTables = activeProject?.tables ?? 0;
  const activeFields = activeProject?.fields ?? 0;
  const activeRelations = activeProject?.relations ?? 0;

  const handleProjectChange = (projectId: string) => {
    setActiveProjectId(projectId);
    router.push("/tables");
  };

  return (
    <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_340px]">
      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Main Window
              </p>
              <h3 className="mt-1 text-xl font-semibold text-slate-950">
                {label} workspace
              </h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {["Draft", "Validated", activeHealth].map((state, index) => (
                <span
                  key={`${state}-${index}`}
                  className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600"
                >
                  {state}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-0 lg:grid-cols-[minmax(0,0.9fr)_minmax(360px,1.1fr)]">
          <div className="border-b border-slate-200 p-5 lg:border-b-0 lg:border-r">
            {isHistory ? (
              <div className="mb-5 rounded-lg border border-slate-200 bg-[#f9faf5] p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                      Project History
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      Select the project whose last committed schema and version
                      should be active.
                    </p>
                  </div>
                  <select
                    value={activeProjectId}
                    onChange={(event) => handleProjectChange(event.target.value)}
                    disabled={projects.length === 0}
                    className="h-10 min-w-48 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-emerald-600"
                  >
                    {projects.length === 0 ? (
                      <option value="">No projects</option>
                    ) : null}
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name.trim() || "Untitled"}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ) : (
              <div className="mb-5 rounded-lg border border-slate-200 bg-[#f9faf5] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Workflow Focus
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {workflowSummaries[label]}
                </p>
              </div>
            )}

            <div className="grid grid-cols-3 gap-3">
              {[
                ["Tables", activeTables],
                ["Fields", activeFields],
                ["Relations", activeRelations],
              ].map(([statLabel, value]) => (
                <div
                  key={statLabel}
                  className="rounded-lg border border-slate-200 bg-slate-50 p-4"
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    {statLabel}
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-slate-950">
                    {value}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-lg border border-slate-200">
              <div className="border-b border-slate-200 bg-[#f9faf5] px-4 py-3">
                <p className="text-sm font-semibold text-slate-900">
                  Active model
                </p>
              </div>
              <div className="divide-y divide-slate-100">
                {fieldRows.map(([name, type, role, attribute]) => (
                  <div
                    key={name}
                    className="grid grid-cols-[120px_90px_minmax(0,1fr)] gap-3 px-4 py-3 text-sm"
                  >
                    <span className="font-semibold text-slate-950">{name}</span>
                    <span className="text-slate-600">{type}</span>
                    <span className="min-w-0 truncate text-slate-500">
                      {role} / {attribute}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="p-5">
            <div className="rounded-lg border border-slate-200 bg-[#fbfcff] p-4">
              <div className="mb-4 flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-900">
                  Relation map
                </p>
                <span className="rounded-md bg-cyan-100 px-2.5 py-1 text-xs font-bold text-cyan-800">
                  Live draft
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {["Account", "Customer", "Invoice", "Payment"].map(
                  (model, index) => (
                    <button
                      key={model}
                      type="button"
                      className={classNames(
                        "min-h-28 rounded-lg border bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md",
                        index === 0
                          ? "border-emerald-300"
                          : index === 1
                            ? "border-cyan-300"
                            : index === 2
                              ? "border-amber-300"
                              : "border-violet-300",
                      )}
                    >
                      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                        Model
                      </span>
                      <span className="mt-2 block text-lg font-semibold text-slate-950">
                        {model}
                      </span>
                      <span className="mt-3 block text-sm text-slate-500">
                        {index + 3} relations / {index + 8} fields
                      </span>
                    </button>
                  ),
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <aside className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
          Review Queue
        </p>
        <div className="mt-4 space-y-4">
          {[
            ["Unique emails", "Customer.email", "Ready"],
            ["Cascade policy", "Invoice.items", "Needs choice"],
            ["Provider check", "SQLite defaults", "Clean"],
          ].map(([title, detail, state]) => (
            <div
              key={title}
              className="rounded-lg border border-slate-200 bg-slate-50 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-950">{title}</p>
                  <p className="mt-1 text-sm text-slate-500">{detail}</p>
                </div>
                <span className="rounded-md bg-white px-2 py-1 text-xs font-bold text-slate-600">
                  {state}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 rounded-lg border border-slate-200 bg-[#fcfbf7] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            Selected Table
          </p>
          <p className="mt-2 text-sm text-slate-600">
            {tableSummaries[0].name} is ready for {label.toLowerCase()} review.
          </p>
        </div>
      </aside>
    </div>
  );
}
