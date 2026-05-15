"use client";

import { useState } from "react";
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

type ExportType = "prisma" | "drizzle";

type ExportResponse = {
  code?: string;
  fileName?: string;
  tableCount?: number;
  enumCount?: number;
  error?: string;
};

type DialogState = {
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
];

// ─── component ────────────────────────────────────────────────────────────────

export function ExportsPageContent() {
  const { projectName, version, hasProject } = useProjectInfo();

  const [exporting, setExporting] = useState<ExportType | null>(null);
  const [exportError, setExportError] = useState("");
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [copied, setCopied] = useState(false);

  const handleExport = async (type: ExportType) => {
    if (!projectName || !version) return;

    setExporting(type);
    setExportError("");

    try {
      const params = new URLSearchParams({ projectName, version, type });
      const response = await fetch(`/api/exports?${params}`);
      const data: ExportResponse = await response.json();

      if (!response.ok || data.error) {
        throw new Error(data.error ?? "Export failed.");
      }

      setDialog({
        code: data.code ?? "",
        fileName: data.fileName ?? (type === "prisma" ? `${version}.prisma` : "schema.ts"),
        lang: type === "prisma" ? "prisma" : "ts",
        tableCount: data.tableCount ?? 0,
        enumCount: data.enumCount ?? 0,
      });
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Export failed.");
    } finally {
      setExporting(null);
    }
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

  if (!hasProject) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-8 text-center">
        <p className="text-slate-600">Select a project to export schemas.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
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
              const isLoading = exporting === opt.type;
              const isDisabled = exporting !== null;

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
                    onClick={() => void handleExport(opt.type)}
                    disabled={isDisabled}
                    className={classNames(
                      "mt-4 h-10 min-w-32 rounded-md px-5 text-sm font-semibold text-white shadow-sm transition",
                      opt.type === "prisma"
                        ? "bg-blue-600 hover:bg-blue-700"
                        : "bg-emerald-600 hover:bg-emerald-700",
                      isDisabled ? "cursor-not-allowed bg-slate-300 hover:bg-slate-300" : "",
                    )}
                  >
                    {isLoading ? "Loading..." : "Export"}
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
                  className="h-9 rounded-md border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
                <button
                  type="button"
                  onClick={closeDialog}
                  className="h-9 rounded-md border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Close
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
    </div>
  );
}
