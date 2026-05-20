"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { IconCopy, IconCheck, IconX, IconDownload, IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { useTRPC } from "@/trpc/client";
import { classNames } from "../shared/dashboard-data";
import { useProjectInfo } from "../shared/project-info-context";

// ─── syntax highlighter ───────────────────────────────────────────────────────

const TS_KEYWORDS = new Set([
  "import", "export", "from", "const", "let", "var", "function", "return",
  "type", "interface", "extends", "as", "if", "else", "for", "while",
  "true", "false", "null", "undefined", "new", "class", "static",
]);

const TS_TYPES = new Set([
  "string", "number", "boolean", "void", "never", "unknown", "object",
  "any", "bigint",
]);

const PRISMA_KEYWORDS = new Set([
  "model", "datasource", "generator", "enum", "type",
]);

const PRISMA_TYPES = new Set([
  "String", "Int", "BigInt", "Float", "Decimal", "Boolean",
  "DateTime", "Bytes", "Json",
]);

function highlightCode(code: string, lang: "ts" | "prisma"): React.ReactNode {
  const keywords = lang === "prisma" ? PRISMA_KEYWORDS : TS_KEYWORDS;
  const types = lang === "prisma" ? PRISMA_TYPES : TS_TYPES;

  return code.split("\n").map((line, lineIndex) => {
    const parts: React.ReactNode[] = [];
    const tokens: { start: number; end: number; kind: string; text: string }[] = [];

    let match: RegExpExecArray | null;

    // Strings
    const stringRe = /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/g;
    while ((match = stringRe.exec(line)) !== null) {
      tokens.push({ start: match.index, end: match.index + match[0].length, kind: "string", text: match[0] });
    }

    // Comments
    const commentRe = /(\/\/.*$)/g;
    while ((match = commentRe.exec(line)) !== null) {
      tokens.push({ start: match.index, end: match.index + match[0].length, kind: "comment", text: match[0] });
    }

    // Prisma @attributes
    if (lang === "prisma") {
      const attrRe = /(@{1,2}[a-zA-Z_][a-zA-Z0-9_]*)/g;
      while ((match = attrRe.exec(line)) !== null) {
        tokens.push({ start: match.index, end: match.index + match[0].length, kind: "attribute", text: match[0] });
      }
    }

    // Words (keywords / types)
    const wordRe = /\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g;
    while ((match = wordRe.exec(line)) !== null) {
      const word = match[1];
      if (keywords.has(word)) {
        tokens.push({ start: match.index, end: match.index + word.length, kind: "keyword", text: word });
      } else if (types.has(word)) {
        tokens.push({ start: match.index, end: match.index + word.length, kind: "type", text: word });
      }
    }

    // Sort, deduplicate overlapping tokens (first wins)
    tokens.sort((a, b) => a.start - b.start);
    const dedupedTokens: typeof tokens = [];
    let cursor = 0;
    for (const token of tokens) {
      if (token.start >= cursor) {
        dedupedTokens.push(token);
        cursor = token.end;
      }
    }

    let lastIndex = 0;
    for (const token of dedupedTokens) {
      if (token.start > lastIndex) {
        parts.push(<span key={`t-${lastIndex}`}>{line.slice(lastIndex, token.start)}</span>);
      }
      const cls =
        token.kind === "keyword" ? "text-purple-600 font-semibold"
        : token.kind === "type" ? "text-blue-600 font-semibold"
        : token.kind === "string" ? "text-green-600"
        : token.kind === "attribute" ? "text-rose-500 font-semibold"
        : token.kind === "comment" ? "text-slate-400 italic"
        : "";
      parts.push(<span key={`t-${token.start}`} className={cls}>{token.text}</span>);
      lastIndex = token.end;
    }

    if (lastIndex < line.length) {
      parts.push(<span key="t-end">{line.slice(lastIndex)}</span>);
    }

    return (
      <div key={lineIndex} className="leading-6">
        <span className="mr-4 select-none text-slate-400">
          {String(lineIndex + 1).padStart(3, " ")}
        </span>
        {parts.length > 0 ? parts : <span>&nbsp;</span>}
      </div>
    );
  });
}

// ─── types ────────────────────────────────────────────────────────────────────

type ExportType = "prisma" | "drizzle" | "pickle-version" | "pickle-project";

type ExportResponse = {
  code?: string;
  fileName?: string;
  tableCount?: number;
  enumCount?: number;
  error?: string;
};

type DialogState = {
  exportId: string;
  code: string;
  fileName: string;
  lang: "ts" | "prisma";
  tableCount: number;
  enumCount: number;
};

