"use client";

/** Generic numeric stat with a label. Used in cards and project overviews. */
export function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline gap-1">
      <span className="text-sm font-bold text-slate-800">{value}</span>
      <span className="text-xs text-slate-400">{label}</span>
    </div>
  );
}
