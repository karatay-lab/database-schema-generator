"use client";

import { DropZone } from "@/components/imports/drop-zone";
import { VersionPreviewCard, ProviderBadge } from "@/components/imports/version-preview-card";
import type { ParsedPreview } from "@/types/imports";

type VersionImportTabProps = {
  file: { name: string; content: string } | null;
  preview: ParsedPreview | null;
  parseError: string;
  projectName: string;
  versionName: string;
  isImporting: boolean;
  canImport: boolean;
  onFileSelect: (name: string, content: string) => void;
  onProjectNameChange: (v: string) => void;
  onVersionNameChange: (v: string) => void;
  onChangeFile: () => void;
  onImport: () => void;
};

export function VersionImportTab({
  file, preview, parseError, projectName, versionName,
  isImporting, canImport,
  onFileSelect, onProjectNameChange, onVersionNameChange, onChangeFile, onImport,
}: VersionImportTabProps) {
  if (!file) {
    return (
      <>
        <DropZone accept=".json" onFile={onFileSelect} label="Select a Version pickle file" />
        {parseError && <p className="mt-2 text-sm font-medium text-rose-600">{parseError}</p>}
      </>
    );
  }

  return (
    <>
      <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-indigo-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-indigo-700">
                Version Pickle
              </span>
              <ProviderBadge provider={preview?.provider ?? ""} />
            </div>
            <p className="mt-1.5 max-w-xs truncate text-sm font-semibold text-slate-800">{file.name}</p>
            <p className="mt-0.5 text-xs text-slate-500">
              From <span className="font-semibold">{preview?.sourceProjectName}</span>
              {preview?.exportedAt ? ` · ${new Date(preview.exportedAt).toLocaleString()}` : ""}
            </p>
          </div>
          <button type="button" onClick={onChangeFile}
            className="shrink-0 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-100">
            Change
          </button>
        </div>
        {preview?.versions[0] && (
          <div className="mt-3"><VersionPreviewCard stats={preview.versions[0]} /></div>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 p-4 space-y-3">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Import Options</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">
              New project name <span className="font-normal text-slate-400">(min 8 chars)</span>
            </label>
            <input value={projectName} onChange={(e) => onProjectNameChange(e.target.value)}
              placeholder="My Imported Project"
              className="h-9 w-full rounded-md border border-slate-300 bg-white px-2.5 text-sm font-medium text-slate-700 outline-none placeholder:text-slate-400 focus:border-lime-500"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">Version name</label>
            <input value={versionName} onChange={(e) => onVersionNameChange(e.target.value)}
              placeholder={preview?.versions[0]?.name ?? "1.0111"}
              className="h-9 w-full rounded-md border border-slate-300 bg-white px-2.5 text-sm font-medium text-slate-700 outline-none placeholder:text-slate-400 focus:border-lime-500"
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button type="button" onClick={onImport} disabled={!canImport}
          className="h-9 rounded-md bg-lime-600 px-5 text-sm font-semibold text-white transition hover:bg-lime-700 disabled:cursor-not-allowed disabled:bg-slate-300">
          {isImporting ? "Importing..." : "Import Version"}
        </button>
      </div>
    </>
  );
}
