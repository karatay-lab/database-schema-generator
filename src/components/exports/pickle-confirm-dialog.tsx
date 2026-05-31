"use client";

import { classNames } from "@/lib/utils";
import type { ExportType } from "@/constants/exports";

type PickleConfirmDialogProps = {
  pendingPickle: ExportType | null;
  version: string;
  projectName: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export function PickleConfirmDialog({ pendingPickle, version, projectName, onConfirm, onCancel }: PickleConfirmDialogProps) {
  if (!pendingPickle) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-3">
      <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white shadow-2xl">
        <div className="border-b border-slate-200 px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Confirm Export</p>
          <h3 className="mt-1 text-base font-semibold text-slate-950">
            {pendingPickle === "pickle-version" ? "Version Pickle" : "Project Pickle"}
          </h3>
        </div>
        <div className="px-5 py-4">
          <p className="text-sm leading-6 text-slate-600">
            {pendingPickle === "pickle-version" ? (
              <>You are about to pickle out <span className="font-semibold text-slate-950">{version}</span>. Are you sure?</>
            ) : (
              <>You are about to pickle out all versions in <span className="font-semibold text-slate-950">{projectName}</span>. Are you sure?</>
            )}
          </p>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3">
          <button
            type="button"
            onClick={onCancel}
            className="h-9 rounded-md border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={classNames(
              "h-9 rounded-md px-4 text-xs font-semibold text-white shadow-sm transition",
              pendingPickle === "pickle-version" ? "bg-amber-500 hover:bg-amber-600" : "bg-orange-500 hover:bg-orange-600",
            )}
          >
            Yes, download
          </button>
        </div>
      </div>
    </div>
  );
}
