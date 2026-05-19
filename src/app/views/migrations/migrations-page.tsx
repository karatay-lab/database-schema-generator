"use client";

import { useCallback, useEffect, useState } from "react";
import { classNames } from "../shared/dashboard-data";
import { useProjectInfo } from "../shared/project-info-context";
import { ModelDiff } from "./model-diff";
import type {
  CollectResponse,
  ConnectionRecord,
  ConnectionsResponse,
  ConnectResponse,
  InvalidRow,
  PhaseState,
  PushNewResponse,
  RunResponse,
  SchemaCheckResponse,
  ValidateResponse,
  ValidationIssue,
} from "@/types/migrations";

// ─── small helpers ────────────────────────────────────────────────────────────

function StateChip({ state }: { state: PhaseState }) {
  const map: Record<PhaseState, { label: string; cls: string }> = {
    idle: { label: "Pending", cls: "bg-slate-100 text-slate-500" },
    loading: { label: "Running…", cls: "bg-amber-100 text-amber-700" },
    success: { label: "Done", cls: "bg-emerald-100 text-emerald-700" },
    error: { label: "Failed", cls: "bg-rose-100 text-rose-700" },
  };
  const { label, cls } = map[state];
  return (
    <span className={classNames("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", cls)}>
      {label}
    </span>
  );
}

function StepBadge({ n, state }: { n: number; state: PhaseState }) {
  const base = "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold";
  if (state === "success") return <span className={classNames(base, "bg-emerald-500 text-white")}>✓</span>;
  if (state === "error") return <span className={classNames(base, "bg-rose-500 text-white")}>✗</span>;
  if (state === "loading") return <span className={classNames(base, "bg-amber-400 text-white")}>{n}</span>;
  return <span className={classNames(base, "bg-slate-200 text-slate-600")}>{n}</span>;
}

function Card({ children, locked }: { children: React.ReactNode; locked?: boolean }) {
  return (
    <div className={classNames("rounded-lg border border-slate-200 bg-white", locked ? "opacity-50 pointer-events-none select-none" : "")}>
      {children}
    </div>
  );
}

function CardHeader({ children }: { children: React.ReactNode }) {
  return <div className="border-b border-slate-200 px-5 py-4">{children}</div>;
}

function CardBody({ children }: { children: React.ReactNode }) {
  return <div className="space-y-4 p-5">{children}</div>;
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3">
      <p className="whitespace-pre-wrap font-mono text-xs text-rose-700">{message}</p>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs font-semibold text-slate-600">{children}</label>;
}

function Input({
  value, onChange, placeholder, type = "text",
}: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      autoComplete="off"
      className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-500"
    />
  );
}

function shortUuid(uuid: string) {
  return uuid.slice(0, 8);
}

// ─── issue section ────────────────────────────────────────────────────────────

