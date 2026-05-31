"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { StateChip } from "./phase-state";
import { DiffWarningsPanel, computeWarnings, type DiffWarning } from "@/components/migrations/diff-warnings-panel";
import type {
  CompareResponse,
  FieldMatchResult,
  ModelComparisonResult,
  ModelMatchResult,
  PhaseState,
  ZodPairResponse,
} from "@/types/migrations";

type ChangeBadge = "SAME" | "RENAMED" | "MODIFIED" | "ADDED" | "REMOVED" | "RELATION" | "COMMENT";

function Badge({ type }: { type: ChangeBadge }) {
  const map: Record<ChangeBadge, string> = {
    SAME:     "bg-slate-100 text-slate-500",
    RENAMED:  "bg-amber-100 text-amber-700",
    MODIFIED: "bg-blue-100 text-blue-700",
    ADDED:    "bg-emerald-100 text-emerald-700",
    REMOVED:  "bg-rose-100 text-rose-700",
    RELATION: "bg-violet-100 text-violet-700",
    COMMENT:  "bg-sky-100 text-sky-700",
  };
  return (
    <span className={cn("rounded px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase", map[type])}>
      {type}
    </span>
  );
}

function modelBadge(m: ModelMatchResult): ChangeBadge {
  if (!m.hasChanges) return "SAME";
  if (m.nameChanged && m.matchedFields.length === 0 && m.addedFields.length === 0 && m.removedFields.length === 0) return "RENAMED";
  return "MODIFIED";
}

function fieldBadge(f: FieldMatchResult): ChangeBadge {
  if (f.isRelation) return "RELATION";
  if (f.nameChanged && !f.typeChanged && !f.nullabilityChanged && !f.defaultChanged && !f.commentChanged) return "RENAMED";
  if (f.nameChanged || f.typeChanged || f.nullabilityChanged || f.defaultChanged) return "MODIFIED";
  if (f.commentChanged) return "COMMENT";
  return "SAME";
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      strokeWidth={2}
      stroke="currentColor"
      className={cn("h-3.5 w-3.5 shrink-0 transition-transform duration-150", open ? "rotate-90" : "")}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 4l4 4-4 4" />
    </svg>
  );
}

function FieldRow({ field }: { field: FieldMatchResult }) {
  const badge = fieldBadge(field);
  return (
    <div className="grid grid-cols-[8rem_1fr_1fr_minmax(0,1.5fr)_7rem] items-start gap-x-4 px-6 py-2 text-xs hover:bg-slate-50">
      <span className="pt-0.5 font-mono text-[10px] text-slate-400">{field.key.slice(0, 8)}…</span>
      <span className="flex items-center gap-1.5 pt-0.5">
        {field.nameChanged ? (
          <>
            <span className="text-slate-400 line-through">{field.fromName}</span>
            <span className="text-slate-300">→</span>
            <span className="font-semibold text-slate-800">{field.toName}</span>
          </>
        ) : (
          <span className="text-slate-700">{field.toName}</span>
        )}
      </span>
      <span className="flex items-center gap-1.5 pt-0.5">
        {field.typeChanged ? (
          <>
            <span className="text-slate-400 line-through">{field.fromType}</span>
            <span className="text-slate-300">→</span>
            <span className="font-medium text-blue-700">{field.toType}</span>
          </>
        ) : (
          <span className="text-slate-500">{field.toType}</span>
        )}
      </span>
      <span className="pt-0.5">
        {field.commentChanged ? (
          <div className="space-y-0.5">
            {field.fromComment && (
              <p className="truncate italic text-slate-400 line-through">{field.fromComment}</p>
            )}
            {field.toComment && (
              <p className="truncate italic text-sky-700">{field.toComment}</p>
            )}
          </div>
        ) : field.toComment ? (
          <p className="truncate italic text-slate-400">{field.toComment}</p>
        ) : null}
      </span>
      <span className="pt-0.5"><Badge type={badge} /></span>
    </div>
  );
}

