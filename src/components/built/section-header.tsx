"use client";

import { cn } from "@/lib/utils";

/**
 * The repeated eyebrow + title + description text block used at the top
 * of every workflow page section.
 *
 * Does NOT include its own card wrapper — compose with <Card> if needed:
 *   <Card><CardHeader><SectionHeader ... /></CardHeader></Card>
 */
export function SectionHeader({
  eyebrow,
  title,
  description,
  action,
  className,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  /** Optional right-side slot for buttons, badges, etc. */
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between", className)}>
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
          {eyebrow}
        </p>
        <h3 className="mt-1 text-xl font-semibold text-slate-950">{title}</h3>
        {description && (
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        )}
      </div>
      {action && (
        <div className="flex flex-wrap items-center gap-2">{action}</div>
      )}
    </div>
  );
}
