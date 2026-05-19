"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { classNames } from "../shared/dashboard-data";
import { useProjectInfo } from "../shared/project-info-context";

type HierarchyResponse = {
  order: {
    tableId: string;
    modelName: string;
    dbName: string;
    parentCount: number;
  }[];
  edges: {
    relationId: string;
    name: string;
    sourceModel: string;
    targetModel: string;
    cardinality: string;
    fieldPairs: { sourceField: string; targetField: string }[];
  }[];
  tableCount: number;
  relationCount: number;
};

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-8 text-center">
      <p className="text-sm text-slate-600">{message}</p>
    </div>
  );
}

export function HierarchyPageContent() {
  const { projectName, version, hasProject } = useProjectInfo();
  const trpc = useTRPC();

  const hierarchyQuery = useQuery(
    trpc.hierarchy.get.queryOptions(
      { projectName, version },
      { enabled: !!projectName && !!version },
    ),
  );

  const data = hierarchyQuery.data as HierarchyResponse | undefined;
  const maxParentCount = useMemo(
    () => Math.max(...(data?.order.map((item) => item.parentCount) ?? [0]), 1),
    [data?.order],
  );

  if (!hasProject) {
    return <EmptyState message="Select a project to review hierarchy." />;
  }

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Hierarchy
              </p>
              <h3 className="mt-1 text-xl font-semibold text-slate-950">
                Dependency Order
              </h3>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600">
                {projectName}
              </span>
              <span className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600">
                {version}
              </span>
              {data && (
                <span className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                  {data.tableCount} tables / {data.relationCount} relations
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="border-b border-slate-200 p-5 xl:border-b-0 xl:border-r">
            {hierarchyQuery.isLoading && (
              <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                Loading hierarchy...
              </div>
            )}

            {hierarchyQuery.error && (
              <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3">
                <p className="text-sm font-semibold text-rose-700">
                  {hierarchyQuery.error.message}
                </p>
              </div>
            )}

            {data && data.order.length === 0 && (
              <EmptyState message="No tables found for this version." />
            )}

            {data && data.order.length > 0 && (
              <div className="space-y-3">
                <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                    Migration execution order
                  </p>
                  <p className="mt-2 font-mono text-sm text-slate-800">
                    {data.order.map((item) => item.modelName).join(" -> ")}
                  </p>
                </div>

                <div className="overflow-hidden rounded-md border border-slate-200">
                  <div className="grid grid-cols-[3rem_minmax(0,1fr)_minmax(90px,32%)_6rem] items-center gap-4 border-b border-slate-200 bg-slate-50 px-4 py-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                    <span>#</span>
                    <span>Table</span>
                    <span>Parent Count</span>
                    <span className="text-right">Deps</span>
                  </div>
                  {data.order.map((item, index) => (
                    <div
                      key={item.tableId}
                      className="grid grid-cols-[3rem_minmax(0,1fr)_minmax(90px,32%)_6rem] items-center gap-4 border-b border-slate-100 px-4 py-3 last:border-0 hover:bg-slate-50"
                    >
                      <span className="font-mono text-xs font-semibold text-slate-400">
                        {index + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-950">{item.modelName}</p>
                        <p className="truncate font-mono text-[11px] text-slate-400">{item.dbName}</p>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-emerald-500"
                          style={{ width: `${Math.max((item.parentCount / maxParentCount) * 100, item.parentCount > 0 ? 8 : 0)}%` }}
                        />
                      </div>
                      <span className="text-right font-mono text-xs font-semibold text-slate-600">
                        {item.parentCount}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <aside className="p-5">
            <div className="rounded-md border border-slate-200 bg-white">
              <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-sm font-semibold text-slate-950">Relation Edges</p>
              </div>
              <div className="max-h-[560px] overflow-y-auto divide-y divide-slate-100">
                {data && data.edges.length === 0 && (
                  <p className="px-4 py-5 text-sm text-slate-500">
                    No relations found. Migration order follows table order.
                  </p>
                )}
                {data?.edges.map((edge) => (
                  <div key={edge.relationId} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-950">
                          {edge.sourceModel} -&gt; {edge.targetModel}
                        </p>
                        <p className="mt-1 truncate font-mono text-[11px] text-slate-400">
                          {edge.name || "unnamed relation"}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-semibold text-slate-600">
                        {edge.cardinality}
                      </span>
                    </div>
                    {edge.fieldPairs.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {edge.fieldPairs.map((pair, index) => (
                          <span
                            key={`${pair.sourceField}-${pair.targetField}-${index}`}
                            className={classNames(
                              "rounded bg-slate-100 px-2 py-1 font-mono text-[11px]",
                              pair.sourceField && pair.targetField ? "text-slate-600" : "text-slate-400",
                            )}
                          >
                            {pair.sourceField || "?"} -&gt; {pair.targetField || "?"}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}
