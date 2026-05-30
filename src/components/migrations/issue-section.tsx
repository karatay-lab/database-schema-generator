"use client";

import { cn } from "@/lib/utils";
import type { ValidationIssue } from "@/types/migrations";

export function IssueSection({ title, issues }: { title: string; issues: ValidationIssue[] }) {
  const errors = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity === "warning");
  if (issues.length === 0) return null;
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{title}</p>
        {errors.length > 0 && (
          <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
            {errors.length} error{errors.length !== 1 ? "s" : ""}
          </span>
        )}
        {warnings.length > 0 && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
            {warnings.length} warning{warnings.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>
      <div className="max-h-48 overflow-y-auto rounded-md border border-slate-200 divide-y divide-slate-100">
        {issues.map((issue, idx) => (
          <div key={idx} className="grid grid-cols-[160px_60px_1fr] items-start gap-3 px-4 py-2.5 text-xs hover:bg-slate-50">
            <p className="truncate font-semibold text-slate-800">
              {issue.model}.<span className="text-slate-400">{issue.field}</span>
            </p>
            <span className={cn(
              "inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold",
              issue.severity === "error" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700",
            )}>
              {issue.severity}
            </span>
            <div>
              <p className="text-slate-700">{issue.issue}</p>
              {issue.suggestion && <p className="mt-0.5 italic text-slate-400">{issue.suggestion}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
