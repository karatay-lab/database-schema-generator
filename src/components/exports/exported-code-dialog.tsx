"use client";

import { IconCopy, IconCheck, IconX, IconDownload } from "@tabler/icons-react";
import { classNames } from "@/lib/utils";
import { highlightCode } from "@/lib/code-highlighting";

type DialogState = {
  exportId: string;
  code: string;
  fileName: string;
  lang: "ts" | "prisma";
  tableCount: number;
  enumCount: number;
};

type ExportedCodeDialogProps = {
  dialog: DialogState | null;
  copied: boolean;
  onCopy: () => void;
  onDownload: () => void;
  onClose: () => void;
};

export function ExportedCodeDialog({ dialog, copied, onCopy, onDownload, onClose }: ExportedCodeDialogProps) {
  if (!dialog) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-3">
      <div className="flex max-h-[92vh] w-[96vw] max-w-[1400px] flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Exported Code</p>
            <h3 className="mt-1 text-lg font-semibold text-slate-950">{dialog.fileName}</h3>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {dialog.lang === "ts" ? (
                <>
                  <span className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
                    {dialog.tableCount} {dialog.tableCount === 1 ? "table" : "tables"}
                  </span>
                  {dialog.enumCount > 0 && (
                    <span className="rounded-md bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-700">
                      {dialog.enumCount} {dialog.enumCount === 1 ? "enum" : "enums"}
                    </span>
                  )}
                </>
              ) : (
                <span className="rounded-md bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">Prisma Schema</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onCopy}
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
              onClick={onDownload}
              title="Download file"
              className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 transition hover:bg-slate-50"
            >
              <IconDownload size={16} />
            </button>
            <button
              type="button"
              onClick={onClose}
              title="Close"
              className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 transition hover:bg-slate-50"
            >
              <IconX size={16} />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          <div className="min-w-max rounded-md border border-slate-200 bg-white px-4 py-4 font-mono text-xs">
            {highlightCode(dialog.code, dialog.lang)}
          </div>
        </div>
      </div>
    </div>
  );
}
