"use client";

import { cn } from "@/lib/utils";
import type { VersionStats } from "@/types/imports";

function StatPill({ value, label }: { value: number; label: string }) {
  return (
    <span className="flex items-center gap-1 text-xs font-medium text-slate-600">
      <span className="font-semibold text-slate-900">{value}</span>
      {label}
    </span>
  );
}

export function ProviderBadge({ provider }: { provider: string }) {
  const label = provider === "mysql" ? "MySQL" : provider === "sqlite" ? "SQLite" : "PostgreSQL";
  const cls =
    provider === "mysql"
      ? "bg-orange-50 text-orange-700"
      : provider === "sqlite"
        ? "bg-sky-50 text-sky-700"
        : "bg-blue-50 text-blue-700";
  return (
    <span className={cn("rounded px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide", cls)}>
      {label}
    </span>
  );
}

export function VersionPreviewCard({ stats }: { stats: VersionStats }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="text-xs font-bold text-slate-800">{stats.name}</span>
        <StatPill value={stats.tableCount} label="tables" />
        <StatPill value={stats.fieldCount} label="fields" />
        <StatPill value={stats.relationCount} label="relations" />
        <StatPill value={stats.enumCount} label="enums" />
      </div>
    </div>
  );
}
