"use client";

import { fieldLegendItems } from "@/constants/schema";

export function FieldLegend() {
  return (
    <div className="mb-4 grid grid-cols-2 gap-x-6 gap-y-2 rounded-lg border border-cyan-100 bg-cyan-50/60 px-4 py-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {fieldLegendItems.map(({ label, desc }) => (
        <div key={label}>
          <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-cyan-700">{label}</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-slate-600">{desc}</p>
        </div>
      ))}
    </div>
  );
}
