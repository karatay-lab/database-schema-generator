"use client";

import { changeBadge } from "@/constants/tracking";
import type { TrackingChangeKind } from "@/lib/tracking-utils";

export function ChangeBadge({ kind }: { kind: TrackingChangeKind }) {
  const c = changeBadge[kind];
  return (
    <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-semibold ${c.cls}`}>
      {c.label}
    </span>
  );
}