function AddedFieldRow({ f }: { f: { key: string; name: string; type: string; nullable: boolean } }) {
  return (
    <div className="grid grid-cols-[8rem_1fr_1fr_minmax(0,1.5fr)_7rem] items-center gap-x-4 px-6 py-2 text-xs">
      <span className="font-mono text-[10px] text-slate-400">{f.key.slice(0, 8)}…</span>
      <span className="font-semibold text-emerald-700">+ {f.name}</span>
      <span className="text-slate-500">{f.type}{f.nullable ? "?" : ""}</span>
      <span />
      <Badge type="ADDED" />
    </div>
  );
}

function RemovedFieldRow({ f }: { f: { key: string; name: string; type: string; nullable: boolean } }) {
  return (
    <div className="grid grid-cols-[8rem_1fr_1fr_minmax(0,1.5fr)_7rem] items-center gap-x-4 px-6 py-2 text-xs">
      <span className="font-mono text-[10px] text-slate-400">{f.key.slice(0, 8)}…</span>
      <span className="text-rose-600 line-through">− {f.name}</span>
      <span className="text-slate-400">{f.type}</span>
      <span />
      <Badge type="REMOVED" />
    </div>
  );
}

function ModelRow({
  model,
  expanded,
  onToggle,
}: {
  model: ModelMatchResult;
  expanded: boolean;
  onToggle: () => void;
}) {
  const badge = modelBadge(model);
  const fieldChangeCount =
    model.addedFields.length +
    model.removedFields.length +
    model.matchedFields.filter(
      (f) => f.nameChanged || f.typeChanged || f.nullabilityChanged || f.defaultChanged || f.commentChanged,
    ).length;

  return (
    <div className="border-b border-slate-100 last:border-0">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-6 py-3 text-left transition hover:bg-slate-50"
      >
        <Chevron open={expanded} />
        <span className="flex-1 font-mono text-sm font-semibold text-slate-800">
          {model.nameChanged ? (
            <>
              <span className="font-normal text-slate-400 line-through">{model.fromName}</span>
              <span className="mx-1.5 text-slate-300">→</span>
              {model.toName}
            </>
          ) : (
            model.toName
          )}
        </span>
        <span className="text-[11px] text-slate-400">
          {model.matchedFields.length + model.addedFields.length + model.removedFields.length} fields
          {fieldChangeCount > 0 && (
            <span className="ml-1 text-blue-600">· {fieldChangeCount} changed</span>
          )}
        </span>
        <Badge type={badge} />
      </button>

      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50/60">
          <div className="grid grid-cols-[8rem_1fr_1fr_minmax(0,1.5fr)_7rem] gap-x-4 border-b border-slate-100 px-6 py-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
            <span>Key</span>
            <span>Field name</span>
            <span>Type</span>
            <span>Comment</span>
            <span>Status</span>
          </div>
          {model.matchedFields
            .filter((f) => f.nameChanged || f.typeChanged || f.nullabilityChanged || f.defaultChanged || f.commentChanged)
            .map((f) => <FieldRow key={f.key} field={f} />)}
          {model.addedFields.map((f) => <AddedFieldRow key={f.key} f={f} />)}
          {model.removedFields.map((f) => <RemovedFieldRow key={f.key} f={f} />)}
          {model.matchedFields.filter((f) => f.nameChanged || f.typeChanged || f.nullabilityChanged || f.defaultChanged || f.commentChanged).length === 0
            && model.addedFields.length === 0
            && model.removedFields.length === 0 && (
            <p className="px-6 py-3 text-xs text-slate-400">Only model name changed.</p>
          )}
        </div>
      )}
    </div>
  );
}

function SummaryBar({ c }: { c: ModelComparisonResult }) {
  const changedCount = c.matchedModels.filter((m) => m.hasChanges).length;
  const sameCount = c.matchedModels.length - changedCount;
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[12px]">
      <span>
        <span className="font-semibold text-slate-800">{c.matchedModels.length}</span>
        <span className="ml-1 text-slate-500">matched</span>
      </span>
      {changedCount > 0 && (
        <span>
          <span className="font-semibold text-blue-700">{changedCount}</span>
          <span className="ml-1 text-slate-500">modified</span>
        </span>
      )}
      {sameCount > 0 && (
        <span>
          <span className="font-semibold text-slate-500">{sameCount}</span>
          <span className="ml-1 text-slate-500">unchanged</span>
        </span>
      )}
      {c.addedModels.length > 0 && (
        <span>
          <span className="font-semibold text-emerald-700">+{c.addedModels.length}</span>
          <span className="ml-1 text-slate-500">added</span>
        </span>
      )}
      {c.removedModels.length > 0 && (
        <span>
          <span className="font-semibold text-rose-700">−{c.removedModels.length}</span>
          <span className="ml-1 text-slate-500">removed</span>
        </span>
      )}
      {c.totalFieldChanges > 0 && (
        <>
          <span className="text-slate-300">·</span>
          <span>
            <span className="font-semibold text-blue-700">{c.totalFieldChanges}</span>
            <span className="ml-1 text-slate-500">field changes</span>
          </span>
        </>
      )}
    </div>
  );
}


