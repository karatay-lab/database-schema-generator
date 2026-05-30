"use client";

import type { FormEvent } from "react";
import { pkExampleLine, type ProviderKey } from "@/constants/tables";
import type { HelpDialog } from "@/types/tables";
import { HelpIcon } from "@/components/tables/table-icons";

type PkOption = { value: string; label: string; summary: string; badgeClass: string };

type AddTableFormProps = {
  modelName: string;
  pkName: string;
  effectivePkType: string;
  createError: string;
  isPending: boolean;
  modelCount: number;
  pkTypes: PkOption[];
  selectedPkSummary: string;
  providerDisplay: string;
  activeProvider: ProviderKey;
  onModelNameChange: (v: string) => void;
  onPkNameChange: (v: string) => void;
  onPkTypeChange: (v: string) => void;
  onHelpClick: (dialog: HelpDialog) => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
};

export function AddTableForm({
  modelName, pkName, effectivePkType, createError, isPending, modelCount,
  pkTypes, selectedPkSummary, providerDisplay, activeProvider,
  onModelNameChange, onPkNameChange, onPkTypeChange, onHelpClick, onSubmit,
}: AddTableFormProps) {
  return (
    <form onSubmit={onSubmit} className="border-b border-slate-200 p-5 lg:border-b-0 lg:border-r">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Add Table</p>
      <p className="mt-1 text-sm text-slate-600">Create a new model in the Prisma schema.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onHelpClick("primaryKeys")}
          className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:border-cyan-200 hover:text-cyan-700"
          aria-label="Open primary key rules"
        >
          <HelpIcon />
          <span>Primary Keys</span>
        </button>
        <button
          type="button"
          onClick={() => onHelpClick("naming")}
          className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:border-cyan-200 hover:text-cyan-700"
          aria-label="Open naming convention rules"
        >
          <HelpIcon />
          <span>Naming</span>
        </button>
      </div>

      <label htmlFor="table-name" className="mt-5 block text-sm font-semibold text-slate-700">Model name</label>
      <input
        id="table-name"
        value={modelName}
        onChange={(e) => onModelNameChange(e.target.value)}
        className="mt-2 h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-cyan-600"
        placeholder="Customer"
      />

      <label htmlFor="table-pk-name" className="mt-5 block text-sm font-semibold text-slate-700">Primary Key Name</label>
      <input
        id="table-pk-name"
        value={pkName}
        onChange={(e) => onPkNameChange(e.target.value)}
        className="mt-2 h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-cyan-600"
        placeholder="id"
      />
      <p className="mt-2 text-xs leading-5 text-slate-500">
        Use a Prisma field name. The conventional choice is{" "}
        <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[11px] text-slate-700">id</code>.
      </p>

      <label htmlFor="table-pk-type" className="mt-5 block text-sm font-semibold text-slate-700">Primary Key Type</label>
      <select
        id="table-pk-type"
        value={effectivePkType}
        onChange={(e) => onPkTypeChange(e.target.value)}
        className="mt-2 h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-950 outline-none transition focus:border-cyan-600"
      >
        {pkTypes.map((type) => (
          <option key={type.value} value={type.value}>{type.label}</option>
        ))}
      </select>
      <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{providerDisplay}</span>
          <span className="text-xs font-medium text-slate-500">{selectedPkSummary}</span>
        </div>
        <code className="mt-2 block overflow-x-auto whitespace-nowrap rounded bg-white px-2 py-2 font-mono text-xs text-slate-700">
          {pkExampleLine(pkName, effectivePkType, activeProvider)}
        </code>
      </div>

      {createError && <p className="mt-3 text-sm font-semibold text-rose-600">{createError}</p>}

      <button
        type="submit"
        disabled={isPending || modelCount >= 50}
        className="mt-5 h-10 w-full rounded-md bg-cyan-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {isPending ? "Creating..." : "Add Table"}
      </button>
    </form>
  );
}
