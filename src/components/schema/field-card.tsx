"use client";

import { IconCheck, IconTrash } from "@tabler/icons-react";
import { classNames } from "@/lib/utils";
import { FieldDiffTooltip } from "@/components/shared/version-diff-badge";
import { typeSelectClass } from "@/constants/schema";
import type { PrismaField, PrismaFieldInput } from "@/lib/schema-store";
import type { FieldDiff } from "@/lib/version-diff/detect-changes";

type EnumValue = { valueId: string; name: string };

type FieldCardProps = {
  field: PrismaField;
  draft: PrismaFieldInput;
  hasChanges: boolean;
  fieldDiff: FieldDiff | null | undefined;
  cardBorder: string;
  enumTypes: string[];
  scalarTypeOptions: string[];
  savingFieldKey: string;
  deletingFieldKey: string;
  getEnumValues: (name: string) => EnumValue[];
  onUpdateDraft: (fieldKey: string, patch: Partial<PrismaFieldInput>) => void;
  onSave: (field: PrismaField) => void;
  onDelete: (field: PrismaField) => void;
};

export function FieldCard({
  field, draft, hasChanges, fieldDiff, cardBorder,
  enumTypes, scalarTypeOptions, savingFieldKey, deletingFieldKey,
  getEnumValues, onUpdateDraft, onSave, onDelete,
}: FieldCardProps) {
  const isEnum = enumTypes.includes(draft.type);

  return (
    <div className={classNames("rounded-lg border bg-white p-3 shadow-sm", cardBorder)}>
      <div className="flex gap-3">
        <div className="min-w-0 flex-1 grid gap-2">
          <div className={classNames("grid gap-2", isEnum ? "grid-cols-[1fr_minmax(0,120px)_minmax(0,140px)_1fr]" : "grid-cols-[1fr_minmax(0,140px)_1fr]")}>
            <label className="block text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">
              Name
              <input value={draft.name}
                onChange={(e) => onUpdateDraft(field.key, { name: e.target.value })}
                className="mt-1 h-8 w-full rounded-md border border-slate-300 bg-white px-2.5 text-xs font-medium normal-case tracking-normal text-slate-950 outline-none transition focus:border-cyan-600"
              />
            </label>
            <label className="block text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">
              Type
              <select
                value={isEnum ? "Enum" : draft.type}
                onChange={(e) => {
                  const val = e.target.value;
                  onUpdateDraft(field.key, { type: val === "Enum" ? (enumTypes[0] ?? draft.type) : val });
                }}
                className={classNames("mt-1 h-8 w-full rounded-md border px-2.5 text-xs font-medium normal-case tracking-normal outline-none transition focus:border-cyan-600",
                  isEnum ? "border-indigo-200 bg-indigo-50 text-indigo-800" : typeSelectClass(draft.type))}>
                {scalarTypeOptions.map((t) => <option key={t} value={t}>{t}</option>)}
                <option value="Enum" disabled={enumTypes.length === 0}>Enum</option>
              </select>
              {fieldDiff?.from && fieldDiff?.to && fieldDiff.from !== fieldDiff.to && (
                <span className="mt-0.5 block font-semibold normal-case tracking-normal text-amber-600">was: {fieldDiff.from}</span>
              )}
            </label>
            {isEnum && (
              <label className="block text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                Enum
                <select value={draft.type} onChange={(e) => onUpdateDraft(field.key, { type: e.target.value })}
                  className="mt-1 h-8 w-full rounded-md border border-indigo-200 bg-indigo-50 px-2.5 text-xs font-medium normal-case tracking-normal text-indigo-800 outline-none transition focus:border-indigo-400">
                  {enumTypes.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
            )}
            <label className="block text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">
              Default
              <input value={draft.defaultValue} readOnly={isEnum}
                onChange={(e) => { if (!isEnum) onUpdateDraft(field.key, { defaultValue: e.target.value }); }}
                className={classNames("mt-1 h-8 w-full rounded-md border px-2.5 text-xs font-medium normal-case tracking-normal text-slate-950 outline-none transition",
                  isEnum ? "cursor-default border-indigo-100 bg-indigo-50/60 text-indigo-700" : "border-slate-300 bg-white placeholder:text-slate-400 focus:border-cyan-600")}
                placeholder={isEnum ? "Pick a value ↓" : "Default value"}
              />
            </label>
          </div>

          {isEnum && (
            <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-indigo-100 bg-indigo-50/70 px-2.5 py-1.5">
              <span className="mr-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-indigo-400">Values</span>
              {getEnumValues(draft.type).length === 0 ? (
                <span className="text-[10px] font-medium text-indigo-300">No values defined</span>
              ) : (
                <>
                  {getEnumValues(draft.type).slice(0, 12).map((v) => {
                    const isActive = draft.defaultValue === `"${v.name}"`;
                    return (
                      <button key={v.valueId} type="button"
                        onClick={() => onUpdateDraft(field.key, { defaultValue: isActive ? "" : `"${v.name}"` })}
                        className={classNames("rounded px-1.5 py-0.5 text-[10px] font-semibold transition",
                          isActive ? "bg-indigo-600 text-white" : "bg-indigo-100 text-indigo-700 hover:bg-indigo-200")}>
                        {v.name}
                      </button>
                    );
                  })}
                  {getEnumValues(draft.type).length > 12 && (
                    <span className="text-[10px] font-medium text-indigo-400">+{getEnumValues(draft.type).length - 12} more</span>
                  )}
                </>
              )}
            </div>
          )}

          <label className="block text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">
            Comment
            <input value={draft.comment}
              onChange={(e) => onUpdateDraft(field.key, { comment: e.target.value })}
              className="mt-1 h-8 w-full rounded-md border border-slate-300 bg-white px-2.5 text-xs font-medium normal-case tracking-normal text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-cyan-600"
              placeholder="FK companies"
            />
          </label>

          {fieldDiff && <FieldDiffTooltip diff={fieldDiff} />}
        </div>

        <div className="flex w-1/5 min-w-0 flex-col gap-1.5">
          <button type="button" onClick={() => onUpdateDraft(field.key, { nullable: !draft.nullable })}
            className={classNames("h-8 rounded-md border px-2.5 text-[11px] font-semibold transition",
              draft.nullable ? "border-emerald-500 bg-emerald-500 text-white hover:bg-emerald-600" : "border-amber-400 bg-amber-400 text-white hover:bg-amber-500")}>
            {draft.nullable ? "Nullable" : "Required"}
          </button>
          <button type="button" onClick={() => onUpdateDraft(field.key, { unique: !draft.unique })}
            disabled={draft.type === "Boolean"}
            className={classNames("h-8 rounded-md border px-2.5 text-[11px] font-semibold transition",
              draft.unique ? "border-violet-500 bg-violet-500 text-white hover:bg-violet-600" : "border-sky-400 bg-sky-400 text-white hover:bg-sky-500",
              draft.type === "Boolean" && "cursor-not-allowed opacity-30")}>
            {draft.unique ? "Unique" : "Multiple"}
          </button>
          <div className="mt-auto">
            {hasChanges ? (
              <button type="button" onClick={() => onSave(field)} disabled={savingFieldKey === field.key}
                className="flex h-8 w-full items-center justify-center rounded-md border border-cyan-300 bg-white text-cyan-600 transition hover:bg-cyan-50 disabled:cursor-not-allowed disabled:opacity-40"
                title="Save">
                <IconCheck size={15} stroke={2.5} />
              </button>
            ) : (
              <button type="button" onClick={() => onDelete(field)} disabled={deletingFieldKey === field.key}
                className="flex h-8 w-full items-center justify-center rounded-md border border-rose-200 bg-white text-rose-500 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40"
                title="Delete">
                <IconTrash size={15} stroke={2} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
