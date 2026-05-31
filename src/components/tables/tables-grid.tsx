"use client";

import type { PrismaModel } from "@/lib/schema-store";
import type { TableDiff } from "@/lib/version-diff/detect-changes";
import { TableDiffSummary } from "@/components/shared/version-diff-badge";

type TablesGridProps = {
  models: PrismaModel[];
  searchTerm: string;
  currentPage: number;
  itemsPerPage: number;
  diffByTableKey: Map<string, TableDiff>;
  fieldTypeBadgeClass: (type: string) => string;
  onSearchChange: (term: string) => void;
  onPageChange: (page: number) => void;
  onEdit: (model: PrismaModel) => void;
  onShowDiff: (diff: TableDiff) => void;
};

export function TablesGrid({
  models, searchTerm, currentPage, itemsPerPage, diffByTableKey,
  fieldTypeBadgeClass, onSearchChange, onPageChange, onEdit, onShowDiff,
}: TablesGridProps) {
  const filtered = models.filter((m) =>
    m.name.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const page = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <>
      <div className="mb-4">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => { onSearchChange(e.target.value); onPageChange(1); }}
          placeholder="Search tables..."
          className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-cyan-600"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {page.map((model) => {
          const td = diffByTableKey.get(model.key);
          return (
            <div
              key={model.key}
              className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4 transition hover:border-cyan-300"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-slate-950">{model.name}</span>
                <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${fieldTypeBadgeClass(model.pkType || "String")}`}>
                  {model.pkType || "String"}
                </span>
                {td && (
                  <button type="button" onClick={() => onShowDiff(td)} className="shrink-0">
                    <TableDiffSummary tableDiff={td} />
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => onEdit(model)}
                className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 transition hover:border-cyan-200 hover:text-cyan-700"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-4 w-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
                </svg>
              </button>
            </div>
          );
        })}
      </div>

      {filtered.length > itemsPerPage && (
        <div className="mt-6 flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 transition hover:border-cyan-200 hover:text-cyan-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-4 w-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <span className="text-sm text-slate-600">{currentPage} / {totalPages}</span>
          <button
            type="button"
            onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage >= totalPages}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 transition hover:border-cyan-200 hover:text-cyan-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-4 w-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        </div>
      )}
    </>
  );
}
