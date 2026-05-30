"use client";

import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { classNames } from "@/lib/utils";
import { toCamelCaseIdentifier } from "@/lib/schema-naming";
import type { PrismaField, PrismaModel } from "@/lib/schema-store";
import type { RelationDraft } from "@/types/relation";

type RelationFormModalProps = {
  isOpen: boolean;
  selectedModelName: string;
  editingRelationKey: string;
  draft: RelationDraft;
  fkNameConflict: boolean;
  fkConflictIsExistingField: boolean;
  backRefConflict: boolean;
  savingRelation: boolean;
  modalTableSearch: string;
  modalTablePage: number;
  modalTablesPerPage: number;
  fkFieldType: string;
  fkFieldDbName: string;
  error: string;
  models: PrismaModel[];
  tablesIsLoading: boolean;
  targetFieldsIsLoading: boolean;
  selectableTargetFields: PrismaField[];
  onCancel: () => void;
  onSave: () => void;
  onUpdateDraft: (patch: Partial<RelationDraft>) => void;
  onTableSearchChange: (v: string) => void;
  onTablePageChange: (p: number) => void;
  onFkDbNameChange: (v: string) => void;
};

const cascadeOptions = [
  { value: "NoAction", label: "No Action" },
  { value: "Cascade",  label: "Cascade"  },
  { value: "Restrict", label: "Restrict" },
  { value: "SetNull",  label: "Set Null" },
] as const;

