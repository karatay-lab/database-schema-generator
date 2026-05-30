"use client";

import { Trash2 } from "lucide-react";
import { pkExampleLine, type ProviderKey } from "@/constants/tables";

type PkOption = { value: string; label: string; summary: string; badgeClass: string };

type EditTablePanelProps = {
  editModelName: string;
  editPkName: string;
  editPkType: string;
  updateError: string;
  isSaving: boolean;
  isDeleting: boolean;
  pkTypes: PkOption[];
  selectedEditPkSummary: string;
  providerDisplay: string;
  activeProvider: ProviderKey;
  onModelNameChange: (v: string) => void;
  onPkNameChange: (v: string) => void;
  onPkTypeChange: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete: () => void;
};

export function EditTablePanel({
  editModelName, editPkName, editPkType, updateError, isSaving, isDeleting,
  pkTypes, selectedEditPkSummary, providerDisplay, activeProvider,
  onModelNameChange, onPkNameChange, onPkTypeChange, onSave, onCancel, onDelete,
}: EditTablePanelProps) {
  return (
    <div className="rounded-lg border border-cyan-200 bg-cyan-50 p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-700">Edit Table</p>

      <label htmlFor="edit-table-name" className="mt-4 block text-sm font-semibold text-slate-700">Model name</label>
      <input
        id="edit-table-name"
        value={editModelName}
        onChange={(e) => onModelNameChange(e.target.value)}
        className="mt-2 h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-950 outline-none transition focus:border-cyan-600"
      />

      <label htmlFor="edit-pk-name" className="mt-4 block text-sm font-semibold text-slate-700">Primary Key Name</label>
      <input
        id="edit-pk-name"
        value={editPkName}
        onChange={(e) => onPkNameChange(e.target.value)}
        className="mt-2 h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-950 outline-none transition focus:border-cyan-600"
      />

      <label htmlFor="edit-pk-type" className="mt-4 block text-sm font-semibold text-slate-700">Primary Key Type</label>
      <select
        id="edit-pk-type"
        value={editPkType}
        onChange={(e) => onPkTypeChange(e.target.value)}
        className="mt-2 h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-950 outline-none transition focus:border-cyan-600"
      >
        {!pkTypes.some((t) => t.value === editPkType) && (
          <option value={editPkType}>{editPkType} (current)</option>
        )}
        {pkTypes.map((type) => (
          <option key={type.value} value={type.value}>{type.label}</option>
        ))}
      </select>
      <div className="mt-3 rounded-md border border-cyan-200 bg-white/70 p-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-cyan-700">{providerDisplay}</span>
          <span className="text-xs font-medium text-slate-500">{selectedEditPkSummary}</span>
        </div>
        <code className="mt-2 block overflow-x-auto whitespace-nowrap rounded bg-white px-2 py-2 font-mono text-xs text-slate-700">
          {pkExampleLine(editPkName, editPkType, activeProvider)}
        </code>
      </div>

      {updateError && <p className="mt-3 text-sm font-semibold text-rose-600">{updateError}</p>}

      <div className="mt-5 flex gap-2">
        <button
          type="button"
          onClick={onSave}
          disabled={isSaving || isDeleting}
          className="h-10 rounded-md border border-cyan-300 bg-white px-4 text-sm font-semibold text-cyan-700 transition hover:bg-cyan-50 disabled:cursor-not-allowed disabled:text-slate-400"
        >
          {isSaving ? "Saving..." : "Save"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isSaving || isDeleting}
          className="h-10 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={isSaving || isDeleting}
          className="ml-auto inline-flex h-10 items-center gap-2 rounded-md border border-rose-200 bg-white px-4 text-sm font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-50 disabled:cursor-not-allowed disabled:text-slate-400"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          {isDeleting ? "Deleting..." : "Delete"}
        </button>
      </div>
    </div>
  );
}
