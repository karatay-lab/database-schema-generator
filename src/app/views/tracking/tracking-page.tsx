"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useTRPC } from "@/trpc/client";
import { useProjectInfo } from "../shared/project-info-context";
import type { TrackingEntry, TrackingEntryKind, TrackingChangeKind } from "@/lib/tracking-utils";

// ─── badge config ─────────────────────────────────────────────────────────────

const changeBadge: Record<TrackingChangeKind, { cls: string; label: string }> = {
  added:         { cls: "border-emerald-200 bg-emerald-50 text-emerald-700",  label: "Added"         },
  removed:       { cls: "border-red-200 bg-red-50 text-red-700",              label: "Removed"       },
  changed:       { cls: "border-amber-200 bg-amber-50 text-amber-700",        label: "Changed"       },
  renamed:       { cls: "border-sky-200 bg-sky-50 text-sky-700",              label: "Renamed"       },
  value_added:   { cls: "border-emerald-200 bg-emerald-50 text-emerald-700",  label: "Value added"   },
  value_removed: { cls: "border-red-200 bg-red-50 text-red-700",              label: "Value removed" },
};

const rowTint: Partial<Record<TrackingChangeKind, string>> = {
  added:         "bg-emerald-50/40",
  removed:       "bg-red-50/40",
  changed:       "bg-amber-50/40",
  renamed:       "bg-sky-50/40",
  value_added:   "bg-emerald-50/40",
  value_removed: "bg-red-50/40",
};

const kindLabel: Record<TrackingEntryKind, string> = {
  field_default: "Field default",
  enum:          "Enum",
  enum_value:    "Enum value",
};

