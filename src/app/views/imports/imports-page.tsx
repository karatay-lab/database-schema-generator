"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import type { Project } from "../shared/dashboard-data";
import { classNames } from "../shared/dashboard-data";
import type {
  SchemaImportFile,
  SchemaImportGroup,
} from "@/lib/schema-imports-store";

type MatchDraft = {
  mode: "existing" | "new";
  projectId: string;
  projectName: string;
};

type PendingMatchState = {
  file: SchemaImportFile;
  project: Project;
  versionMode: "new" | "replace";
  replaceVersion: string;
};

const emptyDraft: MatchDraft = {
  mode: "existing",
  projectId: "",
  projectName: "",
};

export function ImportsPageContent() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [drafts, setDrafts] = useState<Record<string, MatchDraft>>({});
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [syncingKey, setSyncingKey] = useState("");
  const [matchingKey, setMatchingKey] = useState("");
  const [pendingMatch, setPendingMatch] = useState<PendingMatchState | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const listQuery = useQuery(trpc.imports.list.queryOptions());
  const groups: SchemaImportGroup[] = listQuery.data?.groups ?? [];
  const projects: Project[] = (listQuery.data as { projects?: Project[] } | undefined)?.projects ?? [];

  const invalidateImports = () => queryClient.invalidateQueries({ queryKey: trpc.imports.list.queryOptions().queryKey });

  const uploadMutation = useMutation({
    ...trpc.imports.upload.mutationOptions(),
    onSuccess: () => { void invalidateImports(); setSelectedFiles([]); setMessage("Imported schema file queued."); },
    onError: (err) => setError(err.message),
  });
  const matchMutation = useMutation({
    ...trpc.imports.match.mutationOptions(),
    onSuccess: (data) => {
      void invalidateImports();
      const result = (data as { result?: { version?: string; sync?: { tableCount: number; fieldCount: number; relationCount: number } } } | undefined)?.result;
      const summary = result?.sync ? `${result.sync.tableCount} tables / ${result.sync.fieldCount} fields / ${result.sync.relationCount} relations` : "";
      setMessage(`Matched import as ${result?.version ?? "new version"}${summary ? ` (${summary})` : ""}.`);
      setMatchingKey("");
    },
    onError: (err) => { setError(err.message); setMatchingKey(""); },
  });
  const syncMutation = useMutation({
    ...trpc.imports.sync.mutationOptions(),
    onSuccess: (data, vars) => {
      void invalidateImports();
      const result = (data as { result?: { sync?: { tableCount: number; fieldCount: number; relationCount: number } } } | undefined)?.result;
      const summary = result?.sync ? `${result.sync.tableCount} tables / ${result.sync.fieldCount} fields / ${result.sync.relationCount} relations` : "";
      const fileName = (vars as { version: string }).version;
      setMessage(`Synced ${fileName}${summary ? ` (${summary})` : ""}.`);
      setSyncingKey("");
    },
    onError: (err) => { setError(err.message); setSyncingKey(""); },
  });

  const importedGroup = useMemo(
    () => groups.find((group) => group.kind === "imported"),
    [groups],
  );
  const projectGroups = useMemo(
    () => groups.filter((group) => group.kind === "project"),
    [groups],
  );
  const unmatchedGroups = useMemo(
    () => groups.filter((group) => group.kind === "unmatched"),
    [groups],
  );

  const draftForFile = (fileName: string): MatchDraft => {
    const currentDraft = drafts[fileName];

    return {
      mode: currentDraft?.mode ?? "existing",
      projectId: currentDraft?.projectId || projects[0]?.id || "",
      projectName: currentDraft?.projectName ?? "",
    };
  };

  const updateDraft = (fileName: string, patch: Partial<MatchDraft>) => {
    setDrafts((currentDrafts) => {
      const currentDraft = currentDrafts[fileName] ?? emptyDraft;

      return {
        ...currentDrafts,
        [fileName]: {
          mode: currentDraft.mode,
          projectId: currentDraft.projectId || projects[0]?.id || "",
          projectName: currentDraft.projectName,
          ...patch,
        },
      };
    });
    setError("");
    setMessage("");
  };

  const uploadSchemas = async () => {
    if (selectedFiles.length === 0) { setError("Select at least one Prisma schema file."); return; }
    setError(""); setMessage("");
    const files = await Promise.all(
      selectedFiles.map(async (file) => ({ content: await file.text(), fileName: file.name })),
    );
    uploadMutation.mutate({ files });
  };

  const matchSchema = (file: SchemaImportFile, replaceVersion?: string) => {
    const draft = draftForFile(file.fileName);
    setMatchingKey(file.fileName); setError(""); setMessage("");
    matchMutation.mutate(
      draft.mode === "existing"
        ? { fileName: file.fileName, projectId: draft.projectId, projectName: "", replaceVersion }
        : { fileName: file.fileName, projectId: "", projectName: draft.projectName },
    );
  };

  const syncSchema = (group: SchemaImportGroup, file: SchemaImportFile) => {
    if (!group.projectId) return;
    setSyncingKey(`${group.id}:${file.fileName}`); setError(""); setMessage("");
    syncMutation.mutate({ projectId: group.projectId, version: file.version });
  };

  const confirmPendingMatch = () => {
    if (!pendingMatch) return;
    const { file, versionMode, replaceVersion } = pendingMatch;
    setPendingMatch(null);
    matchSchema(file, versionMode === "replace" ? replaceVersion : undefined);
  };

  const renderAccordion = (group: SchemaImportGroup) => {
    const isOpen = Boolean(openGroups[group.id]);

    return (
      <section
        key={group.id}
        className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"
      >
        <button
          type="button"
          onClick={() =>
            setOpenGroups((currentGroups) => ({
              ...currentGroups,
              [group.id]: !currentGroups[group.id],
            }))
          }
          className="flex w-full items-center justify-between gap-4 bg-slate-50 px-4 py-3 text-left transition hover:bg-slate-100"
        >
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-slate-950">
              {group.label}
            </span>
            <span className="text-xs font-medium text-slate-500">
              {group.files.length} Prisma files
            </span>
          </span>
          <span className="rounded-md bg-white px-2.5 py-1 text-xs font-bold text-slate-600">
            {isOpen ? "Close" : "Open"}
          </span>
        </button>

        {isOpen ? (
          <div className="divide-y divide-slate-100">
            {group.files.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm font-medium text-slate-500">
                No schema files found.
              </p>
            ) : (
              group.files.map((file) =>
                group.kind === "imported"
                  ? renderImportedFile(file)
                  : renderProjectFile(group, file),
              )
            )}
          </div>
        ) : null}
      </section>
    );
  };

  const renderImportedFile = (file: SchemaImportFile) => {
    const draft = draftForFile(file.fileName);
    const canMatch =
      draft.mode === "existing" ? draft.projectId : draft.projectName.trim();

    return (
      <div key={file.fileName} className="grid gap-4 px-4 py-4 xl:grid-cols-[minmax(0,1fr)_2fr]">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-950">
            {file.fileName}
          </p>
          <p className="mt-1 truncate text-xs font-medium text-slate-500">
            {file.relativePath}
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-[140px_minmax(0,1fr)_140px]">
          <select
            value={draft.mode}
            onChange={(event) =>
              updateDraft(file.fileName, {
                mode: event.target.value as MatchDraft["mode"],
              })
            }
            className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-lime-600"
          >
            <option value="existing">Existing</option>
            <option value="new">New project</option>
          </select>

          {draft.mode === "existing" ? (
            <select
              value={draft.projectId}
              onChange={(event) =>
                updateDraft(file.fileName, { projectId: event.target.value })
              }
              className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-lime-600"
            >
              {projects.length === 0 ? (
                <option value="">No projects</option>
              ) : null}
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          ) : (
            <input
              value={draft.projectName}
              onChange={(event) =>
                updateDraft(file.fileName, { projectName: event.target.value })
              }
              placeholder="Imported Project"
              className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 outline-none placeholder:text-slate-400 focus:border-lime-600"
            />
          )}

          <button
            type="button"
            onClick={() => {
              if (draft.mode === "existing" && draft.projectId) {
                const project = projects.find((p) => p.id === draft.projectId);
                if (project && project.versions.length > 0) {
                  setPendingMatch({
                    file,
                    project,
                    versionMode: "new",
                    replaceVersion: project.versions[project.versions.length - 1]?.name ?? "",
                  });
                  return;
                }
              }
              matchSchema(file);
            }}
            disabled={!canMatch || matchingKey === file.fileName}
            className="h-10 rounded-md bg-lime-600 px-4 text-sm font-semibold text-white transition hover:bg-lime-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {matchingKey === file.fileName ? "Matching..." : "Match"}
          </button>
        </div>
      </div>
    );
  };

  const renderProjectFile = (group: SchemaImportGroup, file: SchemaImportFile) => {
    const syncKey = `${group.id}:${file.fileName}`;
    const canSync = group.kind === "project" && Boolean(group.projectId);

    return (
      <div
        key={`${group.id}:${file.fileName}`}
        className="flex flex-col gap-3 px-4 py-4 lg:flex-row lg:items-center lg:justify-between"
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-semibold text-slate-950">
              {file.fileName}
            </p>
            <span
              className={classNames(
                "rounded-md px-2 py-1 text-xs font-bold",
                file.hasModel
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-amber-50 text-amber-700",
              )}
            >
              {file.hasModel ? "Model exists" : "Needs sync"}
            </span>
          </div>
          <p className="mt-1 truncate text-xs font-medium text-slate-500">
            {file.relativePath}
          </p>
        </div>

        <button
          type="button"
          onClick={() => syncSchema(group, file)}
          disabled={!canSync || syncingKey === syncKey}
          className="h-9 rounded-md border border-lime-300 bg-white px-4 text-sm font-semibold text-lime-700 transition hover:bg-lime-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
        >
          {syncingKey === syncKey ? "Syncing..." : "↻ Sync"}
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Main Window
          </p>
          <h3 className="mt-1 text-xl font-semibold text-slate-950">
            Imports workspace
          </h3>
        </div>

        <div className="p-5">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-950">
                  Upload Prisma schemas
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Uploaded schemas are queued in the database until matched.
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  type="file"
                  accept=".prisma"
                  multiple
                  onChange={(event) =>
                    setSelectedFiles(Array.from(event.target.files ?? []))
                  }
                  className="max-w-80 text-sm font-medium text-slate-600 file:mr-3 file:h-9 file:rounded-md file:border-0 file:bg-white file:px-3 file:text-sm file:font-semibold file:text-slate-700"
                />
                <button
                  type="button"
                  onClick={() => uploadSchemas()}
                  disabled={uploadMutation.isPending || selectedFiles.length === 0}
                  className="h-9 rounded-md bg-lime-600 px-4 text-sm font-semibold text-white transition hover:bg-lime-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {uploadMutation.isPending ? "Uploading..." : "Upload"}
                </button>
              </div>
            </div>
          </div>

          {error ? (
            <p className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
              {error}
            </p>
          ) : null}
          {message ? (
            <p className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
              {message}
            </p>
          ) : null}
        </div>
      </section>

      {listQuery.isLoading ? (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm font-medium text-slate-500">
          Loading imports...
        </div>
      ) : (
        <div className="space-y-3">
          {importedGroup ? renderAccordion(importedGroup) : null}
          {projectGroups.map(renderAccordion)}
          {unmatchedGroups.map(renderAccordion)}
        </div>
      )}

      {pendingMatch ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-slate-950">
              Match to {pendingMatch.project.name}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              This project already has {pendingMatch.project.versions.length} version(s). How should this import be applied?
            </p>

            <div className="mt-4 space-y-2">
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-3 hover:bg-slate-50">
                <input
                  type="radio"
                  name="versionMode"
                  value="new"
                  checked={pendingMatch.versionMode === "new"}
                  onChange={() => setPendingMatch({ ...pendingMatch, versionMode: "new" })}
                  className="mt-0.5"
                />
                <div>
                  <p className="text-sm font-semibold text-slate-800">Add as new version</p>
                  <p className="text-xs text-slate-500">Creates a new timestamped version alongside the existing ones.</p>
                </div>
              </label>

              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-3 hover:bg-slate-50">
                <input
                  type="radio"
                  name="versionMode"
                  value="replace"
                  checked={pendingMatch.versionMode === "replace"}
                  onChange={() => setPendingMatch({ ...pendingMatch, versionMode: "replace" })}
                  className="mt-0.5"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-800">Replace existing version</p>
                  <p className="text-xs text-slate-500">Overwrites the schema and model store for the selected version.</p>
                  {pendingMatch.versionMode === "replace" ? (
                    <select
                      value={pendingMatch.replaceVersion}
                      onChange={(event) =>
                        setPendingMatch({ ...pendingMatch, replaceVersion: event.target.value })
                      }
                      className="mt-2 h-8 w-full rounded border border-slate-300 bg-white px-2 text-xs font-semibold text-slate-700 outline-none focus:border-lime-600"
                    >
                      {pendingMatch.project.versions.map((v) => (
                        <option key={v.name} value={v.name}>
                          {v.name}
                        </option>
                      ))}
                    </select>
                  ) : null}
                </div>
              </label>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingMatch(null)}
                className="h-9 rounded-md border border-slate-200 px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmPendingMatch}
                className="h-9 rounded-md bg-lime-600 px-4 text-sm font-semibold text-white transition hover:bg-lime-700"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
