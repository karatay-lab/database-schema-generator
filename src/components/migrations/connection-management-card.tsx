"use client";

import { classNames } from "@/lib/utils";
import { Card, CardHeader, CardBody } from "@/components/built";
import { StateChip, StepBadge } from "@/components/migrations/phase-state";
import { ErrorBox } from "@/components/migrations/error-box";
import { MigrationLabel as Label, MigrationInput as Input } from "@/components/migrations/migration-form";
import { shortUuid } from "@/constants/migrations";
import type { ConnectionRecord, PhaseState } from "@/types/migrations";

type TestResult = { success: boolean; tables?: string[]; error?: string };

type ConnectionManagementCardProps = {
  canDoAnyMigration: boolean;
  migrationPlan: "new" | "version" | null;
  connections: ConnectionRecord[];
  activeConnectionId: string;
  activeConnection: ConnectionRecord | null;
  loadingConnections: boolean;
  deletingId: string;
  testingId: string;
  testResults: Record<string, TestResult>;
  remoteTables: string[];
  showNewForm: boolean;
  connectionName: string;
  host: string;
  port: string;
  dbUser: string;
  password: string;
  database: string;
  connectState: PhaseState;
  connectError: string;
  isSQLite: boolean;
  /** The project's configured database provider — used to flag mismatched connections. */
  projectProvider: string;
  onSelectConnection: (uuid: string) => void;
  onDeleteConnection: (uuid: string) => void;
  onTestConnection: (uuid: string) => void;
  onOpenConnString: () => void;
  onToggleNewForm: () => void;
  onConnectionNameChange: (v: string) => void;
  onHostChange: (v: string) => void;
  onPortChange: (v: string) => void;
  onDbUserChange: (v: string) => void;
  onPasswordChange: (v: string) => void;
  onDatabaseChange: (v: string) => void;
  onConnect: () => void;
};

function normaliseProvider(p: string) {
  const lc = p.toLowerCase();
  if (lc === "postgres" || lc === "postgresql") return "postgresql";
  return lc;
}

