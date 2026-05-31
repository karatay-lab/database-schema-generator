"use client";

import { classNames } from "@/lib/utils";
import { restrictionTypeLabel } from "@/constants/restrictions";
import type { PrismaField, PrismaRestrictionType } from "@/lib/schema-store";
import type { RestrictionDraft } from "@/types/restriction";

type RestrictionFormProps = {
  draft: RestrictionDraft;
  selectableFields: PrismaField[];
  savingRestriction: boolean;
  isEdit?: boolean;
  onTypeChange: (type: PrismaRestrictionType) => void;
  onFieldToggle: (fieldName: string) => void;
  onDbNameChange: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
};

export function RestrictionForm({
  draft, selectableFields, savingRestriction, isEdit = false,
  onTypeChange, onFieldToggle, onDbNameChange, onSave, onCancel,
}: RestrictionFormProps) {
  return (
    <div className="flex flex-wrap gap-5">
      <div className="shrink-0">
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Type</p>
        <div className="flex gap-1.5">
          {(["UNIQUE", "INDEX"] as PrismaRestrictionType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onTypeChange(t)}
              className={classNames(
                "h-8 rounded-md border px-3 text-xs font-semibold transition",
                draft.type === t
                  ? t === "UNIQUE"
                    ? "border-emerald-400 bg-emerald-50 text-emerald-700"
                    : "border-violet-400 bg-violet-50 text-violet-700"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50",
              )}
            >
              {restrictionTypeLabel(t)}
            </button>
          ))}
        </div>
      </div>

      <div className="min-w-48 flex-1">
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Fields</p>
        {selectableFields.length === 0 ? (
          <p className="text-xs text-slate-500">No fields available for this type.</p>
        ) : (
          <div className="grid grid-cols-2 gap-1.5 lg:grid-cols-3 xl:grid-cols-4">
            {selectableFields.map((field) => {
              const isSelected = draft.fields.includes(field.name);
              return (
                <button
                  key={field.key}
                  type="button"
                  onClick={() => onFieldToggle(field.name)}
                  className={classNames(
                    "flex items-center justify-between rounded-lg border px-2.5 py-2 text-left transition",
                    isSelected
                      ? "border-violet-400 bg-violet-50 shadow-sm"
                      : "border-slate-200 bg-white hover:border-violet-300",
                  )}
                >
                  <span className={classNames("truncate text-sm font-semibold", isSelected ? "text-violet-900" : "text-slate-800")}>
                    {field.name}
                  </span>
                  <span className={classNames(
                    "ml-2 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold",
                    isSelected ? "bg-violet-100 text-violet-700" : "bg-slate-100 text-slate-500",
                  )}>
                    {field.type}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex shrink-0 min-w-44 flex-col justify-between gap-3">
        <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
          Database Name
          <input
            value={draft.dbName}
            onChange={(e) => onDbNameChange(e.target.value)}
            className="mt-1.5 h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-medium normal-case tracking-normal text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-violet-600"
            placeholder="users_email_ix"
          />
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onSave}
            disabled={savingRestriction || draft.fields.length === 0}
            className="h-9 flex-1 rounded-md bg-violet-600 px-3 text-xs font-semibold text-white shadow-sm transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {savingRestriction ? "Saving..." : isEdit ? "Save Restriction" : "Add Restriction"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="h-9 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
