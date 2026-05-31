"use client";

import { cn } from "@/lib/utils";

export function LoadingCard({
  message = "Loading…",
  bordered = true,
  className,
}: {
  message?: string;
  /** Wrap in a slate-50 bordered card (default) or just centered text. */
  bordered?: boolean;
  className?: string;
}) {
  if (!bordered) {
    return (
      <div className={cn("py-8 text-center text-sm font-medium text-slate-500", className)}>
        {message}
      </div>
    );
  }
  return (
    <div
      className={cn(
        "rounded-lg border border-slate-200 bg-slate-50 p-8 text-center text-sm font-medium text-slate-500",
        className,
      )}
    >
      {message}
    </div>
  );
}
