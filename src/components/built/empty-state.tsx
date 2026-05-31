"use client";

import { cn } from "@/lib/utils";

export function EmptyState({
  message,
  description,
  action,
  className,
}: {
  message: string;
  description?: string;
  action?: { label: string; onClick: () => void; tone?: "cyan" | "violet" | "emerald" | "fuchsia" | "slate" };
  className?: string;
}) {
  const toneClass: Record<string, string> = {
    cyan:    "bg-cyan-600 hover:bg-cyan-700",
    violet:  "bg-violet-600 hover:bg-violet-700",
    emerald: "bg-emerald-600 hover:bg-emerald-700",
    fuchsia: "bg-fuchsia-600 hover:bg-fuchsia-700",
    slate:   "bg-slate-700 hover:bg-slate-800",
  };

  return (
    <div
      className={cn(
        "rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center",
        className,
      )}
    >
      <p className="text-sm font-medium text-slate-500">{message}</p>
      {description && (
        <p className="mt-1 text-xs text-slate-400">{description}</p>
      )}
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className={cn(
            "mt-4 h-10 min-w-44 rounded-md px-6 text-sm font-semibold text-white shadow-sm transition",
            toneClass[action.tone ?? "slate"],
          )}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
