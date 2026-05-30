"use client";

import { classNames } from "@/lib/utils";
import { restrictionTypeLabel, restrictionTypeClass } from "@/constants/restrictions";
import type { PrismaRestriction } from "@/lib/schema-store";

type RestrictionCardProps = {
  restriction: PrismaRestriction;
  isDeleting: boolean;
  onEdit: () => void;
  onDelete: () => void;
};

export function RestrictionCard({ restriction, isDeleting, onEdit, onDelete }: RestrictionCardProps) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={classNames("rounded-md border px-2 py-1 text-xs font-semibold", restrictionTypeClass(restriction.type))}>
              {restrictionTypeLabel(restriction.type)}
            </span>
            <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
              {restriction.source === "field" ? "Field" : "Model"}
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {restriction.fields.map((fieldName) => (
              <span
                key={fieldName}
                className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700"
              >
                {fieldName}
              </span>
            ))}
          </div>
        </div>
        <div className="flex shrink-0 gap-1.5">
          <button
            type="button"
            onClick={onEdit}
            className="h-8 rounded-md border border-violet-200 bg-white px-2.5 text-xs font-semibold text-violet-700 transition hover:bg-violet-50"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={isDeleting}
            className="h-8 rounded-md border border-rose-200 bg-white px-2.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:text-slate-400"
          >
            {isDeleting ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>

      {restriction.dbName && (
        <p className="mt-3 text-xs font-semibold text-slate-500">
          DB name: <span className="text-slate-800">{restriction.dbName}</span>
        </p>
      )}
      <code className="mt-3 block overflow-x-auto rounded-md bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-50">
        {restriction.preview}
      </code>
    </div>
  );
}