function CascadeGrid({ field, value, nullable, onChange }: {
  field: string; value: string; nullable: boolean; onChange: (v: string) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">{field}</p>
      <div className="grid grid-cols-4 gap-1.5">
        {cascadeOptions.map((opt) => {
          const isSelected = value === opt.value;
          const isDisabled = opt.value === "SetNull" && !nullable;
          return (
            <button
              key={opt.value}
              type="button"
              disabled={isDisabled}
              onClick={() => onChange(opt.value)}
              className={classNames(
                "rounded-md border-2 px-2 py-1.5 text-center text-xs font-semibold transition",
                isDisabled ? "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300"
                : isSelected ? "border-violet-400 bg-violet-50 text-violet-800"
                : "border-slate-200 bg-white text-slate-600 hover:border-violet-200 hover:text-violet-700",
              )}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function RelationFormModal({
  isOpen, selectedModelName, editingRelationKey, draft,
  fkNameConflict, fkConflictIsExistingField, backRefConflict,
  savingRelation, modalTableSearch, modalTablePage, modalTablesPerPage,
  fkFieldType, fkFieldDbName, error,
  models, tablesIsLoading, targetFieldsIsLoading, selectableTargetFields,
  onCancel, onSave, onUpdateDraft, onTableSearchChange, onTablePageChange, onFkDbNameChange,
}: RelationFormModalProps) {
  if (!isOpen) return null;

  const filteredModels = models.filter((m) => m.name.toLowerCase().includes(modalTableSearch.toLowerCase()));
  const pageCount = Math.max(1, Math.ceil(filteredModels.length / modalTablesPerPage));
  const safePage = Math.min(modalTablePage, pageCount);
  const pagedModels = filteredModels.slice((safePage - 1) * modalTablesPerPage, safePage * modalTablesPerPage);

  const canSave = !savingRelation && !fkNameConflict && !backRefConflict &&
    !!draft.name.trim() && !!draft.targetModel.trim() && !!draft.backReferenceName.trim() &&
    !!draft.fields.trim() && !!draft.references.trim();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-3">
      <div className="flex h-[96vh] w-[98vw] max-w-[1500px] flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="shrink-0 border-b border-slate-200 px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                {editingRelationKey ? "Update Relation" : "Create Relation"}
              </p>
              <h3 className="mt-1 text-xl font-semibold text-slate-950">
                {selectedModelName}
                {draft.targetModel && <span className="ml-2 text-slate-400">→ {draft.targetModel}</span>}
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={onCancel}
                className="h-9 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                Cancel
              </button>
              <button type="button" onClick={onSave} disabled={!canSave}
                className="h-9 min-w-36 rounded-md bg-violet-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-slate-300">
                {savingRelation ? "Saving…" : editingRelationKey ? "Save Relation" : "Create Relation"}
              </button>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          <div className="space-y-8">

            {/* Target Table */}
            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Target Table</p>
                {draft.targetModel && (
                  <span className="rounded-md border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700">
                    {draft.targetModel}
                  </span>
                )}
              </div>
              <input
                type="text"
                value={modalTableSearch}
                onChange={(e) => { onTableSearchChange(e.target.value); onTablePageChange(1); }}
                placeholder="Search tables…"
                className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-violet-600"
              />
              <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                {tablesIsLoading ? (
                  <div className="col-span-6 py-5 text-center text-sm font-medium text-slate-500">Loading…</div>
                ) : pagedModels.length === 0 ? (
                  <div className="col-span-6 py-5 text-center text-sm font-medium text-slate-500">No tables found.</div>
                ) : pagedModels.map((model) => {
                  const isSelected = draft.targetModel === model.name;
                  return (
                    <button
                      key={model.key}
                      type="button"
                      onClick={() => onUpdateDraft({ targetModel: model.name })}
                      className={classNames(
                        "flex items-center justify-between rounded-lg border px-3 py-2.5 text-left transition",
                        isSelected ? "border-violet-400 bg-violet-50 shadow-sm" : "border-slate-200 bg-white hover:border-violet-300",
                      )}
                    >
                      <span className={classNames("truncate text-sm font-semibold", isSelected ? "text-violet-900" : "text-slate-800")}>
                        {model.name}
                      </span>
                      <span className={classNames("ml-2 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold", isSelected ? "bg-violet-100 text-violet-700" : "bg-slate-100 text-slate-500")}>
                        {model.pkType || "—"}
                      </span>
                    </button>
                  );
                })}
              </div>
              {pageCount > 1 && (
                <div className="mt-2 flex items-center justify-center gap-2">
                  <button type="button" onClick={() => onTablePageChange(Math.max(1, safePage - 1))} disabled={safePage === 1}
                    className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 transition hover:border-violet-300 hover:text-violet-700 disabled:cursor-not-allowed disabled:opacity-50">
                    <IconChevronLeft size={13} />
                  </button>
                  <span className="text-xs font-semibold text-slate-500">{safePage} / {pageCount}</span>
                  <button type="button" onClick={() => onTablePageChange(Math.min(pageCount, safePage + 1))} disabled={safePage === pageCount}
                    className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 transition hover:border-violet-300 hover:text-violet-700 disabled:cursor-not-allowed disabled:opacity-50">
                    <IconChevronRight size={13} />
                  </button>
                </div>
              )}
            </div>

            {/* Relation Field + Back Reference */}
            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Relation Field</p>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Back Reference</p>
              </div>
              <div className={classNames(
                "flex overflow-hidden rounded-md border focus-within:border-violet-500",
                backRefConflict ? "border-amber-400" : "border-slate-300",
              )}>
                <input
                  value={draft.name}
                  onChange={(e) => onUpdateDraft({ name: e.target.value.replace(/[^a-zA-Z0-9]/g, "") })}
                  onBlur={() => { if (draft.name.trim()) onUpdateDraft({ name: toCamelCaseIdentifier(draft.name) }); }}
                  placeholder="companyId"
                  autoFocus
                  className="min-w-0 flex-1 bg-white px-3 py-2.5 text-sm font-medium text-slate-950 outline-none placeholder:text-slate-400"
                />
                <div className="flex shrink-0 items-center border-x border-slate-300 bg-slate-100 px-4">
                  <span className="text-xs font-bold text-slate-400">To</span>
                </div>
                <input
                  value={draft.backReferenceName}
                  disabled
                  placeholder="auto"
                  className={classNames(
                    "min-w-0 flex-1 px-3 py-2.5 font-mono text-sm outline-none placeholder:text-slate-300",
                    backRefConflict ? "bg-amber-50 text-amber-700" : "bg-slate-50 text-slate-500",
                  )}
                />
              </div>
              {backRefConflict ? (
                <p className="mt-1.5 text-xs font-semibold text-amber-600">
                  Back reference <code className="rounded bg-amber-100 px-1 font-mono">{draft.backReferenceName}</code> already exists on <span className="font-semibold">{draft.targetModel}</span>. Use a different relation field name.
                </p>
              ) : (
                <p className="mt-1 text-[10px] normal-case leading-4 tracking-normal text-slate-400">
                  Left: the FK field name on <span className="font-semibold text-slate-500">{selectedModelName}</span>. Right: virtual back-reference auto-added to <span className="font-semibold text-slate-500">{draft.targetModel || "target"}</span>.
                </p>
              )}
            </div>

            {/* FK Column */}
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">FK Column</p>
              <div className={classNames(
                "flex overflow-hidden rounded-md border focus-within:border-violet-500",
                fkNameConflict ? "border-amber-400" : "border-slate-300",
              )}>
                <input
                  value={draft.fields}
                  onChange={(e) => onUpdateDraft({ fields: e.target.value.replace(/[^a-zA-Z0-9]/g, "") })}
                  onBlur={() => { if (draft.fields.trim()) onUpdateDraft({ fields: toCamelCaseIdentifier(draft.fields) }); }}
                  disabled={!!editingRelationKey}
                  placeholder="companyId"
                  className="min-w-0 flex-1 bg-white px-3 py-2 text-sm font-medium text-slate-950 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
                />
                <div className={classNames("flex shrink-0 items-center border-l px-3", fkNameConflict ? "border-amber-400 bg-amber-50" : "border-slate-300 bg-slate-50")}>
                  <span className="text-xs font-bold text-slate-500">{fkFieldType || "—"}</span>
                </div>
              </div>
              {fkNameConflict ? (
                <p className="mt-1.5 text-xs font-semibold text-amber-600">
                  {fkConflictIsExistingField
                    ? <>Column <code className="rounded bg-amber-100 px-1 font-mono">{draft.fields}</code> already exists as a field on <span className="font-semibold">{selectedModelName}</span>.</>
                    : <>Column <code className="rounded bg-amber-100 px-1 font-mono">{draft.fields}</code> is already used as a FK by another relation.</>
                  }
                </p>
              ) : (
                <p className="mt-1.5 text-[10px] normal-case leading-4 tracking-normal text-slate-400">
                  {editingRelationKey ? "FK column cannot be renamed after creation." : <>Scalar column created on <span className="font-semibold text-slate-500">{selectedModelName}</span>.</>}
                </p>
              )}
              {!editingRelationKey && (
                <div className="mt-2">
                  <input
                    value={fkFieldDbName}
                    onChange={(e) => onFkDbNameChange(e.target.value.replace(/\s/g, "_").toLowerCase())}
                    placeholder="@map name (optional)"
                    className="h-8 w-full rounded-md border border-slate-200 bg-slate-50 px-3 font-mono text-xs text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-violet-400"
                  />
                </div>
              )}
            </div>

            {/* Target References */}
            <div>
              <div className="mb-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Target References</p>
                <p className="mt-0.5 text-xs font-medium text-slate-400">
                  {draft.targetModel
                    ? <><span className="font-semibold text-slate-600">@id</span> and <span className="font-semibold text-slate-600">@unique</span> fields on <span className="font-semibold text-slate-600">{draft.targetModel}</span></>
                    : "Select a target table first"}
                </p>
              </div>
              {!draft.targetModel ? (
                <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 py-8 text-center text-sm font-medium text-slate-500">
                  Select a target table to see its reference fields.
                </div>
              ) : targetFieldsIsLoading ? (
                <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 py-8 text-center text-sm font-medium text-slate-500">Loading target fields…</div>
              ) : selectableTargetFields.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 py-8 text-center text-sm font-medium text-slate-500">
                  No <code className="rounded bg-slate-200 px-1 font-mono text-xs">@id</code> or <code className="rounded bg-slate-200 px-1 font-mono text-xs">@unique</code> fields found on <strong>{draft.targetModel}</strong>.
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {selectableTargetFields.map((field) => {
                    const isChecked = draft.references === field.name;
                    return (
                      <button
                        key={field.key}
                        type="button"
                        onClick={() => onUpdateDraft({ references: isChecked ? "" : field.name })}
                        className={classNames(
                          "flex flex-col items-start gap-1.5 rounded-lg border p-3 text-left transition",
                          isChecked ? "border-cyan-400 bg-cyan-50 shadow-sm ring-1 ring-cyan-300" : "border-slate-200 bg-white hover:border-cyan-300 hover:bg-cyan-50/40",
                        )}
                      >
                        <div className="flex w-full items-start justify-between gap-1">
                          <span className={classNames("truncate text-sm font-bold", isChecked ? "text-cyan-900" : "text-slate-950")}>{field.name}</span>
                          <span className={classNames("mt-0.5 shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-bold", isChecked ? "border-cyan-300 bg-cyan-100 text-cyan-700" : "border-slate-200 bg-slate-50 text-slate-500")}>
                            {field.type}
                          </span>
                        </div>
                        <span className={classNames("rounded px-1.5 py-0.5 text-[10px] font-bold", field.isId ? "bg-violet-100 text-violet-700" : "bg-emerald-100 text-emerald-700")}>
                          {field.isId ? "PRIMARY KEY" : "UNIQUE"}
                        </span>
                        {field.comment && (
                          <span className="line-clamp-2 text-[11px] leading-4 text-slate-500">{field.comment}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Relation Type */}
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Relation Type</p>
              <div className="grid gap-4 sm:grid-cols-2">
                {/* One to One */}
                <button
                  type="button"
                  onClick={() => onUpdateDraft({ cardinality: "one-to-one" })}
                  className={classNames(
                    "flex flex-col gap-3 rounded-lg border-2 p-5 text-left transition",
                    draft.cardinality === "one-to-one" ? "border-violet-400 bg-violet-50" : "border-slate-200 bg-white hover:border-violet-200 hover:bg-violet-50/30",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={classNames("text-base font-bold", draft.cardinality === "one-to-one" ? "text-violet-900" : "text-slate-800")}>One to One</span>
                    {draft.cardinality === "one-to-one" && <span className="rounded-full bg-violet-600 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">Selected</span>}
                  </div>
                  <div className="flex items-center gap-2 font-mono text-sm">
                    <span className={classNames("rounded border px-2 py-1 font-semibold", draft.cardinality === "one-to-one" ? "border-violet-300 bg-white text-violet-800" : "border-slate-200 bg-slate-50 text-slate-600")}>{selectedModelName || "A"}</span>
                    <span className={draft.cardinality === "one-to-one" ? "text-violet-400" : "text-slate-300"}>────</span>
                    <span className={classNames("rounded border px-2 py-1 font-semibold", draft.cardinality === "one-to-one" ? "border-violet-300 bg-white text-violet-800" : "border-slate-200 bg-slate-50 text-slate-600")}>{draft.targetModel || "B"}</span>
                  </div>
                  <p className="text-xs font-medium text-slate-500">Each record in <strong>{selectedModelName || "A"}</strong> links to exactly one record in <strong>{draft.targetModel || "B"}</strong>.</p>
                </button>

                {/* One to Many */}
                <button
                  type="button"
                  onClick={() => onUpdateDraft({ cardinality: "one-to-many" })}
                  className={classNames(
                    "flex flex-col gap-3 rounded-lg border-2 p-5 text-left transition",
                    draft.cardinality === "one-to-many" ? "border-emerald-400 bg-emerald-50" : "border-slate-200 bg-white hover:border-emerald-200 hover:bg-emerald-50/30",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={classNames("text-base font-bold", draft.cardinality === "one-to-many" ? "text-emerald-900" : "text-slate-800")}>One to Many</span>
                    {draft.cardinality === "one-to-many" && <span className="rounded-full bg-emerald-600 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">Selected</span>}
                  </div>
                  <div className="flex items-center gap-2 font-mono text-sm">
                    <span className={classNames("rounded border px-2 py-1 font-semibold", draft.cardinality === "one-to-many" ? "border-emerald-300 bg-white text-emerald-800" : "border-slate-200 bg-slate-50 text-slate-600")}>{draft.targetModel || "B"}</span>
                    <span className={draft.cardinality === "one-to-many" ? "text-emerald-400" : "text-slate-300"}>──────{"<"}</span>
                    <span className={classNames("rounded border px-2 py-1 font-semibold", draft.cardinality === "one-to-many" ? "border-emerald-300 bg-white text-emerald-800" : "border-slate-200 bg-slate-50 text-slate-600")}>{selectedModelName || "A"}</span>
                  </div>
                  <p className="text-xs font-medium text-slate-500">One record in <strong>{draft.targetModel || "B"}</strong> can own many records in <strong>{selectedModelName || "A"}</strong>.</p>
                </button>
              </div>
            </div>

            {/* Nullable + Cascade */}
            <div className="space-y-5">
              <div className="space-y-2">
                <p className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">Nullable</p>
                <button
                  type="button"
                  onClick={() => onUpdateDraft({ nullable: !draft.nullable })}
                  className={classNames(
                    "h-12 w-full rounded-md border px-3 text-base font-semibold transition",
                    draft.nullable ? "border-emerald-500 bg-emerald-500 text-white hover:bg-emerald-600" : "border-amber-400 bg-amber-400 text-white hover:bg-amber-500",
                  )}
                >
                  {draft.nullable ? "Nullable" : "Required"}
                </button>
              </div>
              <CascadeGrid field="On Delete" value={draft.onDelete} nullable={draft.nullable} onChange={(v) => onUpdateDraft({ onDelete: v })} />
              <CascadeGrid field="On Update" value={draft.onUpdate} nullable={draft.nullable} onChange={(v) => onUpdateDraft({ onUpdate: v })} />
            </div>

            {error && (
              <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{error}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
