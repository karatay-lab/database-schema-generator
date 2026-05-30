"use client";

import { classNames } from "../shared/dashboard-data";
import { typeBadgeClass } from "@/constants/schema";
import type { PrismaModel } from "@/lib/schema-store";

type TableSelectorModalProps = {
  isOpen: boolean;
  models: PrismaModel[];
  tableSearch: string;
  filteredModels: PrismaModel[];
  selectedModelName: string;
  isLoading: boolean;
  onSearch: (v: string) => void;
  onSelect: (name: string) => void;
  onClose: () => void;
};

export function TableSelectorModal({
  isOpen, models, tableSearch, filteredModels, selectedModelName,
  isLoading, onSearch, onSelect, onClose,
}: TableSelectorModalProps) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-3">
      <div className="max-h-[94vh] w-[96vw] max-w-[1500px] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl">
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Table Selector</p>
              <h3 className="mt-1 text-xl font-semibold text-slate-950">Tables</h3>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-md border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-xs font-semibold text-cyan-700">
                {models.length} tables
              </span>
              <button type="button" onClick={onClose}
                className="h-9 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50">
                Close
              </button>
            </div>
          </div>
        </div>
        <div className="p-5">
          <div className="mb-4">
            <input
              type="text"
              value={tableSearch}
              onChange={(e) => onSearch(e.target.value)}
              placeholder="Search tables..."
              className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-cyan-600"
            />
          </div>
          <div className="max-h-[70vh] overflow-y-auto pr-1">
            {isLoading ? (
              <div className="py-8 text-center text-sm font-medium text-slate-500">Loading...</div>
            ) : filteredModels.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm font-medium text-slate-500">No tables found.</div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                {filteredModels.map((model) => (
                  <button
                    key={model.name}
                    type="button"
                    onClick={() => onSelect(model.name)}
                    className={classNames(
                      "flex min-h-16 items-center justify-between rounded-lg border p-4 text-left transition",
                      model.name === selectedModelName
                        ? "border-cyan-400 bg-cyan-50 shadow-sm"
                        : "border-slate-200 bg-white hover:border-cyan-300",
                    )}
                  >
                    <span className="min-w-0 truncate font-semibold text-slate-950">{model.name}</span>
                    <span className={classNames("ml-3 inline-flex shrink-0 items-center rounded-md px-2 py-1 text-xs font-medium", typeBadgeClass(model.pkType))}>
                      {model.pkType || "String"}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
