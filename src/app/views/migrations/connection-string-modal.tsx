"use client";

import { IconCheck, IconCopy, IconX } from "@tabler/icons-react";
import { classNames } from "../shared/dashboard-data";

type ConnectionStringModalProps = {
  isOpen: boolean;
  connStringValue: string;
  connStringORM: "prisma" | "drizzle" | "custom";
  connStringEnvName: string;
  connStringCopied: boolean;
  onClose: () => void;
  onOrmChange: (orm: "prisma" | "drizzle" | "custom") => void;
  onEnvNameChange: (v: string) => void;
  onValueChange: (v: string) => void;
  onCopy: () => void;
};

export function ConnectionStringModal({
  isOpen, connStringValue, connStringORM, connStringEnvName, connStringCopied,
  onClose, onOrmChange, onEnvNameChange, onValueChange, onCopy,
}: ConnectionStringModalProps) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div className="flex w-full max-w-5xl flex-col rounded-lg border border-slate-200 bg-white shadow-2xl">
        <div className="relative border-b border-slate-200 px-6 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Reference</p>
          <h3 className="mt-0.5 text-lg font-semibold text-slate-950">Connection String</h3>
          <p className="mt-0.5 text-xs text-slate-500">Copy this into your project&apos;s <span className="font-mono">.env</span> file.</p>
          <button type="button" onClick={onClose}
            className="absolute right-4 top-4 rounded p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
            <IconX size={18} stroke={1.5} />
          </button>
        </div>

        <div className="space-y-4 p-6">
          <div>
            <p className="mb-1.5 text-xs font-semibold text-slate-700">ORM / Format</p>
            <div className="flex gap-2">
              {(["prisma", "drizzle", "custom"] as const).map((orm) => (
                <button key={orm} type="button" onClick={() => onOrmChange(orm)}
                  className={classNames("h-8 rounded-md border px-3 text-xs font-semibold capitalize transition",
                    connStringORM === orm ? "border-slate-800 bg-slate-800 text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50")}>
                  {orm}
                </button>
              ))}
            </div>
          </div>

          {connStringORM === "custom" && (
            <div>
              <p className="mb-1 text-xs font-semibold text-slate-700">Environment Variable Name</p>
              <input value={connStringEnvName} onChange={(e) => onEnvNameChange(e.target.value)}
                placeholder="DATABASE_URL"
                className="h-8 w-full rounded-md border border-slate-300 bg-white px-3 font-mono text-xs text-slate-800 focus:border-slate-500 focus:outline-none"
              />
            </div>
          )}

          <div>
            <p className="mb-1 text-xs font-semibold text-slate-700">Connection String</p>
            <div className="flex items-center gap-2">
              <input value={connStringValue} onChange={(e) => onValueChange(e.target.value)}
                spellCheck={false}
                className="h-9 min-w-0 flex-1 rounded-md border border-slate-300 bg-slate-50 px-3 font-mono text-xs text-slate-800 focus:border-slate-500 focus:bg-white focus:outline-none"
              />
              <button type="button" onClick={onCopy} title="Copy to clipboard"
                className="shrink-0 rounded p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
                {connStringCopied
                  ? <IconCheck size={16} stroke={2.5} className="text-emerald-600" />
                  : <IconCopy size={16} stroke={1.5} />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