// ─── export option cards ──────────────────────────────────────────────────────

const EXPORT_OPTIONS: Array<{
  type: ExportType;
  label: string;
  fileLabel: string;
  description: string;
  accent: string;
  badgeClass: string;
}> = [
  {
    type: "prisma",
    label: "Prisma Schema",
    fileLabel: ".prisma",
    description:
      "Export the generated Prisma schema for the selected project version. Includes datasource, generator, models, relations, and constraints.",
    accent: "border-blue-200 bg-blue-50",
    badgeClass: "bg-blue-100 text-blue-700",
  },
  {
    type: "drizzle",
    label: "Drizzle TypeScript",
    fileLabel: ".ts",
    description:
      "Generate a Drizzle ORM TypeScript schema from the canonical model. Includes table definitions, column types, foreign key references, and index helpers.",
    accent: "border-emerald-200 bg-emerald-50",
    badgeClass: "bg-emerald-100 text-emerald-700",
  },
  {
    type: "pickle-version",
    label: "Version Pickle",
    fileLabel: ".json",
    description:
      "Download a full JSON backup of the current version's schema — tables, fields, relations, restrictions, and enums. Downloads directly as a file.",
    accent: "border-amber-200 bg-amber-50",
    badgeClass: "bg-amber-100 text-amber-700",
  },
  {
    type: "pickle-project",
    label: "Project Pickle",
    fileLabel: ".json",
    description:
      "Download a full JSON backup of all versions in this project. Every schema version's complete graph in one file.",
    accent: "border-orange-200 bg-orange-50",
    badgeClass: "bg-orange-100 text-orange-700",
  },
];

// ─── component ────────────────────────────────────────────────────────────────

