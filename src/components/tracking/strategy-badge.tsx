"use client";

import { strategyStyle } from "@/constants/tracking";
import { resolveStrategy } from "@/lib/tracking-utils";
import type { SchemaWarning } from "@/lib/schema-warnings-store";

export function StrategyBadge({ w }: { w: SchemaWarning }) {
  if (!w.approvedAt) return null;
  const name = resolveStrategy(w);
  const { cls } = strategyStyle[name];
  return (
    <span className={`inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-semibold ${cls}`}>
      {name}
    </span>
  );
}
