"use client";

import { cn } from "@/lib/utils";
import type { PhaseState } from "@/types/migrations";

const stateMap: Record<PhaseState, { label: string; cls: string }> = {
  idle:    { label: "Pending",   cls: "bg-slate-100 text-slate-500"    },
  loading: { label: "Running…",  cls: "bg-amber-100 text-amber-700"    },
  success: { label: "Done",      cls: "bg-emerald-100 text-emerald-700" },
  error:   { label: "Failed",    cls: "bg-rose-100 text-rose-700"      },
};

export function StateChip({ state }: { state: PhaseState }) {
  const { label, cls } = stateMap[state];
  return (
    <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", cls)}>
      {label}
    </span>
  );
}

export function StepBadge({ n, state }: { n: number; state: PhaseState }) {
  const base = "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold";
  if (state === "success") return <span className={cn(base, "bg-emerald-500 text-white")}>✓</span>;
  if (state === "error")   return <span className={cn(base, "bg-rose-500 text-white")}>✗</span>;
  if (state === "loading") return <span className={cn(base, "bg-amber-400 text-white")}>{n}</span>;
  return <span className={cn(base, "bg-slate-200 text-slate-600")}>{n}</span>;
}