export function ExportsPageContent() {
  const { projectName, version, hasProject } = useProjectInfo();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [exportError, setExportError] = useState("");
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [copied, setCopied] = useState(false);
  const [activeExportType, setActiveExportType] = useState<ExportType | null>(null);
  const [pendingPickle, setPendingPickle] = useState<ExportType | null>(null);
  const [resetConfirm, setResetConfirm] = useState(false);

  const historyQuery = useQuery(
    trpc.exports.list.queryOptions(
      { projectName: projectName ?? "" },
      { enabled: !!projectName },
    ),
  );

  const exportMutation = useMutation({
    ...trpc.exports.generate.mutationOptions(),
    onSuccess: (data, vars) => {
      const type = vars.type;

      if (type === "pickle-version" || type === "pickle-project") {
        const blob = new Blob([(data as { code?: string } | undefined)?.code ?? ""], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = (data as { fileName?: string } | undefined)?.fileName ?? "export.pickle.json";
        a.click();
        URL.revokeObjectURL(url);
        setActiveExportType(null);
        return;
      }

      setDialog({
        exportId: (data as { id?: string } | undefined)?.id ?? "",
        code: (data as { code?: string } | undefined)?.code ?? "",
        fileName: (data as { fileName?: string } | undefined)?.fileName ?? (type === "prisma" ? `${version}.prisma` : "schema.ts"),
        lang: type === "prisma" ? "prisma" : "ts",
        tableCount: (data as { tableCount?: number } | undefined)?.tableCount ?? 0,
        enumCount: (data as { enumCount?: number } | undefined)?.enumCount ?? 0,
      });
      setActiveExportType(null);
    },
    onError: (err) => { setExportError(err.message); setActiveExportType(null); },
  });

  const resetMutation = useMutation({
    ...trpc.exports.reset.mutationOptions(),
    onSuccess: () => {
      setResetConfirm(false);
      queryClient.invalidateQueries({ queryKey: trpc.exports.list.queryOptions({ projectName: projectName ?? "" }).queryKey });
    },
  });

  const markDownloadedMutation = useMutation({
    ...trpc.exports.markDownloaded.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trpc.exports.list.queryOptions({ projectName: projectName ?? "" }).queryKey });
    },
  });

  const handleExport = (type: ExportType) => {
    if (!projectName || !version) return;
    if (type === "pickle-version" || type === "pickle-project") {
      setPendingPickle(type);
      return;
    }
    setActiveExportType(type);
    setExportError("");
    exportMutation.mutate({ projectName, version, type });
  };

  const confirmPickle = () => {
    if (!pendingPickle || !projectName || !version) return;
    const type = pendingPickle;
    setPendingPickle(null);
    setActiveExportType(type);
    setExportError("");
    exportMutation.mutate({ projectName, version, type });
  };

  const handleCopy = async () => {
    if (!dialog) return;
    try {
      await navigator.clipboard.writeText(dialog.code);
    } catch {
      const el = document.createElement("textarea");
      el.value = dialog.code;
      el.style.cssText = "position:fixed;opacity:0";
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const closeDialog = () => {
    setDialog(null);
    setCopied(false);
  };

  const handleDownload = () => {
    if (!dialog) return;
    const blob = new Blob([dialog.code], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = dialog.fileName;
    a.click();
    URL.revokeObjectURL(url);
    if (dialog.exportId) {
      markDownloadedMutation.mutate({ id: dialog.exportId });
    }
  };

  const PAGE_SIZE = 5;
  const [historyPage, setHistoryPage] = useState(0);
  const [trackedProject, setTrackedProject] = useState(projectName);
  if (trackedProject !== projectName) {
    setTrackedProject(projectName);
    setHistoryPage(0);
    setResetConfirm(false);
  }

  if (!hasProject) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-8 text-center">
        <p className="text-slate-600">Select a project to export schemas.</p>
      </div>
    );
  }

  const exportHistory = historyQuery.data ?? [];
  const totalPages = Math.max(1, Math.ceil(exportHistory.length / PAGE_SIZE));
  const safePage = Math.min(historyPage, totalPages - 1);
  const pageRows = exportHistory.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  return (
    <div className="space-y-5">

      {/* Export history */}
      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Download History
              </p>
              <h3 className="mt-1 text-base font-semibold text-slate-950">
                Exported Schemas
              </h3>
            </div>
            {exportHistory.length > 0 ? (
              <div className="flex items-center gap-2">
                {resetConfirm ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setResetConfirm(false)}
                      className="h-8 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => resetMutation.mutate({ projectName: projectName ?? "" })}
                      disabled={resetMutation.isPending}
                      className="h-8 rounded-md bg-rose-600 px-3 text-xs font-semibold text-white transition hover:bg-rose-700 disabled:opacity-60"
                    >
                      {resetMutation.isPending ? "Clearing…" : "Yes, clear all"}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setResetConfirm(true)}
                    className="h-8 rounded-md border border-rose-200 bg-rose-50 px-3 text-xs font-semibold text-rose-600 transition hover:bg-rose-100"
                  >
                    Reset
                  </button>
                )}
              </div>
            ) : null}
          </div>
        </div>

        {exportHistory.length === 0 ? (
          <div className="px-5 py-6 text-center">
            <p className="text-sm text-slate-400">No exports yet for this project.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-left">
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    File
                  </th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Type
                  </th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Version
                  </th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Downloaded
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pageRows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/50">
                    <td className="px-5 py-3 font-mono text-xs">
                      <span className="text-slate-400">~/Downloads/</span>
                      <span className="font-semibold text-slate-800">{row.file_name}</span>
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={classNames(
                          "rounded px-2 py-0.5 text-[11px] font-bold",
                          row.export_type === "prisma"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-emerald-100 text-emerald-700",
                        )}
                      >
                        {row.export_type === "prisma" ? "Prisma" : "Drizzle"}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-slate-600">
                      {row.version}
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-500">
                      {new Date(row.exported_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {totalPages > 1 ? (
              <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3">
                <p className="text-xs text-slate-500">
                  {exportHistory.length} {exportHistory.length === 1 ? "export" : "exports"} total
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setHistoryPage((p) => Math.max(0, p - 1))}
                    disabled={safePage === 0}
                    className="flex h-7 w-7 items-center justify-center rounded border border-slate-200 text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <IconChevronLeft size={14} />
                  </button>
                  <span className="min-w-[3rem] text-center text-xs font-semibold text-slate-700">
                    {safePage + 1} / {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setHistoryPage((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={safePage === totalPages - 1}
                    className="flex h-7 w-7 items-center justify-center rounded border border-slate-200 text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <IconChevronRight size={14} />
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        {/* Header */}
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Main Window
              </p>
              <h3 className="mt-1 text-xl font-semibold text-slate-950">
                Exports workspace
              </h3>
            </div>
            <span className="w-fit rounded-md border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">
              {projectName} – {version}
            </span>
          </div>
        </div>

        {/* Export cards */}
        <div className="p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            {EXPORT_OPTIONS.map((opt) => {
              const isLoading = activeExportType === opt.type;
              const isDisabled = activeExportType !== null;

              return (
                <div
                  key={opt.type}
                  className={classNames(
                    "rounded-lg border p-5 transition",
                    opt.accent,
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-base font-semibold text-slate-950">
                          {opt.label}
                        </h4>
                        <span
                          className={classNames(
                            "rounded px-2 py-0.5 text-[11px] font-bold",
                            opt.badgeClass,
                          )}
                        >
                          {opt.fileLabel}
                        </span>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        {opt.description}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleExport(opt.type)}
                    disabled={isDisabled}
                    className={classNames(
                      "mt-4 h-10 min-w-32 rounded-md px-5 text-sm font-semibold text-white shadow-sm transition",
                      opt.type === "prisma"
                        ? "bg-blue-600 hover:bg-blue-700"
                        : opt.type === "drizzle"
                          ? "bg-emerald-600 hover:bg-emerald-700"
                          : opt.type === "pickle-version"
                            ? "bg-amber-500 hover:bg-amber-600"
                            : "bg-orange-500 hover:bg-orange-600",
                      isDisabled ? "cursor-not-allowed bg-slate-300 hover:bg-slate-300" : "",
                    )}
                  >
                    {isLoading
                      ? "Loading..."
                      : opt.type === "pickle-version" || opt.type === "pickle-project"
                        ? "Download"
                        : "Export"}
                  </button>
                </div>
              );
            })}
          </div>

          {exportError ? (
            <p className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
              {exportError}
            </p>
          ) : null}
        </div>
      </section>

      {/* Dialog */}
      {dialog ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-3">
          <div className="max-h-[92vh] w-[96vw] max-w-[1400px] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl flex flex-col">
            {/* Dialog header */}
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 shrink-0">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Exported Code
                </p>
                <h3 className="mt-1 text-lg font-semibold text-slate-950">
                  {dialog.fileName}
                </h3>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {dialog.lang === "ts" ? (
                    <>
                      <span className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
                        {dialog.tableCount} {dialog.tableCount === 1 ? "table" : "tables"}
                      </span>
                      {dialog.enumCount > 0 ? (
                        <span className="rounded-md bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-700">
                          {dialog.enumCount} {dialog.enumCount === 1 ? "enum" : "enums"}
                        </span>
                      ) : null}
                    </>
                  ) : (
                    <span className="rounded-md bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">
                      Prisma Schema
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleCopy()}
                  title={copied ? "Copied!" : "Copy to clipboard"}
                  className={classNames(
                    "flex h-9 w-9 items-center justify-center rounded-md border transition",
                    copied
                      ? "border-emerald-300 bg-emerald-50 text-emerald-600"
                      : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
                  )}
                >
                  {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
                </button>
                <button
                  type="button"
                  onClick={handleDownload}
                  title="Download file"
                  className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 transition hover:bg-slate-50"
                >
                  <IconDownload size={16} />
                </button>
                <button
                  type="button"
                  onClick={closeDialog}
                  title="Close"
                  className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 transition hover:bg-slate-50"
                >
                  <IconX size={16} />
                </button>
              </div>
            </div>

            {/* Code body */}
            <div className="flex-1 overflow-y-auto p-5">
              <div className="min-w-max rounded-md border border-slate-200 bg-white px-4 py-4 font-mono text-xs">
                {highlightCode(dialog.code, dialog.lang)}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Pickle confirmation dialog */}
      {pendingPickle ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-3">
          <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white shadow-2xl">
            <div className="border-b border-slate-200 px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Confirm Export
              </p>
              <h3 className="mt-1 text-base font-semibold text-slate-950">
                {pendingPickle === "pickle-version" ? "Version Pickle" : "Project Pickle"}
              </h3>
            </div>
            <div className="px-5 py-4">
              <p className="text-sm leading-6 text-slate-600">
                {pendingPickle === "pickle-version" ? (
                  <>
                    You are about to pickle out{" "}
                    <span className="font-semibold text-slate-950">{version}</span>.
                    Are you sure?
                  </>
                ) : (
                  <>
                    You are about to pickle out all versions in{" "}
                    <span className="font-semibold text-slate-950">{projectName}</span>.
                    Are you sure?
                  </>
                )}
              </p>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3">
              <button
                type="button"
                onClick={() => setPendingPickle(null)}
                className="h-9 rounded-md border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmPickle}
                className={classNames(
                  "h-9 rounded-md px-4 text-xs font-semibold text-white shadow-sm transition",
                  pendingPickle === "pickle-version"
                    ? "bg-amber-500 hover:bg-amber-600"
                    : "bg-orange-500 hover:bg-orange-600",
                )}
              >
                Yes, download
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
