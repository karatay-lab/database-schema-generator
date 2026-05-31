"use client";

import { IconCheck, IconTrash } from "@tabler/icons-react";
import { classNames } from "@/lib/utils";
import { typeSelectClass } from "@/constants/schema";
import type { PrismaFieldInput } from "@/lib/schema-store";

type EnumValue = { valueId: string; name: string };

type NewFieldCardProps = {
  draft: { id: string; input: PrismaFieldInput };
  enumTypes: string[];
  scalarTypeOptions: string[];
  savingNewCardId: string;
  getEnumValues: (name: string) => EnumValue[];
  onUpdate: (draftId: string, patch: Partial<PrismaFieldInput>) => void;
  onSave: (draftId: string) => void;
  onRemove: (draftId: string) => void;
};

export function NewFieldCard({
  draft, enumTypes, scalarTypeOptions, savingNewCardId,
  getEnumValues, onUpdate, onSave, onRemove,
}: NewFieldCardProps) {
  const { id, input } = draft;
  const isEnum = enumTypes.includes(input.type);
  const hasName = input.name.trim().length > 0;

  return (
    <div className="rounded-lg border border-cyan-200 bg-white p-3 shadow-sm">
      <div className="flex gap-3">
        <div className="min-w-0 flex-1 grid gap-2">
          <div className={classNames("grid gap-2", isEnum ? "grid-cols-[1fr_minmax(0,120px)_minmax(0,140px)_1fr]" : "grid-cols-[1fr_minmax(0,140px)_1fr]")}>
            <label className="block text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">
              Name
              <input value={input.name} onChange={(e) => onUpdate(id, { name: e.target.value })} autoFocus
                className="mt-1 h-8 w-full rounded-md border border-slate-300 bg-white px-2.5 text-xs font-medium normal-case tracking-normal text-slate-950 outline-none transition focus:border-cyan-600"
              />
            </label>
            <label className="block text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">
              Type
              <select value={isEnum ? "Enum" : input.type}
                onChange={(e) => {
                  const val = e.target.value;
                  onUpdate(id, { type: val === "Enum" ? (enumTypes[0] ?? input.type) : val });
                }}
                className={classNames("mt-1 h-8 w-full rounded-md border px-2.5 text-xs font-medium normal-case tracking-normal outline-none transition focus:border-cyan-600",
                  isEnum ? "border-indigo-200 bg-indigo-50 text-indigo-800" : typeSelectClass(input.type))}>
                {scalarTypeOptions.map((t) => <option key={t} value={t}>{t}</option>)}
                <option value="Enum" disabled={enumTypes.length === 0}>Enum</option>
              </select>
            </label>
            {isEnum && (
              <label className="block text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                Enum
                <select value={input.type} onChange={(e) => onUpdate(id, { type: e.target.value })}
                  className="mt-1 h-8 w-full rounded-md border border-indigo-200 bg-indigo-50 px-2.5 text-xs font-medium normal-case tracking-normal text-indigo-800 outline-none transition focus:border-indigo-400">
                  {enumTypes.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
            )}
            <label className="block text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">
              Default
              <input value={input.defaultValue} readOnly={isEnum}
                onChange={(e) => { if (!isEnum) onUpdate(id, { defaultValue: e.target.value }); }}
                className={classNames("mt-1 h-8 w-full rounded-md border px-2.5 text-xs font-medium normal-case tracking-normal text-slate-950 outline-none transition",
                  isEnum ? "cursor-default border-indigo-100 bg-indigo-50/60 text-indigo-700" : "border-slate-300 bg-white placeholder:text-slate-400 focus:border-cyan-600")}
                placeholder={isEnum ? "Pick a value ↓" : "Default value"}
              />
            </label>
          </div>

          {isEnum && (
            <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-indigo-100 bg-indigo-50/70 px-2.5 py-1.5">
              <span className="mr-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-indigo-400">Values</span>
              {getEnumValues(input.type).length === 0 ? (
                <span className="text-[10px] font-medium text-indigo-300">No values defined</span>
              ) : (
                <>
                  {getEnumValues(input.type).slice(0, 12).map((v) => {
                    const isActive = input.defaultValue === `"${v.name}"`;
                    return (
                      <button key={v.valueId} type="button"
                        onClick={() => onUpdate(id, { defaultValue: isActive ? "" : `"${v.name}"` })}
                        className={classNames("rounded px-1.5 py-0.5 text-[10px] font-semibold transition",
                          isActive ? "bg-indigo-600 text-white" : "bg-indigo-100 text-indigo-700 hover:bg-indigo-200")}>
                        {v.name}
                      </button>
                    );
                  })}
                  {getEnumValues(input.type).length > 12 && (
                    <span className="text-[10px] font-medium text-indigo-400">+{getEnumValues(input.type).length - 12} more</span>
                  )}
                </>
              )}
            </div>
          )}

          <label className="block text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">
            Comment
            <input value={input.comment} onChange={(e) => onUpdate(id, { comment: e.target.value })}
              className="mt-1 h-8 w-full rounded-md border border-slate-300 bg-white px-2.5 text-xs font-medium normal-case tracking-normal text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-cyan-600"
              placeholder="FK companies"
            />
          </label>
        </div>

        <div className="flex w-1/5 min-w-0 flex-col gap-1.5">
          <button type="button" onClick={() => onUpdate(id, { nullable: !input.nullable })}
            className={classNames("h-8 rounded-md border px-2.5 text-[11px] font-semibold transition",
              input.nullable ? "border-emerald-500 bg-emerald-500 text-white hover:bg-emerald-600" : "border-amber-400 bg-amber-400 text-white hover:bg-amber-500")}>
            {input.nullable ? "Nullable" : "Required"}
          </button>
          <button type="button" onClick={() => onUpdate(id, { unique: !input.unique })}
            disabled={input.type === "Boolean"}
            className={classNames("h-8 rounded-md border px-2.5 text-[11px] font-semibold transition",
              input.unique ? "border-violet-500 bg-violet-500 text-white hover:bg-violet-600" : "border-sky-400 bg-sky-400 text-white hover:bg-sky-500",
              input.type === "Boolean" && "cursor-not-allowed opacity-30")}>
            {input.unique ? "Unique" : "Multiple"}
          </button>
          <div className="mt-auto">
            {hasName ? (
              <button type="button" onClick={() => onSave(id)} disabled={savingNewCardId === id}
                className="flex h-8 w-full items-center justify-center rounded-md border border-cyan-300 bg-white text-cyan-600 transition hover:bg-cyan-50 disabled:cursor-not-allowed disabled:opacity-40"
                title="Save">
                <IconCheck size={15} stroke={2.5} />
              </button>
            ) : (
              <button type="button" onClick={() => onRemove(id)}
                className="flex h-8 w-full items-center justify-center rounded-md border border-rose-200 bg-white text-rose-500 transition hover:bg-rose-50"
                title="Cancel">
                <IconTrash size={15} stroke={2} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
