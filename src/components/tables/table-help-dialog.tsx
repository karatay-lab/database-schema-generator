"use client";

import { pkExampleLine, type ProviderKey } from "@/constants/tables";
import type { HelpDialog } from "@/types/tables";
import { CloseIcon } from "@/components/tables/table-icons";

type PkOption = { value: string; label: string; summary: string; badgeClass: string };

type TableHelpDialogProps = {
  helpDialog: HelpDialog;
  pkTypes: PkOption[];
  providerDisplay: string;
  pkName: string;
  pkType: string;
  activeProvider: ProviderKey;
  onClose: () => void;
};

export function TableHelpDialog({
  helpDialog, pkTypes, providerDisplay, pkName, pkType, activeProvider, onClose,
}: TableHelpDialogProps) {
  if (!helpDialog) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6"
      role="dialog"
      aria-modal="true"
    >
      <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              {providerDisplay} / Tables
            </p>
            <h3 className="mt-1 text-lg font-semibold text-slate-950">
              {helpDialog === "primaryKeys" ? "Primary Key Rules" : "Naming Convention"}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:text-slate-900"
            aria-label="Close dialog"
          >
            <CloseIcon />
          </button>
        </div>

        {helpDialog === "primaryKeys" ? (
          <div className="space-y-5 px-5 py-5">
            <p className="text-sm leading-6 text-slate-600">
              Each table starts with one required Prisma{" "}
              <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-xs text-slate-700">@id</code> field.
              The options below are filtered for the active database provider.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {pkTypes.map((type) => (
                <div key={type.value} className="rounded-md border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold ${type.badgeClass}`}>
                      {type.value}
                    </span>
                    <span className="text-xs font-medium text-slate-500">{providerDisplay}</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-600">{type.summary}</p>
                  <code className="mt-3 block overflow-x-auto whitespace-nowrap rounded bg-white px-2 py-2 font-mono text-xs text-slate-700">
                    {pkExampleLine(pkName, type.value, activeProvider)}
                  </code>
                </div>
              ))}
            </div>
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm leading-6 text-amber-800">
              Postgres UUID primary keys use the database generator by default:{" "}
              <code className="ml-1 rounded bg-white px-1 py-0.5 font-mono text-xs text-amber-900">gen_random_uuid()</code>.
              DateTime IDs are kept for legacy Postgres schemas, but new tables should usually use Int, BigInt, UUID, or cuid-style String IDs.
            </p>
          </div>
        ) : (
          <div className="space-y-4 px-5 py-5">
            <p className="text-sm leading-6 text-slate-600">
              The primary key name is the Prisma field name that appears in the model. It is not the database constraint name.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <p className="text-sm font-semibold text-slate-900">Recommended</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Use <code className="rounded bg-white px-1 py-0.5 font-mono text-xs text-slate-700">id</code> for new tables unless you are matching an existing database.
                </p>
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <p className="text-sm font-semibold text-slate-900">Allowed format</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Start with a letter. Use only letters, numbers, and underscores. Prefer camelCase.
                </p>
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <p className="text-sm font-semibold text-slate-900">Legacy schemas</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Names like <code className="rounded bg-white px-1 py-0.5 font-mono text-xs text-slate-700">userId</code> are fine when the source schema already uses them.
                </p>
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <p className="text-sm font-semibold text-slate-900">Generated line</p>
                <code className="mt-2 block overflow-x-auto whitespace-nowrap rounded bg-white px-2 py-2 font-mono text-xs text-slate-700">
                  {pkExampleLine(pkName, pkType, activeProvider)}
                </code>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
