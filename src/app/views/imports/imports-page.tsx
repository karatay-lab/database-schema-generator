"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { classNames } from "../shared/dashboard-data";
import type { ImportMode, ParsedPreview } from "@/types/imports";
import { todayVersionName, parsePicklePreview } from "@/constants/imports";
import { VersionImportTab } from "./version-import-tab";
import { ProjectImportTab } from "./project-import-tab";

export function ImportsPageContent() {
  const trpc = useTRPC();

  const [mode, setMode] = useState<ImportMode>("version");

  const [vFile, setVFile] = useState<{ name: string; content: string } | null>(null);
  const [vPreview, setVPreview] = useState<ParsedPreview | null>(null);
  const [vParseError, setVParseError] = useState("");
  const [vProjectName, setVProjectName] = useState("");
  const [vVersionName, setVVersionName] = useState("");

  const [pFile, setPFile] = useState<{ name: string; content: string } | null>(null);
  const [pPreview, setPPreview] = useState<ParsedPreview | null>(null);
  const [pParseError, setPParseError] = useState("");
  const [pProjectName, setPProjectName] = useState("");

  const [result, setResult] = useState("");
  const [error, setError] = useState("");

  const importVersionMutation = useMutation({
    ...trpc.imports.importVersion.mutationOptions(),
    onSuccess: (data) => {
      const s = data?.stats;
      setResult(`Imported version "${data?.versionName ?? ""}" — ${s?.tableCount ?? 0} tables, ${s?.fieldCount ?? 0} fields, ${s?.relationCount ?? 0} relations, ${s?.enumCount ?? 0} enums.`);
      setVFile(null); setVPreview(null); setError("");
    },
    onError: (err) => { setError(err.message); setResult(""); },
  });

  const importProjectMutation = useMutation({
    ...trpc.imports.importProject.mutationOptions(),
    onSuccess: (data) => {
      const totalTables = data?.stats?.reduce((n, s) => n + s.tableCount, 0) ?? 0;
      setResult(`Imported project "${data?.projectName ?? ""}" — ${data?.versionCount ?? 0} versions, ${totalTables} total tables.`);
      setPFile(null); setPPreview(null); setError("");
    },
    onError: (err) => { setError(err.message); setResult(""); },
  });

  const handleVersionFile = (name: string, content: string) => {
    setError(""); setResult(""); setVParseError("");
    try {
      const preview = parsePicklePreview(content);
      if (preview.type !== "version") { setVParseError("This is a Project pickle. Switch to the 'Import Project' tab."); return; }
      setVFile({ name, content }); setVPreview(preview);
      setVProjectName(preview.sourceProjectName); setVVersionName(todayVersionName());
    } catch (err) { setVParseError(err instanceof Error ? err.message : "Could not parse file."); }
  };

  const handleProjectFile = (name: string, content: string) => {
    setError(""); setResult(""); setPParseError("");
    try {
      const preview = parsePicklePreview(content);
      if (preview.type !== "project") { setPParseError("This is a Version pickle. Switch to the 'Import Version' tab."); return; }
      setPFile({ name, content }); setPPreview(preview); setPProjectName(preview.sourceProjectName);
    } catch (err) { setPParseError(err instanceof Error ? err.message : "Could not parse file."); }
  };

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Main Window</p>
          <h3 className="mt-1 text-xl font-semibold text-slate-950">Imports workspace</h3>
        </div>

        <div className="flex border-b border-slate-200">
          {(["version", "project"] as const).map((tab) => (
            <button key={tab} type="button" onClick={() => { setMode(tab); setError(""); setResult(""); }}
              className={classNames(
                "flex-1 px-4 py-3 text-sm font-semibold transition",
                mode === tab ? "border-b-2 border-lime-600 text-lime-700" : "text-slate-500 hover:text-slate-700",
              )}
            >
              {tab === "version" ? "Import Version" : "Import Project"}
            </button>
          ))}
        </div>

        <div className="space-y-4 p-5">
          {error && (
            <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{error}</div>
          )}
          {result && (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">{result}</div>
          )}

          {mode === "version" && (
            <VersionImportTab
              file={vFile}
              preview={vPreview}
              parseError={vParseError}
              projectName={vProjectName}
              versionName={vVersionName}
              isImporting={importVersionMutation.isPending}
              canImport={!!vFile && !importVersionMutation.isPending && vProjectName.trim().length >= 8}
              onFileSelect={handleVersionFile}
              onProjectNameChange={setVProjectName}
              onVersionNameChange={setVVersionName}
              onChangeFile={() => { setVFile(null); setVPreview(null); setVParseError(""); }}
              onImport={() => { if (vFile) { setError(""); setResult(""); importVersionMutation.mutate({ content: vFile.content, projectName: vProjectName || undefined, versionName: vVersionName || undefined }); } }}
            />
          )}

          {mode === "project" && (
            <ProjectImportTab
              file={pFile}
              preview={pPreview}
              parseError={pParseError}
              projectName={pProjectName}
              isImporting={importProjectMutation.isPending}
              canImport={!!pFile && !importProjectMutation.isPending && pProjectName.trim().length >= 8}
              onFileSelect={handleProjectFile}
              onProjectNameChange={setPProjectName}
              onChangeFile={() => { setPFile(null); setPPreview(null); setPParseError(""); }}
              onImport={() => { if (pFile) { setError(""); setResult(""); importProjectMutation.mutate({ content: pFile.content, projectName: pProjectName || undefined }); } }}
            />
          )}
        </div>
      </section>

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