function IssueSection({ title, issues }: { title: string; issues: ValidationIssue[] }) {
  const errors = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity === "warning");
  if (issues.length === 0) return null;
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{title}</p>
        {errors.length > 0 && (
          <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
            {errors.length} error{errors.length !== 1 ? "s" : ""}
          </span>
        )}
        {warnings.length > 0 && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
            {warnings.length} warning{warnings.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>
      <div className="max-h-48 overflow-y-auto rounded-md border border-slate-200 divide-y divide-slate-100">
        {issues.map((issue, idx) => (
          <div key={idx} className="grid grid-cols-[160px_60px_1fr] items-start gap-3 px-4 py-2.5 text-xs hover:bg-slate-50">
            <p className="truncate font-semibold text-slate-800">
              {issue.model}.<span className="text-slate-400">{issue.field}</span>
            </p>
            <span className={classNames(
              "inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold",
              issue.severity === "error" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700",
            )}>
              {issue.severity}
            </span>
            <div>
              <p className="text-slate-700">{issue.issue}</p>
              {issue.suggestion && <p className="mt-0.5 italic text-slate-400">{issue.suggestion}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── types ────────────────────────────────────────────────────────────────────

type MigrationSession = {
  id: string;
  projectId: string;
  projectName: string;
  connectionId: string;
  fromVersion: string;
  toVersion: string;
  collectTimestamp: string | null;
  collectTableCount: number | null;
  collectRowCount: number | null;
  collectTables: { name: string; count: number }[] | null;
  runStatus: string | null;
  runLogPath: string | null;
  updatedAt: string;
};

type MigrationOrderItem = NonNullable<CollectResponse["migrationOrder"]>[number];

// ─── main component ───────────────────────────────────────────────────────────

type MigrationPlan = "new" | "version";

export function MigrationsPageContent() {
  const { projectId, projectName, provider, versions, hasProject } = useProjectInfo();
  const isSQLite = provider.toLowerCase() === "sqlite";
  const canDoAnyMigration = versions.length >= 1;
  const canVersionMigrate = versions.length >= 2;

  // ── migration plan selection ──
  const [migrationPlan, setMigrationPlan] = useState<MigrationPlan | null>(null);
  const [dbTableCount, setDbTableCount] = useState<number | null>(null);
  const dbIsEmpty = dbTableCount !== null && dbTableCount === 0;

  // ── session history ──
  const [sessions, setSessions] = useState<MigrationSession[]>([]);

  // ── saved connections ──
  const [connections, setConnections] = useState<ConnectionRecord[]>([]);
  const [activeConnectionId, setActiveConnectionId] = useState<string>("");
  const [loadingConnections, setLoadingConnections] = useState(false);
  const [deletingId, setDeletingId] = useState<string>("");

  // ── step 1: new connection form ──
  const [showNewForm, setShowNewForm] = useState(false);
  const [connectionName, setConnectionName] = useState("");
  const [host, setHost] = useState("localhost");
  const [port, setPort] = useState(
    isSQLite ? "" : provider.toLowerCase() === "mysql" ? "3306" : "5432",
  );
  const [dbUser, setDbUser] = useState("");
  const [password, setPassword] = useState("");
  const [database, setDatabase] = useState("");
  const [connectState, setConnectState] = useState<PhaseState>("idle");
  const [connectError, setConnectError] = useState("");
  const [remoteTables, setRemoteTables] = useState<string[]>([]);

  // ── new migration ──
  const [newTargetVersion, setNewTargetVersion] = useState(versions[versions.length - 1] ?? "");
  const [pushState, setPushState] = useState<PhaseState>("idle");
  const [pushError, setPushError] = useState("");

  // ── version plan ──
  const [syncVersion, setSyncVersion] = useState("");
  const [targetVersion, setTargetVersion] = useState("");

  // ── step 2: model diff ──
  const [modelDiffState, setModelDiffState] = useState<PhaseState>("idle");
  const [showModelDiffModal, setShowModelDiffModal] = useState(false);

  // ── step 3: schema check ──
  const [schemaCheckState, setSchemaCheckState] = useState<PhaseState>("idle");
  const [schemaCheckResult, setSchemaCheckResult] = useState<SchemaCheckResponse | null>(null);

  // ── step 4: collect ──
  const [collectState, setCollectState] = useState<PhaseState>("idle");
  const [collectError, setCollectError] = useState("");
  const [collectTimestamp, setCollectTimestamp] = useState("");
  const [collectTables, setCollectTables] = useState<{ name: string; count: number }[]>([]);
  const [collectTotal, setCollectTotal] = useState(0);
  const [collectQueryError, setCollectQueryError] = useState("");
  const [collectMismatches, setCollectMismatches] = useState<{ schemaTable: string; resolvedTable: string | null }[]>([]);
  const [migrationOrder, setMigrationOrder] = useState<MigrationOrderItem[]>([]);
  const [showEmptyModal, setShowEmptyModal] = useState(false);
  const [collectModalPage, setCollectModalPage] = useState(0);

  // ── step 5: validate + migrate ──
  const [validateState, setValidateState] = useState<PhaseState>("idle");
  const [validateError, setValidateError] = useState("");
  const [stage1Issues, setStage1Issues] = useState<ValidationIssue[]>([]);
  const [stage2Issues, setStage2Issues] = useState<ValidationIssue[]>([]);
  const [migrateState, setMigrateState] = useState<PhaseState>("idle");
  const [migrateError, setMigrateError] = useState("");
  const [migrateTables, setMigrateTables] = useState<RunResponse["tables"]>([]);
  const [migrateVersion, setMigrateVersion] = useState("");

  // ── fix-rows modal ──
  const [showFixModal, setShowFixModal] = useState(false);
  const [invalidRows, setInvalidRows] = useState<InvalidRow[]>([]);
  const [rowPatches, setRowPatches] = useState<Record<string, Record<string, string>>>({});
  const [fixModalLoading, setFixModalLoading] = useState(false);
  const [fixModalError, setFixModalError] = useState("");

  const activeConnection = connections.find((c) => c.uuid === activeConnectionId) ?? null;

  // ── migration state persistence ───────────────────────────────────────────

  const persistMigrationState = useCallback(async (patch: Record<string, unknown>) => {
    if (!hasProject) return;
    await fetch("/api/migration-state", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, ...patch }),
    }).catch(() => {/* best-effort */});
  }, [hasProject, projectId]);

  // Load session history + restore workflow state on mount / project switch
  useEffect(() => {
    if (!hasProject) return;
    let cancelled = false;

    async function loadAll() {
      // Load session history for this project
      const sessRes = await fetch(`/api/migration-state?list=true&projectId=${projectId}`).catch(() => null);
      if (sessRes?.ok && !cancelled) {
        const list = await sessRes.json() as MigrationSession[];
        if (!cancelled) setSessions(list);
      }

      // Restore active workflow state
      const res = await fetch(`/api/migration-state?projectId=${projectId}`).catch(() => null);
      if (!res?.ok || cancelled) return;
      type SavedState = {
        connectionId: string | null; syncVersion: string | null; targetVersion: string | null;
        dataTimestamp: string | null; snapshotId: string | null;
        snapshot: {
          tableCount: number; rowCount: number;
          tables: { name: string; count: number }[];
          collectedAt: string;
        } | null;
        zodGenerated: boolean; schemaCheckPassed: boolean;
        validationPassed: boolean; runLogPath: string | null;
      };
      const state = await res.json() as SavedState | null;
      if (!state || cancelled) return;
      if (state.connectionId) { setActiveConnectionId(state.connectionId); setConnectState("success"); }
      if (state.syncVersion)  setSyncVersion(state.syncVersion);
      if (state.targetVersion) setTargetVersion(state.targetVersion);
      if (state.zodGenerated)  setModelDiffState("success");
      if (state.schemaCheckPassed) setSchemaCheckState("success");
      if (state.snapshotId && state.snapshot) {
        // Restore directly from the joined snapshot — no extra round-trip needed
        setCollectTimestamp(state.snapshot.collectedAt);
        setCollectTables(state.snapshot.tables);
        setCollectTotal(state.snapshot.rowCount);
        setCollectState("success");
      } else if (state.dataTimestamp) {
        // Backward-compat: old records without snapshot_id
        setCollectTimestamp(state.dataTimestamp);
        setCollectState("success");
      }
      if (state.validationPassed) setValidateState("success");
      if (state.runLogPath) setMigrateState("success");
      if (state.zodGenerated || state.schemaCheckPassed || state.snapshotId || state.dataTimestamp || state.validationPassed || state.runLogPath) {
        setMigrationPlan("version");
      }
    }

    void loadAll();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // Derived gating
  const isNewPlan = migrationPlan === "new";
  const isVersionPlan = migrationPlan === "version";
  const canModelDiff: boolean = connectState === "success" && canVersionMigrate && !!syncVersion && !!targetVersion && syncVersion !== targetVersion;
  const canSchemaCheck: boolean = modelDiffState === "success";
  const canCollect: boolean = schemaCheckState === "success" && (schemaCheckResult?.bothValid ?? false);
  const canMigrate: boolean = collectState === "success";

  const allIssues = [...stage1Issues, ...stage2Issues];
  const errorCount = allIssues.filter((i) => i.severity === "error").length;

  const collectBtnDisabled = collectState === "loading" || undefined;
  const validateBtnDisabled = validateState === "loading" || undefined;
  const migrateBtnDisabled =
    migrateState === "loading" ||
    (validateState === "success" && errorCount > 0) ||
    undefined;

  // ── reset helpers ─────────────────────────────────────────────────────────

  function resetFromModelDiff() {
    setModelDiffState("idle");
    setSchemaCheckState("idle");
    setSchemaCheckResult(null);
    setCollectState("idle");
    setCollectError("");
    setCollectTimestamp("");
    setCollectTables([]);
    setCollectTotal(0);
    setCollectQueryError("");
    setCollectMismatches([]);
    setMigrationOrder([]);
    setShowEmptyModal(false);
    resetFromValidate();
  }

  function resetFromValidate() {
    setValidateState("idle");
    setValidateError("");
    setStage1Issues([]);
    setStage2Issues([]);
    setMigrateState("idle");
    setMigrateError("");
    setMigrateTables([]);
    setMigrateVersion("");
    setShowFixModal(false);
    setInvalidRows([]);
    setRowPatches({});
    setFixModalError("");
  }

  function changePlan(plan: MigrationPlan) {
    if (plan === migrationPlan) return;
    setMigrationPlan(plan);
    setPushState("idle");
    setPushError("");
    resetFromModelDiff();
  }

  // ─── load connections ────────────────────────────────────────────────────

  const loadConnections = useCallback(async () => {
    if (!projectName) return;
    setLoadingConnections(true);
    try {
      const res = await fetch(`/api/migrations/connections?projectName=${encodeURIComponent(projectName)}`);
      const data: ConnectionsResponse = await res.json();
      setConnections(data.connections ?? []);
    } catch {
      // silent
    } finally {
      setLoadingConnections(false);
    }
  }, [projectName]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadConnections();
  }, [loadConnections]);

  // ─── select existing connection ──────────────────────────────────────────

  const selectConnection = (uuid: string) => {
    setActiveConnectionId(uuid);
    setShowNewForm(false);
    setConnectState("success");
    setConnectError("");
    setRemoteTables([]);
    setDbTableCount(null); // unknown until re-probed
    resetFromModelDiff();
  };

  // ─── delete connection ───────────────────────────────────────────────────

  const handleDelete = async (uuid: string) => {
    setDeletingId(uuid);
    try {
      await fetch(
        `/api/migrations/connections?projectName=${encodeURIComponent(projectName)}&uuid=${uuid}`,
        { method: "DELETE" },
      );
      setConnections((prev) => prev.filter((c) => c.uuid !== uuid));
      if (activeConnectionId === uuid) {
        setActiveConnectionId("");
        setConnectState("idle");
        setDbTableCount(null);
        resetFromModelDiff();
      }
    } finally {
      setDeletingId("");
    }
  };

  // ─── test + create connection ────────────────────────────────────────────

  const handleConnect = async () => {
    setConnectState("loading");
    setConnectError("");

    try {
      const res = await fetch("/api/migrations/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectName,
          connectionName: connectionName || `${provider} — ${host}:${port}/${database}`,
          provider,
          host,
          port,
          user: dbUser,
          password,
          database,
        }),
      });
      const data: ConnectResponse = await res.json();
      if (!data.success) throw new Error(data.error ?? "Connection failed.");

      setActiveConnectionId(data.uuid!);
      setRemoteTables(data.tables ?? []);
      setConnectState("success");
      setShowNewForm(false);
      await loadConnections();
      resetFromModelDiff();

      // Detect empty DB and auto-select plan
      const tableCount = data.tables?.length ?? 0;
      setDbTableCount(tableCount);
      if (tableCount === 0) {
        setMigrationPlan("new");
        setPushState("idle");
        setPushError("");
      }

      void persistMigrationState({ connectionId: data.uuid });
    } catch (err) {
      setConnectError(err instanceof Error ? err.message : "Connection failed.");
      setConnectState("error");
    }
  };

  // ─── new migration: push schema ───────────────────────────────────────────

  const handlePushNew = async () => {
    setPushState("loading");
    setPushError("");
    try {
      const res = await fetch("/api/migrations/push-new", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectName, connectionId: activeConnectionId, targetVersion: newTargetVersion }),
      });
      const data = await res.json() as PushNewResponse;
      if (!data.success) throw new Error(data.error ?? "Push failed.");
      setPushState("success");
    } catch (err) {
      setPushError(err instanceof Error ? err.message : "Push failed.");
      setPushState("error");
    }
  };

  // ─── schema check ────────────────────────────────────────────────────────

  const handleSchemaCheck = async () => {
    setSchemaCheckState("loading");
    setSchemaCheckResult(null);

    try {
      const res = await fetch("/api/migrations/schema-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectName, syncVersion, targetVersion }),
      });
      const data: SchemaCheckResponse = await res.json();
      if (!data.success) throw new Error(data.error ?? "Schema check failed.");
      setSchemaCheckResult(data);
      setSchemaCheckState(data.bothValid ? "success" : "error");
      void persistMigrationState({ schemaCheckPassed: Boolean(data.bothValid) });
    } catch (err) {
      setSchemaCheckState("error");
      setSchemaCheckResult({ success: false, error: err instanceof Error ? err.message : "Schema check failed." });
    }
  };

  // ─── collect ─────────────────────────────────────────────────────────────

  const handleCollect = async () => {
    setCollectState("loading");
    setCollectError("");
    setCollectTimestamp("");
    setCollectTables([]);
    setCollectTotal(0);
    setCollectQueryError("");
    resetFromValidate();

    try {
      const res = await fetch("/api/migrations/collect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectName, connectionId: activeConnectionId, syncVersion, targetVersion }),
      });
      const data: CollectResponse = await res.json();
      if (!data.success) throw new Error(data.error ?? "Collect failed.");
      setCollectTimestamp(data.timestamp ?? "");
      setCollectTables(data.tables ?? []);
      setCollectTotal(data.totalRecords ?? 0);
      setCollectQueryError(data.collectError ?? "");
      setCollectMismatches(data.tableMismatches ?? []);
      setMigrationOrder(data.migrationOrder ?? []);
      setCollectModalPage(0);
      setShowEmptyModal(true);
      setCollectState("idle");
      if (data.snapshotId) void persistMigrationState({ snapshotId: data.snapshotId, dataTimestamp: data.timestamp ?? null });
      else if (data.timestamp) void persistMigrationState({ dataTimestamp: data.timestamp });
    } catch (err) {
      setCollectError(err instanceof Error ? err.message : "Collect failed.");
      setCollectState("error");
    }
  };

  // ─── validate ────────────────────────────────────────────────────────────

  const handleValidate = async () => {
    setValidateState("loading");
    setValidateError("");
    setStage1Issues([]);
    setStage2Issues([]);

    try {
      const res = await fetch("/api/migrations/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectName,
          connectionId: activeConnectionId,
          syncVersion,
          targetVersion,
          dataTimestamp: collectTimestamp,
        }),
      });
      const data: ValidateResponse = await res.json();
      if (!data.success) throw new Error(data.error ?? "Validation failed.");
      setStage1Issues(data.stage1Issues ?? []);
      setStage2Issues(data.stage2Issues ?? []);
      setValidateState("success");
      void persistMigrationState({ validationPassed: !(data.stage1Issues ?? []).concat(data.stage2Issues ?? []).some((i) => i.severity === "error") });
    } catch (err) {
      setValidateError(err instanceof Error ? err.message : "Validation failed.");
      setValidateState("error");
    }
  };

  // ─── shared migrate result handler ────────────────────────────────────────

  function applyMigrateSuccess(data: RunResponse) {
    setMigrateTables(data.tables ?? []);
    if (data.migrationOrder) setMigrationOrder(data.migrationOrder);
    setMigrateVersion(data.newVersion ?? targetVersion);
    setMigrateState("success");
    if (data.stage1Issues?.length) setStage1Issues(data.stage1Issues);
    void persistMigrationState({ runLogPath: data.logPath ?? null });
    fetch(`/api/migration-state?list=true&projectId=${projectId}`)
      .then((r) => r.json())
      .then((list) => setSessions(list as MigrationSession[]))
      .catch(() => {/* best-effort */});
  }

  // ─── migrate ─────────────────────────────────────────────────────────────

  const handleMigrate = async () => {
    setMigrateState("loading");
    setMigrateError("");
    setMigrateTables([]);
    setMigrateVersion("");
    setShowFixModal(false);
    setInvalidRows([]);
    setRowPatches({});
    setFixModalError("");

    try {
      const res = await fetch("/api/migrations/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectName,
          connectionId: activeConnectionId,
          syncVersion,
          targetVersion,
          dataTimestamp: collectTimestamp,
        }),
      });
      const data: RunResponse = await res.json();

      if (data.needsFix) {
        setInvalidRows(data.invalidRows ?? []);
        setStage1Issues(data.stage1Issues ?? []);
        setStage2Issues(data.stage2Issues ?? []);
        setShowFixModal(true);
        setMigrateState("idle");
        return;
      }

      if (!data.success) throw new Error(data.error ?? "Migration failed.");
      applyMigrateSuccess(data);
    } catch (err) {
      setMigrateError(err instanceof Error ? err.message : "Migration failed.");
      setMigrateState("error");
    }
  };

  // ─── fix modal: re-validate and run with patches ──────────────────────────

  const handleFixAndMigrate = async () => {
    setFixModalLoading(true);
    setFixModalError("");

    try {
      const res = await fetch("/api/migrations/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectName,
          connectionId: activeConnectionId,
          syncVersion,
          targetVersion,
          dataTimestamp: collectTimestamp,
          rowPatches,
        }),
      });
      const data: RunResponse = await res.json();

      if (data.needsFix) {
        setInvalidRows(data.invalidRows ?? []);
        setStage2Issues(data.stage2Issues ?? []);
        // Stay in modal — user sees updated errors
        return;
      }

      if (!data.success) throw new Error(data.error ?? "Migration failed.");

      setShowFixModal(false);
      setInvalidRows([]);
      setRowPatches({});
      applyMigrateSuccess(data);
    } catch (err) {
      setFixModalError(err instanceof Error ? err.message : "Migration failed.");
    } finally {
      setFixModalLoading(false);
    }
  };

  // ─── empty state ─────────────────────────────────────────────────────────

  if (!hasProject) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-8 text-center">
        <p className="text-slate-600">Select a project to configure migrations.</p>
      </div>
    );
  }

  // ─── render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="rounded-lg border border-slate-200 bg-white px-5 py-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Migrations</p>
            <h3 className="mt-1 text-xl font-semibold text-slate-950">Schema Migration Workflow</h3>
            <p className="mt-1 text-sm text-slate-500">
              Connect to a database, then deploy a fresh schema or migrate data between versions.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600">
              {provider}
            </span>
            <span className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600">
              {projectName}
            </span>
            {migrationPlan && (isNewPlan ? newTargetVersion : targetVersion) && (
              <span className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600">
                Target: {isNewPlan ? newTargetVersion : targetVersion}
              </span>
            )}
            {activeConnection && (
              <span className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                ● {activeConnection.name}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Session History ───────────────────────────────────────────────── */}
      {sessions.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Session History</p>
            <p className="mt-0.5 text-sm text-slate-500">Past migration runs for this project. Click a row to resume.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                  <th className="px-4 py-2.5 text-left">Project</th>
                  <th className="px-4 py-2.5 text-left">From</th>
                  <th className="px-4 py-2.5 text-left">To</th>
                  <th className="px-4 py-2.5 text-right">Tables</th>
                  <th className="px-4 py-2.5 text-right">Rows</th>
                  <th className="px-4 py-2.5 text-left">Snapshot</th>
                  <th className="px-4 py-2.5 text-left">Run</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sessions.map((s) => (
                  <tr
                    key={s.id}
                    className="group hover:bg-slate-50 transition"
                  >
                    <td className="px-4 py-3 font-semibold text-slate-800">{s.projectName}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-700">{s.fromVersion}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-700">{s.toVersion}</td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-slate-600">
                      {s.collectTableCount ?? <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-slate-600">
                      {s.collectRowCount != null ? s.collectRowCount.toLocaleString() : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-500">
                      {s.collectTimestamp ?? <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {s.runStatus ? (
                        <span className={classNames(
                          "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                          s.runStatus === "success" ? "bg-emerald-100 text-emerald-700" :
                          s.runStatus === "partial"  ? "bg-amber-100 text-amber-700" :
                                                       "bg-rose-100 text-rose-700",
                        )}>
                          {s.runStatus}
                        </span>
                      ) : (
                        <span className="text-slate-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setMigrationPlan("version");
                          setSyncVersion(s.fromVersion);
                          setTargetVersion(s.toVersion);
                          setActiveConnectionId(s.connectionId);
                          setConnectState("success");
                          if (s.collectTimestamp) {
                            setCollectTimestamp(s.collectTimestamp);
                            setCollectState("success");
                            if (s.collectTables) {
                              setCollectTables(s.collectTables);
                              setCollectTotal(s.collectRowCount ?? 0);
                            }
                          }
                          void persistMigrationState({
                            connectionId: s.connectionId,
                            syncVersion: s.fromVersion,
                            targetVersion: s.toVersion,
                            dataTimestamp: s.collectTimestamp,
                          });
                        }}
                        className="rounded-md border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 opacity-0 group-hover:opacity-100"
                      >
                        Resume
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Migration Type Selector ───────────────────────────────────────── */}
      <div className="rounded-lg border border-slate-200 bg-white px-5 py-4 shadow-sm">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
          Migration Type
        </p>

        {!canDoAnyMigration ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-sm font-semibold text-amber-700">
              At least one project version is required to run a migration.
            </p>
            <p className="mt-1 text-xs text-amber-600">
              Go to the Projects workspace and create a version before continuing.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">

            {/* New Migration option */}
            <button
              type="button"
              onClick={() => changePlan("new")}
              className={classNames(
                "rounded-lg border-2 p-4 text-left transition",
                isNewPlan
                  ? "border-cyan-500 bg-cyan-50"
                  : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50",
              )}
            >
              <div className="flex items-start gap-3">
                <span className={classNames(
                  "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition",
                  isNewPlan ? "border-cyan-500 bg-cyan-500" : "border-slate-300",
                )}>
                  {isNewPlan && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-950">New Migration</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Push a schema version to a fresh database with no existing tables.
                  </p>
                  {dbIsEmpty && (
                    <span className="mt-2 inline-block rounded-full bg-cyan-100 px-2 py-0.5 text-[10px] font-semibold text-cyan-700">
                      Empty DB detected
                    </span>
                  )}
                </div>
              </div>
            </button>

            {/* Version Migration option */}
            <button
              type="button"
              onClick={() => { if (!dbIsEmpty && canVersionMigrate) changePlan("version"); }}
              disabled={dbIsEmpty || !canVersionMigrate || undefined}
              className={classNames(
                "rounded-lg border-2 p-4 text-left transition",
                isVersionPlan
                  ? "border-cyan-500 bg-cyan-50"
                  : dbIsEmpty || !canVersionMigrate
                  ? "cursor-not-allowed border-slate-200 bg-slate-50 opacity-50"
                  : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50",
              )}
            >
              <div className="flex items-start gap-3">
                <span className={classNames(
                  "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition",
                  isVersionPlan ? "border-cyan-500 bg-cyan-500" : "border-slate-300",
                )}>
                  {isVersionPlan && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-950">Version Migration</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Collect existing data, validate, and migrate between schema versions.
                  </p>
                  {dbIsEmpty && (
                    <span className="mt-2 inline-block rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                      DB is empty — use New Migration
                    </span>
                  )}
                  {!canVersionMigrate && !dbIsEmpty && (
                    <span className="mt-2 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                      Requires 2+ project versions
                    </span>
                  )}
                </div>
              </div>
            </button>
          </div>
        )}

        {/* Version selectors — only shown for version migration */}
        {isVersionPlan && (
          <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-slate-100 pt-4">
            <div className="flex min-w-[220px] flex-1 flex-col gap-1">
              <Label>Database is currently at</Label>
              <select
                value={syncVersion}
                onChange={(e) => {
                  const v = e.target.value;
                  setSyncVersion(v);
                  setTargetVersion("");
                  resetFromModelDiff();
                  void persistMigrationState({ syncVersion: v, targetVersion: null, zodGenerated: false, schemaCheckPassed: false, dataTimestamp: null, snapshotId: null, validationPassed: false, runLogPath: null });
                }}
                className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-slate-500"
              >
                <option key="__sync-placeholder__" value="" disabled>Select a version…</option>
                {versions.map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>

            {syncVersion && (
              <>
                <span className="mb-2 shrink-0 text-slate-400">→</span>
                <div className="flex min-w-[220px] flex-1 flex-col gap-1">
                  <Label>Migrate to</Label>
                  <select
                    value={targetVersion}
                    onChange={(e) => {
                      setTargetVersion(e.target.value);
                      resetFromModelDiff();
                      void persistMigrationState({ targetVersion: e.target.value, zodGenerated: false, schemaCheckPassed: false, dataTimestamp: null, snapshotId: null, validationPassed: false, runLogPath: null });
                    }}
                    className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-slate-500"
                  >
                    <option key="__target-placeholder__" value="" disabled>Select a version…</option>
                    {versions.filter((v) => v !== syncVersion).map((v) => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Step 1: Connection management ─────────────────────────────────── */}
      <Card locked={!canDoAnyMigration || migrationPlan === null}>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <StepBadge n={1} state={connectState} />
              <div>
                <p className="text-sm font-semibold text-slate-950">Database Connection</p>
                <p className="text-xs text-slate-500">
                  Select a saved connection or add a new one.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <StateChip state={connectState} />
              <button
                type="button"
                onClick={() => { setShowNewForm((v) => !v); setConnectError(""); }}
                className="h-8 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                {showNewForm ? "Cancel" : "+ New Connection"}
              </button>
            </div>
          </div>
        </CardHeader>

        <CardBody>
          {/* Saved connections list */}
          {loadingConnections ? (
            <p className="text-sm text-slate-500">Loading connections…</p>
          ) : connections.length > 0 ? (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Saved Connections
              </p>
              <div className="divide-y divide-slate-100 rounded-md border border-slate-200">
                {connections.map((conn) => {
                  const isActive = conn.uuid === activeConnectionId;
                  return (
                    <div
                      key={conn.uuid}
                      className={classNames(
                        "flex items-center justify-between gap-3 px-4 py-3 transition",
                        isActive ? "bg-emerald-50" : "bg-white hover:bg-slate-50",
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => selectConnection(conn.uuid)}
                        className="flex min-w-0 flex-1 items-center gap-3 text-left"
                      >
                        <span
                          className={classNames(
                            "shrink-0 h-2 w-2 rounded-full",
                            isActive ? "bg-emerald-500" : "bg-slate-300",
                          )}
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-950">
                            {conn.name}
                          </p>
                          <p className="text-xs text-slate-500">
                            {conn.host}:{conn.port} / {conn.database}
                          </p>
                        </div>
                        <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">
                          {shortUuid(conn.uuid)}
                        </span>
                        <span className="shrink-0 text-[11px] text-slate-400">
                          {new Date(conn.lastUsedAt).toLocaleDateString()}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(conn.uuid)}
                        disabled={deletingId === conn.uuid || undefined}
                        className="shrink-0 rounded px-2 py-1 text-xs font-semibold text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed"
                      >
                        {deletingId === conn.uuid ? "…" : "Remove"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : !showNewForm ? (
            <p className="text-sm text-slate-500">
              No connections saved yet.{" "}
              <button
                type="button"
                onClick={() => setShowNewForm(true)}
                className="font-semibold text-slate-700 underline underline-offset-2"
              >
                Add one
              </button>
            </p>
          ) : null}

          {/* New connection form */}
          {showNewForm && (
            <div className="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                New Connection
              </p>

              <div className="flex flex-col gap-1">
                <Label>Connection Name</Label>
                <Input value={connectionName} onChange={setConnectionName} placeholder="e.g. Production DB" />
              </div>

              {isSQLite ? (
                <div className="flex flex-col gap-1">
                  <Label>SQLite File Path</Label>
                  <Input value={database} onChange={setDatabase} placeholder="./path/to/database.db" />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                  <div className="col-span-2 lg:col-span-2 flex flex-col gap-1">
                    <Label>Host / IP</Label>
                    <Input value={host} onChange={setHost} placeholder="localhost" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label>Port</Label>
                    <Input value={port} onChange={setPort} placeholder="5432" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label>Username</Label>
                    <Input value={dbUser} onChange={setDbUser} placeholder="postgres" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label>Password</Label>
                    <Input value={password} onChange={setPassword} type="password" placeholder="••••••••" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label>Database</Label>
                    <Input value={database} onChange={setDatabase} placeholder="mydb" />
                  </div>
                </div>
              )}

              {connectError && <ErrorBox message={connectError} />}

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => void handleConnect()}
                  disabled={connectState === "loading" || undefined}
                  className="h-9 min-w-40 rounded-md bg-slate-800 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {connectState === "loading" ? "Connecting…" : "Test & Save Connection"}
                </button>
              </div>
            </div>
          )}

          {/* Active connection badge */}
          {activeConnection && !showNewForm && (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="text-sm font-semibold text-emerald-800">
                  ● Active: {activeConnection.name}
                </span>
                <span className="font-mono text-xs text-emerald-700">
                  uuid: {activeConnection.uuid}
                </span>
                <span className="text-xs text-emerald-700">
                  {activeConnection.host}:{activeConnection.port} / {activeConnection.database}
                </span>
                <span className="text-xs text-emerald-600">{activeConnection.provider}</span>
              </div>
            </div>
          )}

          {/* Live tables from connect introspection */}
          {remoteTables.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Tables in DB ({remoteTables.length})
              </p>
              <div className="flex flex-wrap gap-2">
                {remoteTables.map((t) => (
                  <span key={t} className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      {/* ── Step 2 (New Migration): Deploy Schema ─────────────────────────── */}
      {isNewPlan && (
        <Card locked={connectState !== "success"}>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <StepBadge n={2} state={pushState} />
                <div>
                  <p className="text-sm font-semibold text-slate-950">Deploy Schema</p>
                  <p className="text-xs text-slate-500">
                    Select a version and push the schema to the empty database.
                  </p>
                </div>
              </div>
              <StateChip state={pushState} />
            </div>
          </CardHeader>

          <CardBody>
            <div className="flex flex-wrap items-end gap-4">
              <div className="flex flex-col gap-1">
                <Label>Deploy version</Label>
                <select
                  value={newTargetVersion}
                  onChange={(e) => {
                    setNewTargetVersion(e.target.value);
                    setPushState("idle");
                    setPushError("");
                  }}
                  className="h-9 min-w-40 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-slate-500"
                >
                  {versions.map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={() => void handlePushNew()}
                disabled={pushState === "loading" || pushState === "success" || undefined}
                className="h-9 min-w-44 rounded-md bg-slate-800 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {pushState === "loading" ? "Deploying…" : pushState === "success" ? "Deployed ✓" : "Deploy Schema"}
              </button>

              {pushState === "success" && (
                <button
                  type="button"
                  onClick={() => { setPushState("idle"); setPushError(""); }}
                  className="h-9 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Deploy Again
                </button>
              )}
            </div>

            {pushState === "success" && (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3">
                <p className="text-sm font-semibold text-emerald-700">
                  ✓ Schema version {newTargetVersion} successfully deployed to the database.
                </p>
              </div>
            )}

            {pushError && <ErrorBox message={pushError} />}
          </CardBody>
        </Card>
      )}

      {/* ── Steps 2–5 (Version Migration) ─────────────────────────────────── */}
      {isVersionPlan && (
        <>
          {/* ── Step 2: Model Diff ──────────────────────────────────────────── */}
          <Card locked={!canModelDiff}>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <StepBadge n={2} state={modelDiffState} />
                  <div>
                    <p className="text-sm font-semibold text-slate-950">Model Diff</p>
                    <p className="text-xs text-slate-500">
                      Open the diff to compare versions and generate Zod validators.
                    </p>
                  </div>
                </div>
                <StateChip state={modelDiffState} />
              </div>
            </CardHeader>

            <CardBody>
              <ModelDiff
                inline
                projectName={projectName}
                versions={versions}
                fromVersion={syncVersion}
                toVersion={targetVersion}
                onZodGenerated={() => { setModelDiffState("success"); void persistMigrationState({ zodGenerated: true }); }}
                onOpenFullScreen={() => setShowModelDiffModal(true)}
              />
            </CardBody>
          </Card>

          {/* ── Step 3: Validate Schemas ─────────────────────────────────────── */}
          <Card locked={!canSchemaCheck}>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <StepBadge n={3} state={schemaCheckState} />
                  <div>
                    <p className="text-sm font-semibold text-slate-950">Validate Schemas</p>
                    <p className="text-xs text-slate-500">
                      Run <code className="font-mono text-[11px]">prisma validate</code> on both schema versions before touching the database.
                    </p>
                  </div>
                </div>
                <StateChip state={schemaCheckState} />
              </div>
            </CardHeader>

            <CardBody>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  { label: "Source schema", version: syncVersion, result: schemaCheckResult?.sync },
                  { label: "Target schema", version: targetVersion, result: schemaCheckResult?.target },
                ].map(({ label, version, result }) => (
                  <div
                    key={label}
                    className={classNames(
                      "rounded-lg border p-4",
                      !result ? "border-slate-200 bg-slate-50" :
                      result.valid ? "border-emerald-200 bg-emerald-50" : "border-rose-200 bg-rose-50",
                    )}
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">{label}</p>
                    <p className="mt-1 font-mono text-sm font-semibold text-slate-800">{version}.prisma</p>
                    {result && (
                      <p className={classNames(
                        "mt-1 text-xs font-semibold",
                        result.valid ? "text-emerald-700" : "text-rose-700",
                      )}>
                        {result.valid ? "✓ Valid" : `✗ ${result.errors.length} error${result.errors.length !== 1 ? "s" : ""}`}
                      </p>
                    )}
                    {result && !result.valid && result.errors.length > 0 && (
                      <div className="mt-2 max-h-40 overflow-y-auto rounded-md bg-rose-100/60 p-2">
                        {result.errors.map((e, i) => (
                          <p key={i} className="font-mono text-[10px] text-rose-800">{e}</p>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {schemaCheckState === "error" && !schemaCheckResult?.sync && !schemaCheckResult?.target && (
                <ErrorBox message={schemaCheckResult?.error ?? "Schema check failed."} />
              )}

              {schemaCheckState === "error" && (schemaCheckResult?.sync || schemaCheckResult?.target) && (
                <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3">
                  <p className="text-sm font-semibold text-rose-700">
                    One or more schemas have validation errors. Fix them in the /schema workflow before proceeding.
                  </p>
                </div>
              )}

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => void handleSchemaCheck()}
                  disabled={schemaCheckState === "loading" || undefined}
                  className="h-9 min-w-44 rounded-md bg-slate-800 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {schemaCheckState === "loading" ? "Validating…" : "Validate Both Schemas"}
                </button>
              </div>
            </CardBody>
          </Card>

          {/* ── Step 4: Collect Data ─────────────────────────────────────────── */}
          <Card locked={!canCollect}>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <StepBadge n={4} state={collectState} />
                  <div>
                    <p className="text-sm font-semibold text-slate-950">Collect Data</p>
                    <p className="text-xs text-slate-500">
                      Query all tables from the source database and store a local snapshot.
                    </p>
                  </div>
                </div>
                <StateChip state={collectState} />
              </div>
            </CardHeader>

            <CardBody>
              {collectState === "success" && collectTables.length > 0 && (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2.5">
                    <span className="text-sm font-semibold text-emerald-800">✓ Snapshot collected</span>
                    <span className="text-emerald-300">·</span>
                    <span className="text-xs text-emerald-700">{collectTables.length} table{collectTables.length !== 1 ? "s" : ""}</span>
                    <span className="text-emerald-300">·</span>
                    <span className="text-xs font-semibold text-emerald-700">{collectTotal.toLocaleString()} rows total</span>
                    <span className="ml-auto font-mono text-[11px] text-emerald-600">{collectTimestamp}</span>
                  </div>

                  {(() => {
                    const maxCount = Math.max(...collectTables.map((t) => t.count), 1);
                    return (
                      <div className="overflow-hidden rounded-md border border-slate-200">
                        <div className="grid grid-cols-[minmax(0,1fr)_minmax(80px,35%)_4.5rem] items-center gap-4 border-b border-slate-200 bg-slate-50 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                          <span>Table</span>
                          <span>Distribution</span>
                          <span className="text-right">Rows</span>
                        </div>
                        {collectTables.map((t) => (
                          <div
                            key={t.name}
                            className="grid grid-cols-[minmax(0,1fr)_minmax(80px,35%)_4.5rem] items-center gap-4 border-b border-slate-100 px-4 py-2.5 last:border-0 hover:bg-slate-50"
                          >
                            <span className="truncate font-mono text-xs font-semibold text-slate-800">{t.name}</span>
                            <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                              <div
                                className="h-full rounded-full bg-slate-500 transition-all duration-500"
                                style={{ width: `${Math.max((t.count / maxCount) * 100, t.count > 0 ? 2 : 0)}%` }}
                              />
                            </div>
                            <span className="text-right font-mono text-xs text-slate-600">
                              {t.count.toLocaleString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    );
                  })()}

                  {migrationOrder.length > 0 && (
                    <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Migration order</p>
                      <p className="mt-1 font-mono text-xs text-slate-700">
                        {migrationOrder.map((item) => item.modelName).join(" -> ")}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {collectError && <ErrorBox message={collectError} />}

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => void handleCollect()}
                  disabled={collectBtnDisabled}
                  className="h-9 min-w-48 rounded-md bg-slate-800 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {collectState === "loading" ? "Collecting…" : "Collect All Tables"}
                </button>
              </div>
            </CardBody>
          </Card>

          {/* ── Step 5: Validate & Migrate ───────────────────────────────────── */}
          <Card locked={!canMigrate}>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <StepBadge n={5} state={migrateState} />
                  <div>
                    <p className="text-sm font-semibold text-slate-950">Validate & Migrate</p>
                    <p className="text-xs text-slate-500">
                      Validate collected data, then reset and migrate the target database table by table.
                    </p>
                  </div>
                </div>
                <StateChip state={migrateState} />
              </div>
            </CardHeader>

            <CardBody>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="grid gap-4 sm:grid-cols-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Connection</p>
                    <p className="mt-1 text-sm font-semibold text-slate-950 truncate">{activeConnection?.name ?? "—"}</p>
                    <p className="font-mono text-[10px] text-slate-400">{activeConnection ? shortUuid(activeConnection.uuid) : ""}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">From</p>
                    <p className="mt-1 text-sm font-semibold text-slate-950">{syncVersion}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">To</p>
                    <p className="mt-1 text-sm font-semibold text-slate-950">{targetVersion}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Snapshot</p>
                    <p className="mt-1 font-mono text-xs text-slate-700">{collectTimestamp || "—"}</p>
                  </div>
                </div>
              </div>

              {/* Step A — Validate */}
              <div className="space-y-3 rounded-lg border border-slate-200 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-slate-800">Step A — Validate Data</p>
                    <p className="text-[11px] text-slate-500">Check collected rows against both schema versions using Zod.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {validateState !== "idle" && <StateChip state={validateState} />}
                    <button
                      type="button"
                      onClick={() => void handleValidate()}
                      disabled={validateBtnDisabled}
                      className="h-8 min-w-36 rounded-md bg-slate-800 px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      {validateState === "loading" ? "Validating…" : "Validate Data"}
                    </button>
                  </div>
                </div>

                {validateState === "success" && stage1Issues.length === 0 && stage2Issues.length === 0 && (
                  <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2.5">
                    <p className="text-sm font-semibold text-emerald-700">✓ All records pass both validation stages.</p>
                  </div>
                )}

                {validateError && <ErrorBox message={validateError} />}

                {validateState === "success" && (
                  <>
                    <IssueSection title="Stage 1 — Shape vs Source Schema" issues={stage1Issues} />
                    <IssueSection title="Stage 2 — Zod vs Target Schema" issues={stage2Issues} />
                  </>
                )}
              </div>

              {validateState === "success" && errorCount > 0 && (
                <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3">
                  <p className="text-sm font-semibold text-rose-700">
                    {errorCount} blocking error{errorCount !== 1 ? "s" : ""} must be resolved before migrating.
                  </p>
                </div>
              )}

              {/* Step B — Migrate */}
              <div className="space-y-3 rounded-lg border border-slate-200 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-slate-800">Step B — Run Migration</p>
                    <p className="text-[11px] text-slate-500">Force-reset target schema, then upsert all validated records table by table.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleMigrate()}
                    disabled={migrateBtnDisabled}
                    className="h-8 min-w-36 rounded-md bg-slate-800 px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    {migrateState === "loading" ? "Migrating…" : "Run Migration"}
                  </button>
                </div>

                {migrateState === "success" && migrateTables && migrateTables.length > 0 && (
                  <div className="space-y-2">
                    <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2.5">
                      <p className="text-sm font-semibold text-emerald-700">
                        ✓ Migration complete — now at version {migrateVersion}
                      </p>
                    </div>
                    <div className="overflow-hidden rounded-md border border-slate-200">
                      <div className="grid grid-cols-4 border-b border-slate-200 bg-slate-50 px-4 py-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                        <span>Table</span>
                        <span>Created</span>
                        <span>Updated</span>
                        <span>Errors</span>
                      </div>
                      {migrateTables.map((t) => (
                        <div key={t.name} className="grid grid-cols-4 border-b border-slate-100 px-4 py-2.5 text-sm last:border-0 hover:bg-slate-50">
                          <span className="font-mono text-xs font-semibold text-slate-800">{t.name}</span>
                          <span className="text-emerald-700">{t.created}</span>
                          <span className="text-blue-700">{t.updated}</span>
                          <span className={t.errors > 0 ? "text-rose-700" : "text-slate-400"}>{t.errors}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {migrateError && <ErrorBox message={migrateError} />}
              </div>
            </CardBody>
          </Card>
        </>
      )}

      {/* ── Collect result modal (version migration only) ─────────────────── */}
      {isVersionPlan && showEmptyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
          <div className="flex w-full max-w-2xl flex-col rounded-lg border border-slate-200 bg-white shadow-2xl" style={{ maxHeight: "80vh" }}>

            <div className="shrink-0 border-b border-slate-200 px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Collect Data</p>
              <h3 className="mt-1 text-lg font-semibold text-slate-950">
                {(() => {
                  if (!collectQueryError) {
                    return collectTotal === 0
                      ? "No data found on database"
                      : `${collectTables.length} table${collectTables.length !== 1 ? "s" : ""} · ${collectTotal.toLocaleString()} rows`;
                  }
                  const allMissing = collectTables.length > 0 && collectTables.every((t) => t.count === 0);
                  return allMissing ? "Tables not found on database" : "Some tables could not be queried";
                })()}
              </h3>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-5 space-y-4">
              {collectMismatches.length > 0 && (
                <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3">
                  <p className="text-xs font-semibold text-rose-700">
                    {collectMismatches.filter((m) => !m.resolvedTable).length} schema table{collectMismatches.filter((m) => !m.resolvedTable).length !== 1 ? "s" : ""} not found in the database.
                    {" "}Check that your sync version matches the current database state, or update the schema with <span className="font-mono">@@map</span> to point at the real table name.
                  </p>
                  <div className="mt-2 space-y-1">
                    {collectMismatches.map((m) => (
                      <div key={m.schemaTable} className="flex items-center gap-2 font-mono text-[11px]">
                        <span className="rounded bg-rose-100 px-1.5 py-0.5 text-rose-700">{m.schemaTable}</span>
                        <span className="text-rose-400">→</span>
                        {m.resolvedTable
                          ? <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-700">{m.resolvedTable} (case-fixed)</span>
                          : <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-500">not found in DB</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {collectQueryError && (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3">
                  {(() => {
                    const allMissing = collectTables.length > 0 && collectTables.every((t) => t.count === 0);
                    const errors = collectQueryError.split(" | ");
                    return (
                      <>
                        <p className="text-xs font-semibold text-amber-700">
                          {allMissing
                            ? `None of the ${collectTables.length} tables exist on this database yet. Snapshot saved with 0 rows — you can proceed to migrate from scratch.`
                            : `${errors.length} table${errors.length !== 1 ? "s" : ""} could not be queried.`}
                        </p>
                        <div className="mt-2 max-h-40 overflow-y-auto space-y-0.5">
                          {errors.map((err, i) => (
                            <p key={i} className="font-mono text-[11px] text-amber-600">{err}</p>
                          ))}
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}

              {collectTables.length > 0 ? (() => {
                const PAGE_SIZE = 15;
                const totalPages = Math.ceil(collectTables.length / PAGE_SIZE);
                const page = collectTables.slice(
                  collectModalPage * PAGE_SIZE,
                  collectModalPage * PAGE_SIZE + PAGE_SIZE,
                );
                const padded = [
                  ...page,
                  ...Array.from({ length: PAGE_SIZE - page.length }, () => null),
                ];
                return (
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-2">
                      {padded.map((t, i) => (
                        <div
                          key={t ? t.name : `empty-${i}`}
                          className={classNames(
                            "rounded-md border px-3 py-2.5",
                            t ? "border-slate-200 bg-white" : "border-transparent",
                          )}
                        >
                          {t && (
                            <>
                              <p className="truncate font-mono text-[11px] font-semibold text-slate-800">{t.name}</p>
                              <p className={classNames(
                                "mt-0.5 font-mono text-xs",
                                t.count === 0 ? "text-slate-400" : "text-emerald-700 font-semibold",
                              )}>
                                {t.count.toLocaleString()} rows
                              </p>
                            </>
                          )}
                        </div>
                      ))}
                    </div>

                    {totalPages > 1 && (
                      <div className="flex items-center justify-between pt-1">
                        <button
                          type="button"
                          onClick={() => setCollectModalPage((p) => Math.max(0, p - 1))}
                          disabled={collectModalPage === 0 || undefined}
                          className="h-7 rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          ← Prev
                        </button>
                        <span className="text-xs text-slate-500">
                          Page {collectModalPage + 1} of {totalPages}
                          <span className="ml-2 text-slate-400">({collectTables.length} tables)</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => setCollectModalPage((p) => Math.min(totalPages - 1, p + 1))}
                          disabled={collectModalPage === totalPages - 1 || undefined}
                          className="h-7 rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Next →
                        </button>
                      </div>
                    )}
                  </div>
                );
              })() : (
                <p className="text-sm text-slate-600">
                  No models were found in schema version <span className="font-semibold">{syncVersion}</span>.
                </p>
              )}

              {collectTables.length > 0 && collectTotal === 0 && !collectQueryError && (
                <p className="text-xs text-slate-500">
                  All tables are empty. You can proceed to migrate the schema structure, or populate the database first and collect again.
                </p>
              )}
              {collectTables.length > 0 && collectTotal === 0 && collectQueryError && (
                <p className="text-xs text-slate-500">
                  Snapshots with 0 rows were saved for each table. Click Proceed Anyway to continue; the migration will create and populate the tables from scratch.
                </p>
              )}
              {migrationOrder.length > 0 && (
                <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Migration order</p>
                  <p className="mt-1 font-mono text-xs text-slate-700">
                    {migrationOrder.map((item) => item.modelName).join(" -> ")}
                  </p>
                </div>
              )}
            </div>

            <div className="shrink-0 flex items-center justify-end gap-3 border-t border-slate-200 px-5 py-4">
              <button
                type="button"
                onClick={() => setShowEmptyModal(false)}
                className="h-9 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              {collectTables.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setShowEmptyModal(false);
                    setCollectState("success");
                    void persistMigrationState({ dataTimestamp: collectTimestamp });
                    fetch(`/api/migration-state?list=true&projectId=${projectId}`).then((r) => r.json()).then((list) => setSessions(list as MigrationSession[])).catch(() => {/* best-effort */});
                  }}
                  className="h-9 min-w-32 rounded-md bg-slate-800 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700"
                >
                  {collectQueryError ? "Proceed Anyway" : "Proceed"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Fix-rows modal ───────────────────────────────────────────────── */}
      {showFixModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
          <div className="flex w-full max-w-4xl flex-col rounded-lg border border-slate-200 bg-white shadow-2xl" style={{ maxHeight: "85vh" }}>
            <div className="shrink-0 border-b border-slate-200 px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-rose-600">Validation Failed</p>
              <h3 className="mt-1 text-lg font-semibold text-slate-950">
                {invalidRows.length} row{invalidRows.length !== 1 ? "s" : ""} need to be fixed before migrating
              </h3>
              <p className="mt-0.5 text-sm text-slate-500">
                Edit the values below, then click <span className="font-semibold text-slate-700">Re-validate &amp; Run</span>.
              </p>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                    <th className="px-4 py-2.5 text-left">Model</th>
                    <th className="px-4 py-2.5 text-left">Row</th>
                    <th className="px-4 py-2.5 text-left">Field</th>
                    <th className="px-4 py-2.5 text-left w-56">Value</th>
                    <th className="px-4 py-2.5 text-left">Error</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {invalidRows.map((row, idx) => {
                    const patchKey = `${row.table}:${row.rowIndex}`;
                    const patchedValue = rowPatches[patchKey]?.[row.field];
                    const displayValue = patchedValue !== undefined ? patchedValue : String(row.value ?? "");
                    return (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="px-4 py-2.5 font-mono text-xs font-semibold text-slate-800">{row.table}</td>
                        <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{row.rowIndex}</td>
                        <td className="px-4 py-2.5 font-mono text-xs text-slate-700">{row.field}</td>
                        <td className="px-4 py-2.5">
                          <input
                            type="text"
                            value={displayValue}
                            onChange={(e) => {
                              setRowPatches((prev) => ({
                                ...prev,
                                [patchKey]: { ...(prev[patchKey] ?? {}), [row.field]: e.target.value },
                              }));
                            }}
                            className="h-7 w-full rounded border border-slate-300 bg-white px-2 font-mono text-xs text-slate-900 outline-none focus:border-slate-500"
                          />
                        </td>
                        <td className="px-4 py-2.5 text-xs text-rose-700">{row.error}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {fixModalError && (
              <div className="shrink-0 border-t border-rose-200 bg-rose-50 px-5 py-3">
                <p className="font-mono text-xs text-rose-700">{fixModalError}</p>
              </div>
            )}

            <div className="shrink-0 flex items-center justify-between gap-3 border-t border-slate-200 px-5 py-4">
              <p className="text-xs text-slate-500">
                {Object.keys(rowPatches).length > 0
                  ? `${Object.values(rowPatches).reduce((s, p) => s + Object.keys(p).length, 0)} field${Object.values(rowPatches).reduce((s, p) => s + Object.keys(p).length, 0) !== 1 ? "s" : ""} edited`
                  : "No edits yet"}
              </p>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => { setShowFixModal(false); setMigrateState("idle"); }}
                  className="h-9 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleFixAndMigrate()}
                  disabled={fixModalLoading || undefined}
                  className="h-9 min-w-44 rounded-md bg-slate-800 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  {fixModalLoading ? "Validating…" : "Re-validate & Run"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Full-screen Model Diff modal ─────────────────────────────────── */}
      {showModelDiffModal && (
        <ModelDiff
          projectName={projectName}
          versions={versions}
          fromVersion={syncVersion}
          toVersion={targetVersion}
          onClose={() => setShowModelDiffModal(false)}
          onZodGenerated={() => { setModelDiffState("success"); void persistMigrationState({ zodGenerated: true }); }}
        />
      )}
    </div>
  );
}
