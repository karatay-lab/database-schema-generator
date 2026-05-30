/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { format as formatSql } from "sql-formatter";
import CodeMirror from "@uiw/react-codemirror";
import { sql as sqlLang, SQLite } from "@codemirror/lang-sql";
import { dracula } from "@uiw/codemirror-theme-dracula";
import { keymap } from "@codemirror/view";
import { Prec } from "@codemirror/state";
import { classNames } from "@/lib/utils";
import { fieldTypeBadgeClass } from "@/lib/badge-utils";
import { useProjectInfo } from "../shared/project-info-context";
import { useSchemaModels } from "@/hooks/use-schema-models";
import type { DbStatus, MigrateResult, QueryResult } from "@/types/sql-query";
import { MigrationModal } from "@/components/sql-query/migration-modal";
import type { PrismaField } from "@/lib/schema-store";
import {
  formatDuration,
  cellDisplay,
  generateSelect,
  generateInsert,
  generateUpdate,
  generateDelete,
} from "@/lib/sql-query/generators";
import { TableSelectorModal } from "@/features/table-selector";

export function SqlQueryPageContent() {
  const { projectName, version, hasProject } = useProjectInfo();

  const [dbStatus, setDbStatus] = useState<DbStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);

  const [migrateOpen, setMigrateOpen] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [migrateResult, setMigrateResult] = useState<MigrateResult | null>(null);
  const [deletingSchema, setDeletingSchema] = useState(false);

  const [sql, setSql] = useState("");
  const [executing, setExecuting] = useState(false);
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);

  const { models: templateModels } = useSchemaModels(projectName, version);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [templateFields, setTemplateFields] = useState<PrismaField[]>([]);
  const [loadingTemplateFields, setLoadingTemplateFields] = useState(false);
  const [isTemplateSelectorOpen, setIsTemplateSelectorOpen] = useState(false);
  const [templateSearch, setTemplateSearch] = useState("");

  const fetchTemplateFields = useCallback(async (modelName: string) => {
    if (!projectName || !version || !modelName) {
      setTemplateFields([]);
      return;
    }
    setLoadingTemplateFields(true);
    try {
      const params = new URLSearchParams({ projectName, version, modelName });
      const res = await fetch(`/api/schema-fields?${params}`);
      const data = (await res.json()) as { fields?: PrismaField[] };
      setTemplateFields(data.fields ?? []);
    } catch {
      setTemplateFields([]);
    } finally {
      setLoadingTemplateFields(false);
    }
  }, [projectName, version]);

  const fetchStatus = useCallback(async () => {
    if (!projectName || !version) {
      setDbStatus(null);
      setLoadingStatus(false);
      return;
    }

    try {
      const params = new URLSearchParams({ projectName, version });
      const res = await fetch(`/api/sql-query/status?${params}`);
      const data = (await res.json()) as DbStatus;
      setDbStatus(data);
    } catch {
      setDbStatus(null);
    } finally {
      setLoadingStatus(false);
    }
  }, [projectName, version]);

  useEffect(() => {
    setLoadingStatus(true);
    setQueryResult(null);
    setSelectedTemplate("");
    setTemplateFields([]);
    void fetchStatus();
  }, [fetchStatus]);

  const handleMigrate = async () => {
    setMigrating(true);
    setMigrateResult(null);
    setMigrateOpen(true);

    try {
      const res = await fetch("/api/sql-query/migrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectName, version }),
      });
      const data = (await res.json()) as MigrateResult;
      setMigrateResult(data);

      if (data.success) {
        await fetchStatus();
      }
    } catch (err) {
      setMigrateResult({
        success: false,
        stage: "push",
        steps: [{ name: "push", success: false, output: err instanceof Error ? err.message : "Migration failed." }],
        relPath: "",
        schemaRelPath: "",
      });
    } finally {
      setMigrating(false);
    }
  };

  const handleDeleteSchema = async () => {
    if (!migrateResult?.schemaRelPath) return;
    setDeletingSchema(true);
    try {
      const params = new URLSearchParams({ projectName, version });
      await fetch(`/api/sql-query/migrate?${params}`, { method: "DELETE" });
      setMigrateResult(null);
      setMigrateOpen(false);
    } finally {
      setDeletingSchema(false);
    }
  };

  const handleRun = async () => {
    if (!sql.trim() || executing) return;

    setExecuting(true);
    setQueryResult(null);

    try {
      const res = await fetch("/api/sql-query/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectName, version, sql }),
      });
      const data = (await res.json()) as QueryResult | { error: string };

      if ("error" in data) {
        setQueryResult({ kind: "error", error: data.error });
      } else {
        setQueryResult(data);
      }
    } catch (err) {
      setQueryResult({
        kind: "error",
        error: err instanceof Error ? err.message : "Query failed.",
      });
    } finally {
      setExecuting(false);
    }
  };

  const handleFormat = () => {
    if (!sql.trim()) return;
    try {
      setSql(formatSql(sql, { language: "sqlite", tabWidth: 2, keywordCase: "upper" }));
    } catch {
      // leave sql unchanged if formatter can't parse it
    }
  };

  const handleRunRef = useRef(handleRun);
  const handleFormatRef = useRef(handleFormat);
  useLayoutEffect(() => {
    handleRunRef.current = handleRun;
    handleFormatRef.current = handleFormat;
  });

  /* eslint-disable react-hooks/refs */
  const runKeyBinding = useCallback(() => { void handleRunRef.current(); return true; }, []);
  const formatKeyBinding = useCallback(() => { handleFormatRef.current(); return true; }, []);

  const editorExtensions = useMemo(() => [
    sqlLang({ dialect: SQLite }),
    Prec.highest(
      keymap.of([
        { key: "Mod-Enter", run: runKeyBinding },
        { key: "Shift-Alt-f", run: formatKeyBinding },
      ]),
    ),
  ], [runKeyBinding, formatKeyBinding]);
  /* eslint-enable react-hooks/refs */

  if (!hasProject) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-8 text-center">
        <p className="text-slate-600">Select a project to use the SQL query workspace.</p>
      </div>
    );
  }

  const isInitialized = dbStatus?.initialized ?? false;

  return (
    <div className="space-y-4">
      {/* Header card */}
      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Main Window
              </p>
              <h3 className="mt-1 text-xl font-semibold text-slate-950">
                SQL Query workspace
              </h3>
            </div>
            <span className="w-fit rounded-md border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-semibold text-orange-700">
              {projectName} – {version}
            </span>
          </div>
        </div>

        {/* Database status bar */}
        <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span
              className={classNames(
                "inline-flex h-2.5 w-2.5 shrink-0 rounded-full",
                loadingStatus ? "bg-slate-300" : isInitialized ? "bg-emerald-500" : "bg-amber-400",
              )}
            />
            {loadingStatus ? (
              <span className="text-sm font-medium text-slate-500">Checking database…</span>
            ) : isInitialized ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-slate-700">
                  Database ready
                  <span className="ml-2 font-mono text-xs text-slate-400">{dbStatus?.relPath}</span>
                </span>
                <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                  SQLite preview — queries use SQLite syntax regardless of project provider
                </span>
              </div>
            ) : (
              <span className="text-sm font-medium text-slate-600">
                No SQLite database — initialize to enable queries
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => void handleMigrate()}
            disabled={!projectName || !version || migrating}
            className={classNames(
              "h-9 min-w-36 shrink-0 rounded-md px-4 text-sm font-semibold text-white shadow-sm transition",
              isInitialized
                ? "bg-slate-600 hover:bg-slate-700"
                : "bg-orange-600 hover:bg-orange-700",
              !projectName || !version || migrating
                ? "cursor-not-allowed bg-slate-300 hover:bg-slate-300"
                : "",
            )}
          >
            {migrating ? "Migrating…" : isInitialized ? "Re-migrate" : "Initialize Database"}
          </button>
        </div>
      </section>

      {/* Query templates card */}
      {isInitialized && templateModels.length > 0 ? (
        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center gap-2 px-4 py-3">
            <p className="shrink-0 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
              Templates
            </p>

            <button
              type="button"
              onClick={() => setIsTemplateSelectorOpen(true)}
              className="h-8 rounded-md border border-orange-300 bg-white px-3 text-xs font-semibold text-orange-700 transition hover:bg-orange-50"
            >
              {selectedTemplate ? selectedTemplate : "Select Table"}
            </button>

            {loadingTemplateFields ? (
              <span className="text-xs font-medium text-slate-400">Loading…</span>
            ) : selectedTemplate && templateFields.length > 0 ? (
              <>
                <span className="text-slate-300">|</span>
                {(
                  [
                    { label: "SELECT", fn: generateSelect, color: "border-cyan-300 bg-cyan-50 text-cyan-700 hover:bg-cyan-100" },
                    { label: "INSERT", fn: generateInsert, color: "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100" },
                    { label: "UPDATE", fn: generateUpdate, color: "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100" },
                    { label: "DELETE", fn: generateDelete, color: "border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100" },
                  ] as const
                ).map(({ label, fn, color }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setSql(fn(selectedTemplate, templateFields))}
                    className={classNames("h-8 rounded-md border px-3 text-xs font-semibold transition", color)}
                  >
                    {label}
                  </button>
                ))}
                <span className="text-xs font-medium text-slate-400">
                  {templateFields.filter((f) => !f.isRelation).length} cols
                </span>
              </>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* SQL editor card */}
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            SQL Editor
          </p>
          <p className="text-xs font-medium text-slate-400">
            Ctrl+Enter to run · Shift+Alt+F to format
          </p>
        </div>
        <div
          className={classNames(
            "transition",
            !isInitialized && "pointer-events-none opacity-50",
          )}
        >
          <CodeMirror
            value={sql}
            theme={dracula}
            height="260px"
            editable={isInitialized}
            placeholder={
              isInitialized
                ? "SELECT * FROM users LIMIT 20;"
                : "Initialize the database first to run queries."
            }
            extensions={editorExtensions}
            onChange={(value) => setSql(value)}
            basicSetup={{
              lineNumbers: true,
              highlightActiveLineGutter: true,
              highlightActiveLine: true,
              foldGutter: false,
              bracketMatching: true,
              closeBrackets: true,
              autocompletion: true,
              indentOnInput: true,
            }}
          />
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-[#282a36] px-4 py-3">
          <button
            type="button"
            onClick={handleFormat}
            disabled={!sql.trim()}
            className="h-9 rounded-md border border-slate-500 bg-transparent px-4 text-sm font-semibold text-slate-300 transition hover:border-slate-400 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
          >
            Format
          </button>
          <button
            type="button"
            onClick={() => void handleRun()}
            disabled={!isInitialized || !sql.trim() || executing}
            className="h-9 min-w-28 rounded-md bg-orange-500 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:bg-slate-600 disabled:text-slate-400"
          >
            {executing ? "Running…" : "Run Query"}
          </button>
        </div>
      </section>

      {/* Results card */}
      {queryResult ? (
        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Results
            </p>
            {queryResult.kind !== "error" && (
              <span className="text-xs font-medium text-slate-400">
                {formatDuration(queryResult.duration)}
              </span>
            )}
          </div>

          <div className="p-5">
            {queryResult.kind === "error" && (
              <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3">
                <p className="font-mono text-sm text-rose-700">{queryResult.error}</p>
              </div>
            )}

            {queryResult.kind === "mutation" && (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3">
                <p className="text-sm font-semibold text-emerald-700">
                  {queryResult.affectedRows} row{queryResult.affectedRows !== 1 ? "s" : ""} affected
                  {queryResult.lastInsertRowid
                    ? ` · last insert id: ${queryResult.lastInsertRowid}`
                    : ""}
                </p>
              </div>
            )}

            {queryResult.kind === "exec" && (
              <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-sm font-semibold text-slate-600">Executed successfully.</p>
              </div>
            )}

            {queryResult.kind === "rows" && (
              <>
                <div className="mb-3 flex flex-wrap items-center gap-3">
                  <p className="text-xs font-semibold text-slate-500">
                    {queryResult.rowCount} row{queryResult.rowCount !== 1 ? "s" : ""}
                  </p>
                  {queryResult.truncated && (
                    <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
                      Showing first 500 — add LIMIT to see fewer
                    </span>
                  )}
                </div>

                {queryResult.rowCount === 0 ? (
                  <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm font-medium text-slate-500">
                    Query returned no rows.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-md border border-slate-200">
                    <table className="min-w-full">
                      <thead className="bg-slate-50">
                        <tr>
                          {queryResult.columns.map((col) => (
                            <th
                              key={col}
                              className="whitespace-nowrap border-b border-slate-200 px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500"
                            >
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {queryResult.rows.map((row, rowIndex) => (
                          <tr key={rowIndex} className="hover:bg-slate-50/60">
                            {queryResult.columns.map((col, colIndex) => {
                              const { text, muted } = cellDisplay(row[col]);
                              const isFirst = colIndex === 0;
                              return (
                                <td
                                  key={col}
                                  className={classNames(
                                    "px-3 py-1.5 font-mono text-[11px]",
                                    isFirst ? "whitespace-nowrap" : "max-w-[180px] truncate whitespace-nowrap",
                                    muted ? "text-slate-400" : "text-slate-800",
                                  )}
                                  title={!isFirst ? text : undefined}
                                >
                                  {text}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      ) : null}

      <TableSelectorModal
        isOpen={isTemplateSelectorOpen}
        models={templateModels}
        selectedModelName={selectedTemplate}
        search={templateSearch}
        isLoading={false}
        tone="orange"
        onSearch={setTemplateSearch}
        onSelect={(modelName) => {
          setSelectedTemplate(modelName);
          setTemplateFields([]);
          setIsTemplateSelectorOpen(false);
          setTemplateSearch("");
          void fetchTemplateFields(modelName);
        }}
        onClose={() => {
          setIsTemplateSelectorOpen(false);
          setTemplateSearch("");
        }}
        typeBadgeClass={fieldTypeBadgeClass}
      />

      <MigrationModal
        isOpen={migrateOpen}
        migrating={migrating}
        migrateResult={migrateResult}
        deletingSchema={deletingSchema}
        onDeleteSchema={() => void handleDeleteSchema()}
        onClose={() => setMigrateOpen(false)}
      />
    </div>
  );
}
