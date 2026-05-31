"use client";

import { classNames } from "@/lib/utils";
import { typeBadgeClass } from "@/constants/schema";
import type { FieldDiff } from "@/lib/version-diff/detect-changes";

export function RemovedFieldsSection({
  removedFieldDiffs,
  isPending,
  onRestore,
}: {
  removedFieldDiffs: FieldDiff[];
  isPending: boolean;
  onRestore: (fd: FieldDiff) => void;
}) {
  if (removedFieldDiffs.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-red-600">
          Removed since previous version
        </p>
        <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-700">
          {removedFieldDiffs.length}
        </span>
      </div>
      <div className="grid gap-3 xl:grid-cols-2 2xl:grid-cols-3">
        {removedFieldDiffs.map((fd) => (
          <div
            key={fd.fieldId}
            className="rounded-lg border border-dashed border-red-200 bg-red-50/40 p-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-red-500">
                  Removed field
                </p>
                <p className="mt-0.5 font-semibold text-slate-800">{fd.fieldName}</p>
                <div className="mt-1 flex items-center gap-1.5">
                  <span className={classNames("rounded px-1.5 py-0.5 text-[10px] font-semibold", typeBadgeClass(fd.from))}>
                    {fd.from}
                  </span>
                </div>
                <p className="mt-1.5 text-[10px] leading-relaxed text-slate-500">{fd.message}</p>
              </div>
              <button
                type="button"
                onClick={() => onRestore(fd)}
                disabled={isPending}
                className="shrink-0 rounded-md border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:border-red-300 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Restore
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
