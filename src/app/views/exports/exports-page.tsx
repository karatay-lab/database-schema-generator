"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { IconCopy, IconCheck, IconX, IconDownload, IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { useTRPC } from "@/trpc/client";
import { classNames } from "../shared/dashboard-data";
import { useProjectInfo } from "../shared/project-info-context";
import { EXPORT_OPTIONS, type ExportType } from "@/constants/exports";
import { ExportedCodeDialog } from "./exported-code-dialog";
import { PickleConfirmDialog } from "./pickle-confirm-dialog";

// ─── types ────────────────────────────────────────────────────────────────────

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

      <ExportedCodeDialog
        dialog={dialog}
        copied={copied}
        onCopy={() => void handleCopy()}
        onDownload={handleDownload}
        onClose={closeDialog}
      />

      <PickleConfirmDialog
        pendingPickle={pendingPickle}
        version={version ?? ""}
        projectName={projectName ?? ""}
        onConfirm={confirmPickle}
        onCancel={() => setPendingPickle(null)}
      />
    </div>
  );
}
