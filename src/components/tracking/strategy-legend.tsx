"use client";

import { STRATEGIES_BY_KIND, strategyStyle, type StrategyName } from "@/constants/tracking";

const allStrategies: { name: StrategyName; desc: string }[] = [
  { name: "Unique Prefix + UUID", desc: "Your prefix + a random UUID per row — each row gets a distinct value. Used for unique String fields." },
  { name: "Static Default",       desc: "The same value is written to all existing rows." },
  { name: "Type Cast",            desc: "Existing string values cast to the new type (e.g. String → Enum). Only valid members survive." },
  { name: "Remapped",             desc: "Removed enum values redirected to a chosen replacement before migration." },
  { name: "Set NULL",             desc: "Field set to NULL for all existing rows. Only valid for nullable target fields." },
  { name: "Data Dropped",         desc: "Column or table removed entirely. All existing data permanently deleted." },
  { name: "Acknowledged",         desc: "Change approved — no data transformation needed. Values carry over as-is." },
];

export function StrategyLegend({
  entityKind, title, description, color, pendingCount, incompleteCount,
}: {
  entityKind: string;
  title?: string;
  description?: string;
  color?: string;
  pendingCount?: number;
  incompleteCount?: number;
}) {
  const names = STRATEGIES_BY_KIND[entityKind] ?? (Object.keys(strategyStyle) as StrategyName[]);
  const visible = allStrategies.filter((s) => names.includes(s.name));

  return (
    <div className={`rounded-lg border p-4 ${
      (pendingCount ?? 0) > 0 ? "border-red-200 bg-red-50/50"
      : (incompleteCount ?? 0) > 0 ? "border-amber-200 bg-amber-50/50"
      : "border-slate-200 bg-slate-50"
    }`}>
      {title && (
        <div className="mb-3 flex items-start justify-between gap-4">
          <div className="flex items-start gap-2.5">
            {color && <span className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ${color}`} />}
            <div>
              <p className="font-semibold text-slate-950">{title}</p>
              {description && <p className="mt-0.5 text-xs text-slate-500 leading-relaxed">{description}</p>}
            </div>
          </div>
          {((pendingCount ?? 0) > 0 || (incompleteCount ?? 0) > 0) && (
            <span className={`shrink-0 rounded-md border px-2.5 py-1 text-xs font-semibold ${
              (pendingCount ?? 0) > 0 ? "border-red-200 bg-white text-red-700" : "border-amber-200 bg-white text-amber-700"
            }`}>
              {(pendingCount ?? 0) > 0
                ? `${pendingCount} need${pendingCount === 1 ? "s" : ""} approval`
                : `${incompleteCount} need${incompleteCount === 1 ? "s" : ""} default value`}
            </span>
          )}
        </div>
      )}
      <p className={`${title ? "mt-3 pt-3 border-t border-slate-200/70" : ""} mb-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400`}>
        Resolution Strategies
      </p>
      <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-4">
        {visible.map(({ name, desc }) => (
          <div key={name} className="flex flex-col gap-1">
            <span className={`inline-flex w-fit items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold ${strategyStyle[name].cls}`}>
              {name}
            </span>
            <p className="text-[10px] text-slate-500 leading-relaxed">{desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
