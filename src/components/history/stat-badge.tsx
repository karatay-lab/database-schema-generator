"use client";

export function StatBadge({ label, value }: { label: string; value: number }) {
  return (
    <span className="inline-flex flex-col items-center rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-center">
      <span className="text-base font-bold text-slate-950">{value}</span>
      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</span>
    </span>
  );
}
