"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useTRPC } from "@/trpc/client";
import type { TrackingEntry, TrackingEntryKind, TrackingChangeKind } from "@/lib/tracking-utils";
import { rowTint, kindLabel } from "@/constants/tracking";
import { ChangeBadge } from "./change-badge";
import { ValueDisplay } from "./value-display";

export function AllChangesTab({
  projectId,
  fromVersion,
  toVersion,
}: {
  projectId: string;
  fromVersion: string;
  toVersion: string;
}) {
  const trpc = useTRPC();
  const [kindFilter, setKindFilter]     = useState<TrackingEntryKind | "all">("all");
  const [changeFilter, setChangeFilter] = useState<TrackingChangeKind | "all">("all");
  const [entityFilter, setEntityFilter] = useState("all");

  const { data, isLoading } = useQuery(
    trpc.tracking.allChanges.queryOptions({ projectId }, { enabled: !!projectId }),
  );

  const allEntries: TrackingEntry[] = useMemo(() => {
    if (!data?.entries) return [];
    return data.entries.filter(
      (e) => e.fromVersion === fromVersion && e.toVersion === toVersion,
    );
  }, [data?.entries, fromVersion, toVersion]);

  const entityNames = useMemo(() => {
    const seen = new Set<string>();
    for (const e of allEntries) seen.add(e.entityName);
    return [...seen].sort();
  }, [allEntries]);

  const filtered = useMemo(() => allEntries.filter((e) => {
    if (kindFilter   !== "all" && e.entityKind  !== kindFilter)   return false;
    if (changeFilter !== "all" && e.changeKind  !== changeFilter) return false;
    if (entityFilter !== "all" && e.entityName  !== entityFilter) return false;
    return true;
  }), [allEntries, kindFilter, changeFilter, entityFilter]);

  const counts = useMemo(() => {
    const c = { field_default: 0, enum: 0, enum_value: 0 };
    for (const e of allEntries) c[e.entityKind]++;
    return c;
  }, [allEntries]);

  const anyFilter = kindFilter !== "all" || changeFilter !== "all" || entityFilter !== "all";
  const reset = () => { setKindFilter("all"); setChangeFilter("all"); setEntityFilter("all"); };

  if (isLoading) {
    return <div className="py-12 text-center text-sm font-medium text-slate-500">Loading…</div>;
  }

  if (allEntries.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
        <p className="text-sm font-semibold text-slate-600">No schema changes detected for this version.</p>
        <p className="mt-1 text-xs text-slate-400">
          Modify field defaults or enums between {fromVersion} and {toVersion} to see entries here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary chips */}
      <div className="flex flex-wrap items-center gap-2">
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
      </div>

      {/* Filters */}
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
        <div className="flex items-center gap-3">
          <span className="w-14 shrink-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Kind</span>
          <div className="flex flex-1 divide-x divide-slate-200 overflow-hidden rounded-md border border-slate-200">
            {([ ["all", "All"], ["field_default", "Field defaults"], ["enum", "Enums"], ["enum_value", "Enum values"] ] as [TrackingEntryKind | "all", string][]).map(([v, label]) => (
              <button key={v} type="button" onClick={() => setKindFilter(v)}
                className={`flex-1 py-1.5 text-xs font-medium transition ${kindFilter === v ? "bg-slate-800 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="w-14 shrink-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Change</span>
          <div className="flex flex-1 divide-x divide-slate-200 overflow-hidden rounded-md border border-slate-200">
            {([ ["all","All"], ["added","Added"], ["removed","Removed"], ["changed","Changed"], ["renamed","Renamed"], ["value_added","Val. added"], ["value_removed","Val. removed"] ] as [TrackingChangeKind | "all", string][]).map(([v, label]) => (
              <button key={v} type="button" onClick={() => setChangeFilter(v)}
                className={`flex-1 py-1.5 text-xs font-medium transition ${changeFilter === v ? "bg-slate-800 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {entityNames.length > 1 && (
          <div className="flex items-center gap-3">
            <span className="w-14 shrink-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Entity</span>
            <div className="flex flex-1 divide-x divide-slate-200 overflow-hidden rounded-md border border-slate-200">
              {(["all", ...entityNames] as string[]).map((v) => (
                <button key={v} type="button" onClick={() => setEntityFilter(v)}
                  className={`flex-1 py-1.5 text-xs font-medium transition truncate ${entityFilter === v ? "bg-slate-800 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}>
                  {v === "all" ? "All" : v}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-0.5">
          {anyFilter
            ? <button type="button" onClick={reset} className="text-[10px] font-medium text-slate-400 underline underline-offset-2 hover:text-slate-700">Reset filters</button>
            : <span />}
          <span className="text-[10px] font-semibold text-slate-400">{filtered.length} of {allEntries.length} entries</span>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
          <p className="text-sm font-medium text-slate-500">No entries match the current filters.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                {(["Entity", "Kind", "Change", "From", "To", "View"] as const).map((h) => (
                  <th key={h} className="pb-2 pr-4 text-left text-xs font-semibold uppercase tracking-[0.14em] text-slate-400 last:pr-0">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((entry, idx) => {
                const isField = entry.entityKind === "field_default";
                return (
                  <tr key={idx} className={`${rowTint[entry.changeKind] ?? ""} transition-colors`}>
                    <td className="py-2.5 pr-4 align-middle">
                      <span className="font-semibold text-slate-800">{entry.entityName}</span>
                      {entry.subName && (
                        <><span className="mx-1 text-slate-300">·</span><span className="text-slate-600">{entry.subName}</span></>
                      )}
                    </td>
                    <td className="py-2.5 pr-4 align-middle">
                      <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-semibold ${
                        entry.entityKind === "field_default" ? "border-amber-100 bg-amber-50 text-amber-600"
                        : entry.entityKind === "enum"        ? "border-indigo-100 bg-indigo-50 text-indigo-600"
                        :                                      "border-violet-100 bg-violet-50 text-violet-600"
                      }`}>
                        {kindLabel[entry.entityKind]}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 align-middle"><ChangeBadge kind={entry.changeKind} /></td>
                    <td className="py-2.5 pr-4 align-middle"><ValueDisplay text={entry.fromDisplay} /></td>
                    <td className="py-2.5 pr-4 align-middle"><ValueDisplay text={entry.toDisplay} /></td>
                    <td className="py-2.5 align-middle">
                      <Link
                        href={isField ? `/schema?table=${entry.entityName}` : "/enums"}
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
  );
}
