"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useTRPC } from "@/trpc/client";
import { useProjectInfo } from "../shared/project-info-context";
import { formatDefault } from "@/lib/tracking-utils";
import type { DefaultChange, DefaultChangeKind } from "@/lib/tracking-utils";

// ─── helpers ─────────────────────────────────────────────────────────────────

const changeStyles: Record<DefaultChangeKind, { badge: string; row: string; label: string }> = {
  added:   { badge: "border-emerald-200 bg-emerald-50 text-emerald-700",  row: "bg-emerald-50/40",  label: "Added"   },
  removed: { badge: "border-red-200 bg-red-50 text-red-700",              row: "bg-red-50/40",      label: "Removed" },
  changed: { badge: "border-amber-200 bg-amber-50 text-amber-700",        row: "bg-amber-50/40",    label: "Changed" },
};

function ChangeBadge({ kind }: { kind: DefaultChangeKind }) {
  const s = changeStyles[kind];
  return (
    <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-semibold ${s.badge}`}>
      {s.label}
    </span>
  );
}

function DefaultDisplay({ kind, value }: { kind: string; value: string }) {
  const display = formatDefault(kind, value);
  if (display === "—") return <span className="text-slate-400">—</span>;
  return (
    <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-mono text-slate-700">
      {display}
    </code>
  );
}

function VersionPill({ name }: { name: string }) {
  return (
    <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
      {name}
    </span>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

export function TrackingPageContent() {
  const { projectId, projectName, hasProject } = useProjectInfo();
  const trpc = useTRPC();
  const [versionFilter, setVersionFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<DefaultChangeKind | "all">("all");
  const [tableFilter, setTableFilter] = useState<string>("all");

  const { data, isLoading } = useQuery(
    trpc.tracking.defaultChanges.queryOptions(
      { projectId },
      { enabled: !!projectId },
    ),
  );

  const allChanges: DefaultChange[] = data?.changes ?? [];

  const versionPairs = useMemo(() => {
    const seen = new Set<string>();
    const pairs: { key: string; label: string }[] = [];
    for (const c of allChanges) {
      const key = `${c.fromVersion}__${c.toVersion}`;
      if (!seen.has(key)) {
        seen.add(key);
        pairs.push({ key, label: `${c.fromVersion} → ${c.toVersion}` });
      }
    }
    return pairs;
  }, [allChanges]);

  const tableNames = useMemo(() => {
    const seen = new Set<string>();
    for (const c of allChanges) seen.add(c.tableName);
    return [...seen].sort();
  }, [allChanges]);

  const filtered = useMemo(() => {
    return allChanges.filter((c) => {
      if (versionFilter !== "all" && `${c.fromVersion}__${c.toVersion}` !== versionFilter) return false;
      if (typeFilter !== "all" && c.changeType !== typeFilter) return false;
      if (tableFilter !== "all" && c.tableName !== tableFilter) return false;
      return true;
    });
  }, [allChanges, versionFilter, typeFilter, tableFilter]);

  const counts = useMemo(() => ({
    added:   allChanges.filter((c) => c.changeType === "added").length,
    removed: allChanges.filter((c) => c.changeType === "removed").length,
    changed: allChanges.filter((c) => c.changeType === "changed").length,
  }), [allChanges]);

  if (!hasProject) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-8 text-center">
        <p className="text-slate-600">Select a project to view default value tracking.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        {/* ── Header ── */}
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Tracking
              </p>
              <h3 className="mt-1 text-xl font-semibold text-slate-950">
                Default Value Changes
              </h3>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-700">
                {projectName}
              </span>
              {!isLoading && (
                <>
                  {counts.added > 0 && (
                    <span className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                      {counts.added} added
                    </span>
                  )}
                  {counts.changed > 0 && (
                    <span className="rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">
                      {counts.changed} changed
                    </span>
                  )}
                  {counts.removed > 0 && (
                    <span className="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700">
                      {counts.removed} removed
                    </span>
                  )}
                  {allChanges.length === 0 && (
                    <span className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-500">
                      no changes
                    </span>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* ── Filters ── */}
        {!isLoading && allChanges.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-5 py-3">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
              Filter
            </span>

            {/* Version pair */}
            <select
              value={versionFilter}
              onChange={(e) => setVersionFilter(e.target.value)}
              className="rounded border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-400"
            >
              <option value="all">All versions</option>
              {versionPairs.map((p) => (
                <option key={p.key} value={p.key}>{p.label}</option>
              ))}
            </select>

            {/* Change type */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as DefaultChangeKind | "all")}
              className="rounded border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-400"
            >
              <option value="all">All types</option>
              <option value="added">Added</option>
              <option value="changed">Changed</option>
              <option value="removed">Removed</option>
            </select>

            {/* Table */}
            {tableNames.length > 1 && (
              <select
                value={tableFilter}
                onChange={(e) => setTableFilter(e.target.value)}
                className="rounded border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-400"
              >
                <option value="all">All tables</option>
                {tableNames.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            )}

            {(versionFilter !== "all" || typeFilter !== "all" || tableFilter !== "all") && (
              <button
                type="button"
                onClick={() => { setVersionFilter("all"); setTypeFilter("all"); setTableFilter("all"); }}
                className="text-xs font-medium text-slate-400 underline underline-offset-2 hover:text-slate-700"
              >
                Reset
              </button>
            )}

            <span className="ml-auto text-xs font-medium text-slate-400">
              {filtered.length} of {allChanges.length}
            </span>
          </div>
        )}

        {/* ── Body ── */}
        <div className="p-5">
          {isLoading ? (
            <div className="py-12 text-center text-sm font-medium text-slate-500">
              Loading tracking data…
            </div>
          ) : allChanges.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
              <p className="text-sm font-semibold text-slate-600">No default value changes detected.</p>
              <p className="mt-1 text-xs text-slate-400">
                Default value tracking compares consecutive schema versions. Add a second version and change a field default to see entries here.
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
              <p className="text-sm font-medium text-slate-500">No changes match the current filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="pb-2 pr-4 text-left text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                      Transition
                    </th>
                    <th className="pb-2 pr-4 text-left text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                      Table · Field
                    </th>
                    <th className="pb-2 pr-4 text-left text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                      Type
                    </th>
                    <th className="pb-2 pr-4 text-left text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                      Old default
                    </th>
                    <th className="pb-2 pr-4 text-left text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                      New default
                    </th>
                    <th className="pb-2 text-left text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                      Schema
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((change, idx) => {
                    const s = changeStyles[change.changeType];
                    return (
                      <tr key={idx} className={`${s.row} transition-colors`}>
                        {/* Transition */}
                        <td className="py-2.5 pr-4 align-middle">
                          <div className="flex items-center gap-1.5 whitespace-nowrap">
                            <VersionPill name={change.fromVersion} />
                            <span className="text-slate-400">→</span>
                            <VersionPill name={change.toVersion} />
                          </div>
                        </td>

                        {/* Table · Field */}
                        <td className="py-2.5 pr-4 align-middle">
                          <span className="font-semibold text-slate-800">{change.tableName}</span>
                          <span className="mx-1 text-slate-300">·</span>
                          <span className="text-slate-600">{change.fieldName}</span>
                        </td>

                        {/* Badge */}
                        <td className="py-2.5 pr-4 align-middle">
                          <ChangeBadge kind={change.changeType} />
                        </td>

                        {/* Old default */}
                        <td className="py-2.5 pr-4 align-middle">
                          <DefaultDisplay kind={change.fromKind} value={change.fromValue} />
                        </td>

                        {/* New default */}
                        <td className="py-2.5 pr-4 align-middle">
                          <DefaultDisplay kind={change.toKind} value={change.toValue} />
                        </td>

                        {/* Schema link */}
                        <td className="py-2.5 align-middle">
                          <Link
                            href={`/schema?table=${change.tableName}`}
                            className="rounded border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-600 transition hover:border-teal-300 hover:text-teal-700"
                          >
                            View →
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* ── What gets tracked ── */}
      {!isLoading && (
        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              About
            </p>
            <h3 className="mt-1 text-lg font-semibold text-slate-950">What gets tracked</h3>
          </div>
          <div className="grid grid-cols-1 gap-0 divide-y divide-slate-100 sm:grid-cols-3 sm:divide-x sm:divide-y-0 p-0">
            <div className="px-5 py-4">
              <p className="font-semibold text-emerald-700">Added</p>
              <p className="mt-1 text-xs text-slate-500">
                A field had no default in the previous version but has one now. Existing rows may need backfilling.
              </p>
            </div>
            <div className="px-5 py-4">
              <p className="font-semibold text-amber-700">Changed</p>
              <p className="mt-1 text-xs text-slate-500">
                The default value or kind changed between versions. New rows will use the updated default.
              </p>
            </div>
            <div className="px-5 py-4">
              <p className="font-semibold text-red-700">Removed</p>
              <p className="mt-1 text-xs text-slate-500">
                A field had a default in the previous version but no longer does. Future inserts must supply the value explicitly.
              </p>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