export function ConnectionManagementCard({
  canDoAnyMigration, migrationPlan,
  connections, activeConnectionId, activeConnection, loadingConnections,
  deletingId, testingId, testResults, remoteTables,
  showNewForm, connectionName, host, port, dbUser, password, database,
  connectState, connectError, isSQLite, projectProvider,
  onSelectConnection, onDeleteConnection, onTestConnection, onOpenConnString,
  onToggleNewForm, onConnectionNameChange, onHostChange, onPortChange,
  onDbUserChange, onPasswordChange, onDatabaseChange, onConnect,
}: ConnectionManagementCardProps) {
  return (
    <Card locked={!canDoAnyMigration || migrationPlan === null}>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <StepBadge n={1} state={connectState} />
            <div>
              <p className="text-sm font-semibold text-slate-950">Database Connection</p>
              <p className="text-xs text-slate-500">Select a saved connection or add a new one.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StateChip state={connectState} />
            {activeConnectionId && (
              <button type="button" onClick={onOpenConnString}
                className="h-8 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50">
                Connection String
              </button>
            )}
            <button type="button" onClick={onToggleNewForm}
              className="h-8 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50">
              {showNewForm ? "Cancel" : "+ New Connection"}
            </button>
          </div>
        </div>
      </CardHeader>

      <CardBody>
        {loadingConnections ? (
          <p className="text-sm text-slate-500">Loading connections…</p>
        ) : connections.length > 0 ? (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Saved Connections</p>
            <div className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200">
              {connections.map((conn) => {
                const isActive = conn.uuid === activeConnectionId;
                const providerMismatch = normaliseProvider(conn.provider) !== normaliseProvider(projectProvider);
                const testResult = testResults[conn.uuid];

                const providerLabel = (() => {
                  const lc = conn.provider.toLowerCase();
                  if (lc === "postgres" || lc === "postgresql") return "Postgres";
                  if (lc === "mysql") return "MySQL";
                  if (lc === "sqlite") return "SQLite";
                  return conn.provider;
                })();

                const providerCls = (() => {
                  const lc = conn.provider.toLowerCase();
                  if (providerMismatch) return "border-amber-300 bg-amber-50 text-amber-700";
                  if (lc === "postgres" || lc === "postgresql") return "border-indigo-200 bg-indigo-50 text-indigo-700";
                  if (lc === "mysql") return "border-orange-200 bg-orange-50 text-orange-700";
                  return "border-slate-200 bg-slate-100 text-slate-600";
                })();

                const rowBg = isActive
                  ? "bg-emerald-50"
                  : providerMismatch
                    ? "bg-amber-50/40"
                    : "bg-white hover:bg-slate-50/70";

                return (
                  <div key={conn.uuid} className={classNames("transition", rowBg)}>
                    {/*
                      4-column grid — entire row is clickable for selection;
                      only the actions div stops propagation.
                      [dot + name + badges]  [host:port / db — fills centre]  [date]  [| actions]
                    */}
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => { if (!providerMismatch) onSelectConnection(conn.uuid); }}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (!providerMismatch) onSelectConnection(conn.uuid); } }}
                      title={providerMismatch ? `Provider mismatch — connection is ${conn.provider}, project is ${projectProvider}` : undefined}
                      className={classNames(
                        "grid grid-cols-[auto_1fr_auto_auto] items-center gap-x-6 px-4 py-3",
                        providerMismatch ? "cursor-not-allowed" : "cursor-pointer",
                      )}
                    >
                      {/* Col 1: status dot + name + provider/status badges */}
                      <div className="flex items-center gap-3">
                        <span className={classNames("h-2.5 w-2.5 shrink-0 rounded-full ring-2",
                          isActive
                            ? "bg-emerald-500 ring-emerald-100"
                            : providerMismatch
                              ? "bg-amber-400 ring-amber-100"
                              : "bg-slate-200 ring-transparent")} />
                        <div className="flex items-center gap-2">
                          <p className={classNames("text-sm font-semibold whitespace-nowrap",
                            isActive ? "text-emerald-900" : "text-slate-900")}>
                            {conn.name}
                          </p>
                          <span className={classNames("shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-semibold", providerCls)}>
                            {providerLabel}
                          </span>
                          {isActive && (
                            <span className="shrink-0 rounded border border-emerald-200 bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                              Active
                            </span>
                          )}
                          {providerMismatch && (
                            <span className="shrink-0 rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                              ⚠ Wrong provider
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Col 2: host:port / database — grows to fill empty centre */}
                      <p className="min-w-0 truncate font-mono text-[11px] text-slate-400">
                        {conn.host ? `${conn.host}:${conn.port} / ${conn.database}` : conn.database}
                      </p>

                      {/* Col 3: date + test result */}
                      <div className="shrink-0 text-right">
                        <p className="text-[11px] text-slate-400">{new Date(conn.lastUsedAt).toLocaleDateString()}</p>
                        {testResult && (
                          <p className={classNames("mt-0.5 text-[10px] font-semibold",
                            testResult.success ? "text-emerald-600" : "text-rose-600")}>
                            {testResult.success
                              ? `✓ ${testResult.tables?.length ?? 0} tables`
                              : `✗ ${testResult.error?.slice(0, 32) ?? "Failed"}`}
                          </p>
                        )}
                      </div>

                      {/* Col 4: actions — stop propagation so row click doesn't fire */}
                      <div
                        className="flex shrink-0 items-center gap-1 border-l border-slate-100 pl-4"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button type="button" onClick={() => onTestConnection(conn.uuid)}
                          disabled={testingId === conn.uuid || undefined}
                          className="rounded-md px-3 py-1.5 text-xs font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-50">
                          {testingId === conn.uuid ? "Testing…" : "Test"}
                        </button>
                        <button type="button" onClick={() => onDeleteConnection(conn.uuid)}
                          disabled={deletingId === conn.uuid || undefined}
                          className="rounded-md px-3 py-1.5 text-xs font-semibold text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-50">
                          {deletingId === conn.uuid ? "…" : "Remove"}
                        </button>
                      </div>

                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : !showNewForm ? (
          <p className="text-sm text-slate-500">
            No connections saved yet.{" "}
            <button type="button" onClick={onToggleNewForm}
              className="font-semibold text-slate-700 underline underline-offset-2">
              Add one
            </button>
          </p>
        ) : null}

        {showNewForm && (
          <div className="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">New Connection</p>
            <div className="flex flex-col gap-1">
              <Label>Connection Name</Label>
              <Input value={connectionName} onChange={onConnectionNameChange} placeholder="e.g. Production DB" />
            </div>
            {isSQLite ? (
              <div className="flex flex-col gap-1">
                <Label>SQLite File Path</Label>
                <Input value={database} onChange={onDatabaseChange} placeholder="./path/to/database.db" />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                <div className="col-span-2 flex flex-col gap-1 lg:col-span-2">
                  <Label>Host / IP</Label>
                  <Input value={host} onChange={onHostChange} placeholder="localhost" />
                </div>
                <div className="flex flex-col gap-1">
                  <Label>Port</Label>
                  <Input value={port} onChange={onPortChange} placeholder="5432" />
                </div>
                <div className="flex flex-col gap-1">
                  <Label>Username</Label>
                  <Input value={dbUser} onChange={onDbUserChange} placeholder="postgres" />
                </div>
                <div className="flex flex-col gap-1">
                  <Label>Password</Label>
                  <Input value={password} onChange={onPasswordChange} type="password" placeholder="••••••••" />
                </div>
                <div className="flex flex-col gap-1">
                  <Label>Database</Label>
                  <Input value={database} onChange={onDatabaseChange} placeholder="mydb" />
                </div>
              </div>
            )}
            {connectError && <ErrorBox message={connectError} />}
            <div className="flex justify-end">
              <button type="button" onClick={onConnect}
                disabled={connectState === "loading" || undefined}
                className="h-9 min-w-40 rounded-md bg-slate-800 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300">
                {connectState === "loading" ? "Connecting…" : "Test & Save Connection"}
              </button>
            </div>
          </div>
        )}

        {activeConnection && !showNewForm && normaliseProvider(activeConnection.provider) !== normaliseProvider(projectProvider) && (
          <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3">
            <p className="text-sm font-semibold text-amber-800">
              ⚠ Provider mismatch — active connection is <span className="font-mono">{activeConnection.provider}</span> but
              this project is configured as <span className="font-mono">{projectProvider}</span>.
            </p>
            <p className="mt-1 text-xs text-amber-700">
              Select a matching {projectProvider} connection or create a new one. Running migrations with a mismatched
              provider will fail.
            </p>
          </div>
        )}

        {activeConnection && !showNewForm && normaliseProvider(activeConnection.provider) === normaliseProvider(projectProvider) && (
          <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500 ring-2 ring-emerald-100" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-emerald-900">{activeConnection.name}</p>
                <span className={classNames("shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-semibold", (() => {
                  const lc = activeConnection.provider.toLowerCase();
                  if (lc === "postgres" || lc === "postgresql") return "border-indigo-200 bg-indigo-50 text-indigo-700";
                  if (lc === "mysql") return "border-orange-200 bg-orange-50 text-orange-700";
                  return "border-slate-200 bg-slate-100 text-slate-600";
                })())}>
                  {(() => {
                    const lc = activeConnection.provider.toLowerCase();
                    if (lc === "postgres" || lc === "postgresql") return "Postgres";
                    if (lc === "mysql") return "MySQL";
                    if (lc === "sqlite") return "SQLite";
                    return activeConnection.provider;
                  })()}
                </span>
              </div>
              <p className="mt-0.5 font-mono text-[11px] text-emerald-700">
                {activeConnection.host ? `${activeConnection.host}:${activeConnection.port} / ${activeConnection.database}` : activeConnection.database}
              </p>
            </div>
            <span className="shrink-0 rounded border border-emerald-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
              Connected
            </span>
          </div>
        )}

        {remoteTables.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Tables in DB ({remoteTables.length})</p>
            <div className="flex flex-wrap gap-2">
              {remoteTables.map((t) => (
                <span key={t} className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">{t}</span>
              ))}
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