export function ModelDiff({
  projectName,
  versions,
  onClose,
  inline = false,
  fromVersion: fromVersionProp,
  toVersion: toVersionProp,
  onZodGenerated,
  onOpenFullScreen,
  onComparisonReady,
}: {
  projectName: string;
  versions: string[];
  onClose?: () => void;
  inline?: boolean;
  fromVersion?: string;
  toVersion?: string;
  onZodGenerated?: () => void;
  onOpenFullScreen?: () => void;
  onComparisonReady?: (comparison: ModelComparisonResult) => void;
}) {
  const fromVersion = fromVersionProp ?? versions[0] ?? "";
  const toVersion   = toVersionProp   ?? versions[1] ?? versions[0] ?? "";

  const [compareState, setCompareState] = useState<PhaseState>("idle");
  const autoCompared = useRef(false);
  const [compareError, setCompareError] = useState("");
  const [comparison, setComparison] = useState<ModelComparisonResult | null>(null);
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  const [zodState, setZodState] = useState<PhaseState>("idle");
  const [zodError, setZodError] = useState("");
  const [zodResult, setZodResult] = useState<ZodPairResponse | null>(null);

  function toggleExpand(key: string) {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function runCompare() {
    setCompareState("loading");
    setCompareError("");
    setComparison(null);
    setExpandedKeys(new Set());
    setZodState("idle");
    setZodResult(null);

    try {
      const params = new URLSearchParams({ projectName, fromVersion, toVersion });
      const res = await fetch(`/api/migrations/compare?${params}`);
      const data: CompareResponse = await res.json();
      if (!data.success || !data.comparison) {
        setCompareState("error");
        setCompareError(data.error ?? "Comparison failed.");
        return;
      }
      setComparison(data.comparison);
      setCompareState("success");
      onComparisonReady?.(data.comparison);
    } catch (err) {
      setCompareState("error");
      setCompareError(err instanceof Error ? err.message : "Comparison failed.");
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (!inline && !autoCompared.current && fromVersion && toVersion && fromVersion !== toVersion) { autoCompared.current = true; void runCompare(); } }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/set-state-in-effect
  useEffect(() => { if (inline && fromVersion && toVersion && fromVersion !== toVersion) { void runCompare(); } }, [fromVersion, toVersion]);

  async function runZodGeneration() {
    setZodState("loading");
    setZodError("");
    setZodResult(null);

    try {
      const res = await fetch("/api/migrations/generate-zod-pair", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectName, fromVersion, toVersion }),
      });
      const data: ZodPairResponse = await res.json();
      setZodResult(data);
      setZodState(data.success ? "success" : "error");
      if (!data.success && data.errors.length > 0) {
        setZodError(data.errors.join("\n"));
      } else if (data.success) {
        onZodGenerated?.();
      }
    } catch (err) {
      setZodState("error");
      setZodError(err instanceof Error ? err.message : "Zod generation failed.");
    }
  }

  if (inline) {
    const warnings = comparison ? computeWarnings(comparison) : [];
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-semibold text-slate-700">{fromVersion}</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4 shrink-0 text-slate-400">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5-5 5M6 7l5 5-5 5" />
            </svg>
            <span className="font-semibold text-slate-700">{toVersion}</span>
            {compareState === "loading" && <span className="text-xs text-slate-400">Comparing…</span>}
            {compareState === "success" && comparison && (
              <span className="text-xs text-slate-400">
                <SummaryBar c={comparison} />
              </span>
            )}
          </div>
          {onOpenFullScreen && (
            <button
              type="button"
              onClick={onOpenFullScreen}
              className="h-8 rounded-md bg-slate-800 px-3 text-xs font-semibold text-white transition hover:bg-slate-700"
            >
              View Full Diff
            </button>
          )}
        </div>

        {warnings.length > 0 && <DiffWarningsPanel warnings={warnings} />}

        {compareState === "success" && (
          <div className="flex items-center gap-3 border-t border-slate-100 pt-3">
            <button
              type="button"
              disabled={zodState === "loading" || zodState === "success"}
              onClick={() => void runZodGeneration()}
              className="h-8 rounded-md bg-slate-800 px-3 text-xs font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {zodState === "loading" ? "Generating…" : zodState === "success" ? "Validators Generated ✓" : "Generate Zod Validators"}
            </button>
            {zodState !== "idle" && <StateChip state={zodState} />}
            {zodState === "error" && zodError && (
              <span className="text-xs text-rose-600">{zodError}</span>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-6 py-4">
        <div className="flex items-center gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Migrations
            </p>
            <h2 className="mt-0.5 text-xl font-semibold text-slate-950">
              Model Diff
            </h2>
          </div>
          <StateChip state={compareState} />
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-slate-700">{fromVersion}</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4 shrink-0 text-slate-400">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5-5 5M6 7l5 5-5 5" />
          </svg>
          <span className="text-sm font-semibold text-slate-700">{toVersion}</span>
          <button
            type="button"
            onClick={onClose}
            className="ml-2 h-9 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Close
          </button>
        </div>
      </div>

      {comparison && (
        <div className="shrink-0 border-b border-slate-200 bg-slate-50 px-6 py-2.5">
          <div className="flex items-center justify-between">
            <SummaryBar c={comparison} />
            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={zodState === "loading"}
                onClick={() => void runZodGeneration()}
                className="h-8 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {zodState === "loading" ? "Generating…" : "Generate Zod Schemas"}
              </button>
              {zodState !== "idle" && <StateChip state={zodState} />}
              {zodState === "success" && zodResult && (
                <span className="text-xs text-slate-500">
                  {zodResult.generatedFrom + zodResult.generatedTo} schemas generated
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {compareState === "error" && compareError && (
          <div className="m-6 rounded-md border border-rose-200 bg-rose-50 px-4 py-3">
            <p className="whitespace-pre-wrap font-mono text-xs text-rose-700">{compareError}</p>
          </div>
        )}

        {zodState === "error" && zodError && (
          <div className="mx-6 mt-4 rounded-md border border-rose-200 bg-rose-50 px-4 py-3">
            <p className="whitespace-pre-wrap font-mono text-xs text-rose-700">{zodError}</p>
          </div>
        )}

        {compareState === "loading" && (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <p className="text-sm font-semibold text-slate-500">Comparing versions…</p>
          </div>
        )}

        {comparison && (
          <div className="divide-y divide-slate-100">
            <div className="grid grid-cols-[8rem_1fr_1fr_minmax(0,1.5fr)_7rem] gap-x-4 bg-slate-50 px-6 py-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
              <span>Key</span>
              <span>Field / Model name</span>
              <span>Type</span>
              <span>Comment</span>
              <span>Status</span>
            </div>

            {comparison.matchedModels.filter((m) => m.hasChanges).map((m) => (
              <ModelRow
                key={m.key}
                model={m}
                expanded={expandedKeys.has(m.key)}
                onToggle={() => toggleExpand(m.key)}
              />
            ))}

            {comparison.addedModels.map((m) => (
              <div key={m.key} className="flex items-center gap-3 px-6 py-3">
                <span className="w-4 shrink-0" />
                <span className="flex-1 font-mono text-sm font-semibold text-emerald-700">+ {m.name}</span>
                <Badge type="ADDED" />
              </div>
            ))}

            {comparison.removedModels.map((m) => (
              <div key={m.key} className="flex items-center gap-3 px-6 py-3">
                <span className="w-4 shrink-0" />
                <span className="flex-1 font-mono text-sm font-semibold text-rose-600 line-through">− {m.name}</span>
                <Badge type="REMOVED" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