function ChangeBadge({ kind }: { kind: TrackingChangeKind }) {
  const c = changeBadge[kind];
  return (
    <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-semibold ${c.cls}`}>
      {c.label}
    </span>
  );
}

function ValueDisplay({ text }: { text: string }) {
  if (text === "—") return <span className="text-slate-400">—</span>;
  return (
    <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-700">
      {text}
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

// ─── main ─────────────────────────────────────────────────────────────────────

export function TrackingPageContent() {
  const { projectId, projectName, hasProject } = useProjectInfo();
  const trpc = useTRPC();

  const [versionFilter, setVersionFilter] = useState("all");
  const [kindFilter, setKindFilter] = useState<TrackingEntryKind | "all">("all");
  const [changeFilter, setChangeFilter] = useState<TrackingChangeKind | "all">("all");
  const [entityFilter, setEntityFilter] = useState("all");

  const { data, isLoading } = useQuery(
    trpc.tracking.allChanges.queryOptions(
      { projectId },
      { enabled: !!projectId },
    ),
  );

  const allEntries: TrackingEntry[] = data?.entries ?? [];

  const versionPairs = useMemo(() => {
    const seen = new Set<string>();
    const pairs: { key: string; label: string }[] = [];
    for (const e of allEntries) {
      const key = `${e.fromVersion}__${e.toVersion}`;
      if (!seen.has(key)) { seen.add(key); pairs.push({ key, label: `${e.fromVersion} → ${e.toVersion}` }); }
    }
    return pairs;
  }, [allEntries]);

  const entityNames = useMemo(() => {
    const seen = new Set<string>();
    for (const e of allEntries) seen.add(e.entityName);
    return [...seen].sort();
  }, [allEntries]);

  const filtered = useMemo(() => allEntries.filter((e) => {
    if (versionFilter !== "all" && `${e.fromVersion}__${e.toVersion}` !== versionFilter) return false;
    if (kindFilter !== "all" && e.entityKind !== kindFilter) return false;
    if (changeFilter !== "all" && e.changeKind !== changeFilter) return false;
    if (entityFilter !== "all" && e.entityName !== entityFilter) return false;
    return true;
  }), [allEntries, versionFilter, kindFilter, changeFilter, entityFilter]);

  const counts = useMemo(() => {
    const c = { field_default: 0, enum: 0, enum_value: 0 };
    for (const e of allEntries) c[e.entityKind]++;
    return c;
  }, [allEntries]);

  const resetFilters = () => {
    setVersionFilter("all"); setKindFilter("all");
    setChangeFilter("all"); setEntityFilter("all");
  };
  const anyFilter = versionFilter !== "all" || kindFilter !== "all" || changeFilter !== "all" || entityFilter !== "all";

  if (!hasProject) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-8 text-center">
        <p className="text-slate-600">Select a project to view change tracking.</p>
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
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Tracking</p>
              <h3 className="mt-1 text-xl font-semibold text-slate-950">All Schema Changes</h3>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-700">
                {projectName}
              </span>
              {!isLoading && allEntries.length > 0 && (
                <>
                  {counts.field_default > 0 && (
                    <span className="rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">
                      {counts.field_default} field default{counts.field_default !== 1 ? "s" : ""}
                    </span>
                  )}
                  {counts.enum > 0 && (
                    <span className="rounded-md border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700">
                      {counts.enum} enum{counts.enum !== 1 ? "s" : ""}
                    </span>
                  )}
                  {counts.enum_value > 0 && (
                    <span className="rounded-md border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700">
                      {counts.enum_value} enum value{counts.enum_value !== 1 ? "s" : ""}
                    </span>
                  )}
                </>
              )}
              {!isLoading && allEntries.length === 0 && (
                <span className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-500">
                  no changes
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── Filters ── */}
        {!isLoading && allEntries.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-5 py-3">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Filter</span>

            <select value={versionFilter} onChange={(e) => setVersionFilter(e.target.value)}
              className="rounded border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-400">
              <option value="all">All versions</option>
              {versionPairs.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
            </select>

            <select value={kindFilter} onChange={(e) => setKindFilter(e.target.value as TrackingEntryKind | "all")}
              className="rounded border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-400">
              <option value="all">All kinds</option>
              <option value="field_default">Field defaults</option>
              <option value="enum">Enums</option>
              <option value="enum_value">Enum values</option>
            </select>

            <select value={changeFilter} onChange={(e) => setChangeFilter(e.target.value as TrackingChangeKind | "all")}
              className="rounded border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-400">
              <option value="all">All changes</option>
              <option value="added">Added</option>
              <option value="removed">Removed</option>
              <option value="changed">Changed</option>
              <option value="renamed">Renamed</option>
              <option value="value_added">Value added</option>
              <option value="value_removed">Value removed</option>
            </select>

            {entityNames.length > 1 && (
              <select value={entityFilter} onChange={(e) => setEntityFilter(e.target.value)}
                className="rounded border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-400">
                <option value="all">All entities</option>
                {entityNames.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            )}

            {anyFilter && (
              <button type="button" onClick={resetFilters}
                className="text-xs font-medium text-slate-400 underline underline-offset-2 hover:text-slate-700">
                Reset
              </button>
            )}

            <span className="ml-auto text-xs font-medium text-slate-400">
              {filtered.length} of {allEntries.length}
            </span>
          </div>
        )}

        {/* ── Table ── */}
        <div className="p-5">
          {isLoading ? (
            <div className="py-12 text-center text-sm font-medium text-slate-500">Loading…</div>
          ) : allEntries.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
              <p className="text-sm font-semibold text-slate-600">No schema changes detected between versions.</p>
              <p className="mt-1 text-xs text-slate-400">
                Add a second project version and modify field defaults or enums to see entries here.
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
              <p className="text-sm font-medium text-slate-500">No entries match the current filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    {(["Transition", "Entity", "Kind", "Change", "From", "To", "View"] as const).map((h) => (
                      <th key={h} className="pb-2 pr-4 text-left text-xs font-semibold uppercase tracking-[0.14em] text-slate-400 last:pr-0">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((entry, idx) => {
                    const isField = entry.entityKind === "field_default";
                    const linkHref = isField
                      ? `/schema?table=${entry.entityName}`
                      : `/enums`;
                    return (
                      <tr key={idx} className={`${rowTint[entry.changeKind] ?? ""} transition-colors`}>
                        {/* Transition */}
                        <td className="py-2.5 pr-4 align-middle">
                          <div className="flex items-center gap-1.5 whitespace-nowrap">
                            <VersionPill name={entry.fromVersion} />
                            <span className="text-slate-400">→</span>
                            <VersionPill name={entry.toVersion} />
                          </div>
                        </td>

                        {/* Entity */}
                        <td className="py-2.5 pr-4 align-middle">
                          <span className="font-semibold text-slate-800">{entry.entityName}</span>
                          {entry.subName && (
                            <>
                              <span className="mx-1 text-slate-300">·</span>
                              <span className="text-slate-600">{entry.subName}</span>
                            </>
                          )}
                        </td>

                        {/* Kind chip */}
                        <td className="py-2.5 pr-4 align-middle">
                          <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-semibold ${
                            entry.entityKind === "field_default"
                              ? "border-amber-100 bg-amber-50 text-amber-600"
                              : entry.entityKind === "enum"
                              ? "border-indigo-100 bg-indigo-50 text-indigo-600"
                              : "border-violet-100 bg-violet-50 text-violet-600"
                          }`}>
                            {kindLabel[entry.entityKind]}
                          </span>
                        </td>

                        {/* Change badge */}
                        <td className="py-2.5 pr-4 align-middle">
                          <ChangeBadge kind={entry.changeKind} />
                        </td>

                        {/* From */}
                        <td className="py-2.5 pr-4 align-middle">
                          <ValueDisplay text={entry.fromDisplay} />
                        </td>

                        {/* To */}
                        <td className="py-2.5 pr-4 align-middle">
                          <ValueDisplay text={entry.toDisplay} />
                        </td>

                        {/* Link */}
                        <td className="py-2.5 align-middle">
                          <Link
                            href={linkHref}
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

      {/* ── Legend ── */}
      {!isLoading && (
        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Legend</p>
            <h3 className="mt-1 text-lg font-semibold text-slate-950">What gets tracked</h3>
          </div>
          <div className="grid grid-cols-1 divide-y divide-slate-100 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            <div className="px-5 py-4">
              <p className="font-semibold text-amber-700">Field defaults</p>
              <p className="mt-1 text-xs text-slate-500">
                Tracks when a field's <code className="font-mono">@default</code> is added, changed, or removed between versions. Existing rows may need backfilling when a default is added.
              </p>
            </div>
            <div className="px-5 py-4">
              <p className="font-semibold text-indigo-700">Enums</p>
              <p className="mt-1 text-xs text-slate-500">
                Tracks whole-enum additions, removals, and renames. Removing an enum that's in use is a breaking change requiring data migration.
              </p>
            </div>
            <div className="px-5 py-4">
              <p className="font-semibold text-violet-700">Enum values</p>
              <p className="mt-1 text-xs text-slate-500">
                Tracks individual value additions and removals within an enum. Removed values require existing rows to be remapped before migration.
              </p>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
