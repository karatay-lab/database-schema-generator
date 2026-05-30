/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { format as formatSql } from "sql-formatter";
import CodeMirror from "@uiw/react-codemirror";
import { sql as sqlLang, SQLite } from "@codemirror/lang-sql";
import { dracula } from "@uiw/codemirror-theme-dracula";
import { keymap } from "@codemirror/view";
import { Prec } from "@codemirror/state";
import { classNames } from "../shared/dashboard-data";
import { fieldTypeBadgeClass } from "@/lib/badge-utils";
import { useProjectInfo } from "../shared/project-info-context";
import { useSchemaModels } from "@/hooks/use-schema-models";
import type { PrismaField } from "@/lib/schema-store";
import type { DbStatus, MigrateResult, QueryResult } from "@/types/sql-query";

// ─── helpers ──────────────────────────────────────────────────────────────────

function formatDuration(ms: number) {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(2)}s`;
}

function cellDisplay(value: unknown) {
  if (value === null) return { text: "null", muted: true };
  if (value === true) return { text: "true", muted: false };
  if (value === false) return { text: "false", muted: false };
  return { text: String(value), muted: false };
}

// ─── mock data ────────────────────────────────────────────────────────────────

function mockStr(len: number) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

function mockUuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function mockDate() {
  const ms = new Date(2020, 0, 1).getTime() + Math.random() * (4 * 365 * 86400 * 1000);
  return new Date(ms).toISOString().replace("T", " ").slice(0, 19);
}

function mockInt() {
  return String(Math.floor(Math.random() * 9999) + 1);
}

function mockFloat() {
  return (Math.random() * 9999).toFixed(2);
}

function sqlMockValue(field: PrismaField): string {
  if (field.isRelation) return "NULL";
  const isUuid = field.nativeAttribute?.name === "Uuid" || field.type === "Uuid";
  switch (field.type) {
    case "String": return isUuid ? `'${mockUuid()}'` : `'${mockStr(10)}'`;
    case "Int": return mockInt();
    case "BigInt": return mockInt();
    case "Float": case "Decimal": return mockFloat();
    case "Boolean": return Math.random() > 0.5 ? "1" : "0";
    case "DateTime": return `'${mockDate()}'`;
    case "Json": return "'{}'";
    case "Bytes": return "''";
    default: return `'${mockStr(8)}'`; // enums etc.
  }
}

// ─── SQL generators ───────────────────────────────────────────────────────────

function chunked(items: string[], perLine = 6): string {
  const lines: string[] = [];
  for (let i = 0; i < items.length; i += perLine) {
    lines.push(items.slice(i, i + perLine).join(", "));
  }
  return lines.join(",\n  ");
}

function colFields(fields: PrismaField[]) {
  return fields.filter((f) => !f.isRelation || f.isId);
}

function editableFields(fields: PrismaField[]) {
  return fields.filter((f) => !f.isRelation && !f.isId && !f.isArray);
}

function pkField(fields: PrismaField[]) {
  return fields.find((f) => f.isId);
}

function q(name: string) {
  return `"${name}"`;
}

function generateSelect(modelName: string, fields: PrismaField[]) {
  const cols = chunked(colFields(fields).map((f) => q(f.dbName)));
  return `SELECT\n  ${cols}\nFROM ${q(modelName)}\nLIMIT 10;`;
}

function generateInsert(modelName: string, fields: PrismaField[]) {
  const insertable = colFields(fields).filter(
    (f) => !f.isId || (f.isId && f.defaultValue !== "autoincrement()"),
  );
  const cols = chunked(insertable.map((f) => q(f.dbName)));
  const vals = chunked(insertable.map((f) => sqlMockValue(f)));
  return `INSERT INTO ${q(modelName)} (\n  ${cols}\n) VALUES (\n  ${vals}\n);`;
}

function generateUpdate(modelName: string, fields: PrismaField[]) {
  const pk = pkField(fields);
  const updatable = editableFields(fields);
  if (!pk || updatable.length === 0) return `-- No editable fields on ${modelName}`;
  const pairs = updatable.map((f) => `${q(f.dbName)} = ${sqlMockValue(f)}`);
  const setClause = chunked(pairs);
  const pkVal = sqlMockValue(pk);
  return `UPDATE ${q(modelName)}\nSET\n  ${setClause}\nWHERE ${q(pk.dbName)} = ${pkVal};`;
}

function generateDelete(modelName: string, fields: PrismaField[]) {
  const pk = pkField(fields);
  if (!pk) return `-- No primary key on ${modelName}`;
  return `DELETE FROM ${q(modelName)}\nWHERE ${q(pk.dbName)} = ${sqlMockValue(pk)};`;
}

// ─── component ────────────────────────────────────────────────────────────────

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

      {/* Table selector modal */}
      {isTemplateSelectorOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-3">
          <div className="max-h-[94vh] w-[96vw] max-w-[1500px] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl">
            <div className="border-b border-slate-200 px-5 py-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Table Selector
                  </p>
                  <h3 className="mt-1 text-xl font-semibold text-slate-950">
                    Tables
                  </h3>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded-md border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-semibold text-orange-700">
                    {templateModels.length} tables
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setIsTemplateSelectorOpen(false);
                      setTemplateSearch("");
                    }}
                    className="h-9 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>

            <div className="p-5">
              <div className="mb-4">
                <input
                  type="text"
                  value={templateSearch}
                  onChange={(e) => setTemplateSearch(e.target.value)}
                  placeholder="Search tables..."
                  className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-orange-500"
                  autoFocus
                />
              </div>

              <div className="max-h-[70vh] overflow-y-auto pr-1">
                {(() => {
                  const filtered = templateModels.filter((m) =>
                    m.name.toLowerCase().includes(templateSearch.toLowerCase()),
                  );
                  return filtered.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm font-medium text-slate-500">
                      No tables found.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                      {filtered.map((model) => {
                        const isSelected = model.name === selectedTemplate;
                        return (
                          <button
                            key={model.key}
                            type="button"
                            onClick={() => {
                              setSelectedTemplate(model.name);
                              setTemplateFields([]);
                              setIsTemplateSelectorOpen(false);
                              setTemplateSearch("");
                              void fetchTemplateFields(model.name);
                            }}
                            className={classNames(
                              "flex min-h-16 items-center justify-between rounded-lg border p-4 text-left transition",
                              isSelected
                                ? "border-orange-400 bg-orange-50 shadow-sm"
                                : "border-slate-200 bg-white hover:border-orange-300",
                            )}
                          >
                            <span className="min-w-0 truncate font-semibold text-slate-950">
                              {model.name}
                            </span>
                            <span
                              className={classNames(
                                "ml-3 inline-flex shrink-0 items-center rounded-md px-2 py-1 text-xs font-medium",
                                fieldTypeBadgeClass(model.pkType),
                              )}
                            >
                              {model.pkType || "String"}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Migration modal */}
      {migrateOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-3">
          <div className="flex max-h-[85vh] w-[96vw] max-w-3xl flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 shrink-0">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Database Migration
                </p>
                <h3 className="mt-1 text-lg font-semibold text-slate-950">
                  {migrating
                    ? "Validating and pushing schema…"
                    : migrateResult?.success
                      ? "Migration succeeded"
                      : migrateResult?.stage === "validate"
                        ? "Schema validation failed"
                        : "Push failed"}
                </h3>
                {!migrating && migrateResult?.relPath ? (
                  <p className="mt-1 font-mono text-xs text-slate-400">{migrateResult.relPath}</p>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                {!migrating && migrateResult?.stage === "validate" && migrateResult.schemaRelPath ? (
                  <button
                    type="button"
                    onClick={() => void handleDeleteSchema()}
                    disabled={deletingSchema}
                    className="h-9 rounded-md border border-rose-300 bg-white px-3 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {deletingSchema ? "Deleting…" : "Delete Schema"}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setMigrateOpen(false)}
                  disabled={migrating}
                  className="h-9 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {migrating ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-8 text-center text-sm font-semibold text-slate-500">
                  Running prisma validate then prisma db push…
                </div>
              ) : migrateResult ? (
                <>
                  {/* Overall status banner */}
                  <div
                    className={classNames(
                      "rounded-md border px-4 py-3",
                      migrateResult.success
                        ? "border-emerald-200 bg-emerald-50"
                        : migrateResult.stage === "validate"
                          ? "border-amber-200 bg-amber-50"
                          : "border-rose-200 bg-rose-50",
                    )}
                  >
                    <p
                      className={classNames(
                        "text-sm font-semibold",
                        migrateResult.success
                          ? "text-emerald-700"
                          : migrateResult.stage === "validate"
                            ? "text-amber-700"
                            : "text-rose-700",
                      )}
                    >
                      {migrateResult.success
                        ? "SQLite database created and schema pushed."
                        : migrateResult.stage === "validate"
                          ? "The SQLite schema has validation errors. Fix the issues in your project schema (Relations page) then try again."
                          : "Schema is valid but the push failed — see output below."}
                    </p>
                    {migrateResult.success && migrateResult.schemaRelPath ? (
                      <p className="mt-1 font-mono text-xs text-emerald-600">
                        Schema written to {migrateResult.schemaRelPath}
                      </p>
                    ) : null}
                    {!migrateResult.success && migrateResult.schemaRelPath ? (
                      <p className="mt-1 font-mono text-xs text-slate-500">
                        Generated schema: {migrateResult.schemaRelPath}
                      </p>
                    ) : null}
                    {migrateResult.backupRelPath ? (
                      <p className="mt-1 font-mono text-xs text-amber-600">
                        Backup saved to {migrateResult.backupRelPath}
                      </p>
                    ) : null}
                  </div>

                  {/* Per-step output */}
                  {(migrateResult.steps ?? []).map((step) => (
                    <div key={step.name} className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span
                          className={classNames(
                            "inline-flex h-2 w-2 rounded-full",
                            step.success ? "bg-emerald-500" : "bg-rose-500",
                          )}
                        />
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                          {step.name === "validate" ? "prisma validate" : "prisma db push"}
                        </p>
                        <span
                          className={classNames(
                            "rounded px-1.5 py-0.5 text-[11px] font-bold",
                            step.success
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-rose-100 text-rose-700",
                          )}
                        >
                          {step.success ? "passed" : "failed"}
                        </span>
                      </div>
                      {step.output ? (
                        <pre className="overflow-x-auto rounded-md border border-slate-200 bg-slate-950 px-4 py-3 font-mono text-xs leading-6 text-slate-200 whitespace-pre-wrap">
                          {step.output}
                        </pre>
                      ) : null}
                    </div>
                  ))}
                </>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
