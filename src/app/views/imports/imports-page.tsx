"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { classNames } from "../shared/dashboard-data";
import { DropZone } from "@/components/imports/drop-zone";
import { VersionPreviewCard, ProviderBadge } from "@/components/imports/version-preview-card";
import type { ImportMode, ParsedPreview } from "@/types/imports";
import { todayVersionName, parsePicklePreview } from "@/constants/imports";

export function ImportsPageContent() {
  const trpc = useTRPC();

  const [mode, setMode] = useState<ImportMode>("version");

  // Version import state
  const [vFile, setVFile] = useState<{ name: string; content: string } | null>(null);
  const [vPreview, setVPreview] = useState<ParsedPreview | null>(null);
  const [vParseError, setVParseError] = useState("");
  const [vProjectName, setVProjectName] = useState("");
  const [vVersionName, setVVersionName] = useState("");

  // Project import state
  const [pFile, setPFile] = useState<{ name: string; content: string } | null>(null);
  const [pPreview, setPPreview] = useState<ParsedPreview | null>(null);
  const [pParseError, setPParseError] = useState("");
  const [pProjectName, setPProjectName] = useState("");

  const [result, setResult] = useState<string>("");
  const [error, setError] = useState<string>("");

  const importVersionMutation = useMutation({
    ...trpc.imports.importVersion.mutationOptions(),
    onSuccess: (data) => {
      const s = data?.stats;
      setResult(
        `Imported version "${data?.versionName ?? ""}" — ${s?.tableCount ?? 0} tables, ${s?.fieldCount ?? 0} fields, ${s?.relationCount ?? 0} relations, ${s?.enumCount ?? 0} enums.`,
      );
      setVFile(null);
      setVPreview(null);
      setError("");
    },
    onError: (err) => { setError(err.message); setResult(""); },
  });

  const importProjectMutation = useMutation({
    ...trpc.imports.importProject.mutationOptions(),
    onSuccess: (data) => {
      const totalTables = data?.stats?.reduce((n, s) => n + s.tableCount, 0) ?? 0;
      setResult(
        `Imported project "${data?.projectName ?? ""}" — ${data?.versionCount ?? 0} versions, ${totalTables} total tables.`,
      );
      setPFile(null);
      setPPreview(null);
      setError("");
    },
    onError: (err) => { setError(err.message); setResult(""); },
  });

  const handleVersionFile = (name: string, content: string) => {
    setError(""); setResult(""); setVParseError("");
    try {
      const preview = parsePicklePreview(content);
      if (preview.type !== "version") {
        setVParseError("This is a Project pickle. Switch to the 'Import Project' tab.");
        return;
      }
      setVFile({ name, content });
      setVPreview(preview);
      setVProjectName(preview.sourceProjectName);
      setVVersionName(todayVersionName());
    } catch (err) {
      setVParseError(err instanceof Error ? err.message : "Could not parse file.");
    }
  };

  const handleProjectFile = (name: string, content: string) => {
    setError(""); setResult(""); setPParseError("");
    try {
      const preview = parsePicklePreview(content);
      if (preview.type !== "project") {
        setPParseError("This is a Version pickle. Switch to the 'Import Version' tab.");
        return;
      }
      setPFile({ name, content });
      setPPreview(preview);
      setPProjectName(preview.sourceProjectName);
    } catch (err) {
      setPParseError(err instanceof Error ? err.message : "Could not parse file.");
    }
  };

  const runVersionImport = () => {
    if (!vFile) return;
    setError(""); setResult("");
    importVersionMutation.mutate({
      content: vFile.content,
      projectName: vProjectName || undefined,
      versionName: vVersionName || undefined,
    });
  };

  const runProjectImport = () => {
    if (!pFile) return;
    setError(""); setResult("");
    importProjectMutation.mutate({
      content: pFile.content,
      projectName: pProjectName || undefined,
    });
  };

  const vCanImport =
    !!vFile && !importVersionMutation.isPending && vProjectName.trim().length >= 8;

  const pCanImport =
    !!pFile && !importProjectMutation.isPending && pProjectName.trim().length >= 8;

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Main Window</p>
          <h3 className="mt-1 text-xl font-semibold text-slate-950">Imports workspace</h3>
        </div>

        {/* Tab selector */}
        <div className="flex border-b border-slate-200">
          {(["version", "project"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => { setMode(tab); setError(""); setResult(""); }}
              className={classNames(
                "flex-1 px-4 py-3 text-sm font-semibold transition",
                mode === tab
                  ? "border-b-2 border-lime-600 text-lime-700"
                  : "text-slate-500 hover:text-slate-700",
              )}
            >
              {tab === "version" ? "Import Version" : "Import Project"}
            </button>
          ))}
        </div>

        <div className="p-5">
          {/* Feedback */}
          {error ? (
            <div className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
              {error}
            </div>
          ) : null}
          {result ? (
            <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
              {result}
            </div>
          ) : null}

          {/* Version import tab */}
          {mode === "version" ? (
            <div className="space-y-4">
              {!vFile ? (
                <>
                  <DropZone
                    accept=".json"
                    onFile={handleVersionFile}
                    label="Select a Version pickle file"
                  />
                  {vParseError ? (
                    <p className="text-sm font-medium text-rose-600">{vParseError}</p>
                  ) : null}
                </>
              ) : (
                <>
                  {/* File preview */}
                  <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-md bg-indigo-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-indigo-700">
                            Version Pickle
                          </span>
                          <ProviderBadge provider={vPreview?.provider ?? ""} />
                        </div>
                        <p className="mt-1.5 text-sm font-semibold text-slate-800 truncate max-w-xs">
                          {vFile.name}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          From <span className="font-semibold">{vPreview?.sourceProjectName}</span>
                          {vPreview?.exportedAt
                            ? ` · ${new Date(vPreview.exportedAt).toLocaleString()}`
                            : ""}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => { setVFile(null); setVPreview(null); setVParseError(""); }}
                        className="shrink-0 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-100"
                      >
                        Change
                      </button>
                    </div>

                    {vPreview?.versions[0] ? (
                      <div className="mt-3">
                        <VersionPreviewCard stats={vPreview.versions[0]} />
                      </div>
                    ) : null}
                  </div>

                  {/* Import options */}
                  <div className="rounded-xl border border-slate-200 p-4 space-y-3">
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Import Options</p>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                          New project name <span className="text-slate-400 font-normal">(min 8 chars)</span>
                        </label>
                        <input
                          value={vProjectName}
                          onChange={(e) => setVProjectName(e.target.value)}
                          placeholder="My Imported Project"
                          className="h-9 w-full rounded-md border border-slate-300 bg-white px-2.5 text-sm font-medium text-slate-700 outline-none placeholder:text-slate-400 focus:border-lime-500"
                        />
                      </div>

                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                          Version name
                        </label>
                        <input
                          value={vVersionName}
                          onChange={(e) => setVVersionName(e.target.value)}
                          placeholder={vPreview?.versions[0]?.name ?? "1.0111"}
                          className="h-9 w-full rounded-md border border-slate-300 bg-white px-2.5 text-sm font-medium text-slate-700 outline-none placeholder:text-slate-400 focus:border-lime-500"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={runVersionImport}
                      disabled={!vCanImport}
                      className="h-9 rounded-md bg-lime-600 px-5 text-sm font-semibold text-white transition hover:bg-lime-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      {importVersionMutation.isPending ? "Importing..." : "Import Version"}
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : null}

          {/* Project import tab */}
          {mode === "project" ? (
            <div className="space-y-4">
              {!pFile ? (
                <>
                  <DropZone
                    accept=".json"
                    onFile={handleProjectFile}
                    label="Select a Project pickle file"
                  />
                  {pParseError ? (
                    <p className="text-sm font-medium text-rose-600">{pParseError}</p>
                  ) : null}
                </>
              ) : (
                <>
                  {/* File preview */}
                  <div className="rounded-xl border border-orange-100 bg-orange-50/60 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-md bg-orange-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-orange-700">
                            Project Pickle
                          </span>
                          <ProviderBadge provider={pPreview?.provider ?? ""} />
                          <span className="text-xs font-medium text-slate-500">
                            {pPreview?.versionCount ?? 0} version{(pPreview?.versionCount ?? 0) !== 1 ? "s" : ""}
                          </span>
                        </div>
                        <p className="mt-1.5 text-sm font-semibold text-slate-800 truncate max-w-xs">
                          {pFile.name}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          From <span className="font-semibold">{pPreview?.sourceProjectName}</span>
                          {pPreview?.exportedAt
                            ? ` · ${new Date(pPreview.exportedAt).toLocaleString()}`
                            : ""}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => { setPFile(null); setPPreview(null); setPParseError(""); }}
                        className="shrink-0 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-100"
                      >
                        Change
                      </button>
                    </div>

                    {pPreview && pPreview.versions.length > 0 ? (
                      <div className="mt-3 space-y-1.5">
                        {pPreview.versions.map((v) => (
                          <VersionPreviewCard key={v.name} stats={v} />
                        ))}
                      </div>
                    ) : null}
                  </div>

                  {/* Import options */}
                  <div className="rounded-xl border border-slate-200 p-4 space-y-3">
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Import Options</p>

                    <div className="max-w-sm">
                      <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                        Project name <span className="text-slate-400 font-normal">(min 8 chars)</span>
                      </label>
                      <input
                        value={pProjectName}
                        onChange={(e) => setPProjectName(e.target.value)}
                        placeholder={pPreview?.sourceProjectName ?? "Project name"}
                        className="h-9 w-full rounded-md border border-slate-300 bg-white px-2.5 text-sm font-medium text-slate-700 outline-none placeholder:text-slate-400 focus:border-lime-500"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={runProjectImport}
                      disabled={!pCanImport}
                      className="h-9 rounded-md bg-lime-600 px-5 text-sm font-semibold text-white transition hover:bg-lime-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      {importProjectMutation.isPending ? "Importing..." : "Import Project"}
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : null}
        </div>
      </section>

      {/* Format reference */}
      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">File Format</p>
          <h3 className="mt-1 text-base font-semibold text-slate-950">Accepted pickle types</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-indigo-100 bg-indigo-50/50 p-3">
              <span className="text-xs font-bold uppercase tracking-wide text-indigo-600">Version Pickle</span>
              <p className="mt-1 text-sm text-slate-600">
                A snapshot of a single project version — tables, fields, relations, restrictions and enums.
                Generated from <strong>Exports → Version Pickle</strong>.
              </p>
            </div>
            <div className="rounded-lg border border-orange-100 bg-orange-50/50 p-3">
              <span className="text-xs font-bold uppercase tracking-wide text-orange-600">Project Pickle</span>
              <p className="mt-1 text-sm text-slate-600">
                A full project backup containing every version.
                Generated from <strong>Exports → Project Pickle</strong>.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
