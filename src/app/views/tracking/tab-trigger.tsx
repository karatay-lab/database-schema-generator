"use client";

import { TabsTrigger } from "@/components/ui/tabs";
import { tabMeta, tabAccent } from "@/constants/tracking";

export function TabTrigger({
  value,
  count,
  incompleteCount,
  allClear,
}: {
  value: string;
  count?: number;
  incompleteCount?: number;
  allClear?: boolean;
}) {
  const meta = tabMeta[value]!;
  const hasPending    = (count ?? 0) > 0;
  const hasIncomplete = !hasPending && (incompleteCount ?? 0) > 0;
  const isResolver    = value !== "all";

  const statusLine = hasPending
    ? <span className="text-[10px] font-semibold text-red-500">{count} pending</span>
    : hasIncomplete
      ? <span className="text-[10px] font-semibold text-amber-500">needs value</span>
      : null;

  const dotCls = allClear && isResolver ? "bg-emerald-500"
    : hasPending    ? "bg-red-500"
    : hasIncomplete ? "bg-amber-500"
    : meta.dot;

  const bgColor = !isResolver ? undefined
    : allClear      ? "#f0fdf4"
    : hasPending    ? "#fef2f2"
    : hasIncomplete ? "#fffbeb"
    : undefined;

  const borderColor = !isResolver ? undefined
    : allClear      ? "#22c55e"
    : hasPending    ? "#ef4444"
    : hasIncomplete ? "#f59e0b"
    : undefined;

  return (
    <TabsTrigger
      value={value}
      style={{
        ...(bgColor ? { backgroundColor: bgColor } : {}),
        ...(borderColor ? { "--tab-accent": borderColor } as React.CSSProperties : {}),
      }}
      className={[
        "flex-1 flex-col justify-center gap-0.5 py-0",
        "rounded-none border-b-2 border-transparent px-2",
        "text-sm font-medium text-slate-600 shadow-none transition-colors",
        "hover:brightness-95",
        "data-active:text-slate-950 data-active:font-semibold data-active:shadow-none",
        borderColor
          ? "data-active:[border-bottom-color:var(--tab-accent)]"
          : (tabAccent[value] ?? "data-active:border-slate-700"),
        "-mb-px",
      ].join(" ")}
    >
      <span className="flex items-center gap-1.5">
        <span className={`h-2 w-2 shrink-0 rounded-full transition-colors ${dotCls}`} />
        <span className="text-xs font-semibold tracking-wide">{meta.label}</span>
      </span>
      {statusLine}
    </TabsTrigger>
  );
}
