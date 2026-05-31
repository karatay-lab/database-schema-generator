"use client";

import { severityConfig } from "@/constants/tracking";
import { resolutionSeverity } from "@/lib/tracking-utils";
import type { SchemaWarning } from "@/lib/schema-warnings-store";

export function SeverityBadge({ w }: { w: SchemaWarning }) {
  const c = severityConfig[resolutionSeverity(w)];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded border px-1.5 py-0.5 text-[10px] font-semibold leading-none ${c.badge}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
}
