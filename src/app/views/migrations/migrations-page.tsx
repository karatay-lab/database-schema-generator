"use client";

import { useCallback, useEffect, useState } from "react";
import { useProjectInfo } from "../shared/project-info-context";
import { useSchemaWarnings } from "@/hooks/use-schema-warnings";
import type { MigrationPlan } from "@/types/migrations";
import { SessionHistory } from "@/components/migrations/session-history";
import { MigrationTypeSelector } from "@/components/migrations/migration-type-selector";
import { ConnectionManagementCard } from "@/components/migrations/connection-management-card";
import { DeploySchemaCard } from "@/components/migrations/deploy-schema-card";
import { VersionMigrationSteps } from "@/components/migrations/version-migration-steps";
import { CollectResultModal } from "@/components/migrations/collect-result-modal";
import { DestroyDeployModal } from "@/components/migrations/destroy-deploy-modal";
import { PreflightModal } from "@/components/migrations/preflight-modal";
import { FixRowsModal } from "@/components/migrations/fix-rows-modal";
import { ConnectionStringModal } from "@/components/migrations/connection-string-modal";
import { MigrationProgressBar } from "@/components/migrations/migration-progress-bar";
import { MigrationPageHeader } from "@/components/migrations/migration-page-header";
import { useMigrationConnections } from "@/hooks/use-migration-connections";
import type {
  CheckSyncResponse,
  CollectResponse,
  InvalidRow,
  ModelComparisonResult,
  PhaseState,
  PushNewResponse,
  RunResponse,
  SchemaCheckResponse,
  TestConnectionResponse,
  ValidateResponse,
  ValidationIssue,
} from "@/types/migrations";

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

  // ── sync compatibility check ──
  const [syncCheckState, setSyncCheckState] = useState<"idle" | "loading" | "compatible" | "incompatible">("idle");
  const [syncCheckResult, setSyncCheckResult] = useState<CheckSyncResponse | null>(null);

  // ── new migration ──
  const [newTargetVersion, setNewTargetVersion] = useState(versions[versions.length - 1] ?? "");
  const [pushState, setPushState] = useState<PhaseState>("idle");
  const [pushError, setPushError] = useState("");
  const [lastPushMode, setLastPushMode] = useState<"safe" | "destroy" | null>(null);
  const [showDestroyModal, setShowDestroyModal] = useState(false);
  const [destroyConfirmText, setDestroyConfirmText] = useState("");
  const [destroyDbPreview, setDestroyDbPreview] = useState<{ tables: { name: string; count: number }[]; total: number } | null>(null);
  const [destroyDbPreviewLoading, setDestroyDbPreviewLoading] = useState(false);

  // ── version plan ──
  const [syncVersion, setSyncVersion] = useState("");
  const [targetVersion, setTargetVersion] = useState("");

  // ── step 2: model diff ──
  const [modelDiffState, setModelDiffState] = useState<PhaseState>("idle");
  const [showModelDiffModal, setShowModelDiffModal] = useState(false);
  const [comparison, setComparison] = useState<ModelComparisonResult | null>(null);

  // ── pre-flight modal ──
  const [showPreflightModal, setShowPreflightModal] = useState(false);
  const [preflightTab, setPreflightTab] = useState<"crucial" | "warning">("crucial");
  const [preflightPage, setPreflightPage] = useState(0);
  const PREFLIGHT_PAGE_SIZE = 8;

  // ── step 3: schema check ──
  const [schemaCheckState, setSchemaCheckState] = useState<PhaseState>("idle");
  const [schemaCheckResult, setSchemaCheckResult] = useState<SchemaCheckResponse | null>(null);

  // ── step 4: collect ──
  const [collectState, setCollectState] = useState<PhaseState>("idle");
  const [collectError, setCollectError] = useState("");
  const [collectTimestamp, setCollectTimestamp] = useState("");
  const [collectSnapshotId, setCollectSnapshotId] = useState<string | null>(null);
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

  // ── restore from snapshot ──
  const [restoreState, setRestoreState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [restoreError, setRestoreError] = useState("");
  const [restoreTables, setRestoreTables] = useState<{ name: string; created: number; updated: number; errors: number }[]>([]);

  // ── run progress (SSE) ──
  type MigrateProgressEvent = { name: string; created: number; updated: number; errors: number };
  const [migratePhase, setMigratePhase] = useState<"idle" | "schema_push" | "inserting">("idle");
  const [migrateProgressTotal, setMigrateProgressTotal] = useState(0);
  const [migrateProgressTables, setMigrateProgressTables] = useState<MigrateProgressEvent[]>([]);

  // ── fix-rows modal ──
  const [showFixModal, setShowFixModal] = useState(false);
  const [invalidRows, setInvalidRows] = useState<InvalidRow[]>([]);
  const [rowPatches, setRowPatches] = useState<Record<string, Record<string, string>>>({});
  const [fixModalLoading, setFixModalLoading] = useState(false);
  const [fixModalError, setFixModalError] = useState("");

  // ── connection management hook ────────────────────────────────────────────
  const {
    connections, activeConnectionId, activeConnection, loadingConnections,
    deletingId, testingId, testResults, remoteTables,
    setActiveConnectionId, setRemoteTables,
    showNewForm, connectionName, host, port, dbUser, password, database,
    connectState, connectError,
    setShowNewForm, setConnectionName, setHost, setPort, setDbUser, setPassword, setDatabase,
    setConnectState, setConnectError,
    showConnStringModal, connStringValue, connStringORM, connStringEnvName, connStringCopied,
    setShowConnStringModal, setConnStringValue, setConnStringORM, setConnStringEnvName, setConnStringCopied,
    loadConnections, selectConnection, handleDelete, handleTestConnection, handleConnect,
    openConnStringModal, rebuildConnStringValue,
  } = useMigrationConnections({
    onConnected: (tableCount) => {
      setDbTableCount(tableCount);
      if (tableCount === 0) {
        setMigrationPlan("new");
        setPushState("idle");
        setPushError("");
      }
    },
    onResetFromModelDiff: resetFromModelDiff,
  });

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
        setCollectSnapshotId(state.snapshotId);
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

  const { warnings, defaultsRequiredCount } = useSchemaWarnings(projectId, syncVersion, targetVersion);
  const breakingPendingCount = warnings.filter(
    (w) => !w.approvedAt && (
      w.resolution === "data_deleted" ||
      w.resolution === "lossy_convert" ||
      w.resolution === "precision_loss"
    ),
  ).length;

  // Deep-link into the right resolver tab based on what's blocking
  const BLOCKING_RESOLUTIONS = new Set(["data_deleted", "lossy_convert", "precision_loss"]);
  const trackingHref = (() => {
    if (breakingPendingCount > 0) {
      if (warnings.some((w) => !w.approvedAt && BLOCKING_RESOLUTIONS.has(w.resolution) && w.entityKind === "table")) return "/tracking?resolve=tables";
      if (warnings.some((w) => !w.approvedAt && BLOCKING_RESOLUTIONS.has(w.resolution) && w.entityKind === "enum")) return "/tracking?resolve=enums";
      if (warnings.some((w) => !w.approvedAt && BLOCKING_RESOLUTIONS.has(w.resolution) && w.entityKind === "field")) return "/tracking?resolve=schema";
      if (warnings.some((w) => !w.approvedAt && BLOCKING_RESOLUTIONS.has(w.resolution) && w.entityKind === "relation")) return "/tracking?resolve=relations";
    }
    if (defaultsRequiredCount > 0) return "/tracking?resolve=schema";
    return "/tracking";
  })();

  // Derived gating
  const isNewPlan = migrationPlan === "new";
  const isVersionPlan = migrationPlan === "version";
  const canModelDiff: boolean = connectState === "success" && canVersionMigrate && !!syncVersion && !!targetVersion && syncVersion !== targetVersion && syncCheckState === "compatible";
  const canSchemaCheck: boolean = modelDiffState === "success" && breakingPendingCount === 0 && defaultsRequiredCount === 0;
  const canCollect: boolean = schemaCheckState === "success" && (schemaCheckResult?.bothValid ?? false);
  const canMigrate: boolean = collectState === "success";

  const allIssues = [...stage1Issues, ...stage2Issues];
  const errorCount = allIssues.filter((i) => i.severity === "error").length;

  const collectBtnDisabled = collectState === "loading" || undefined;
  const validateBtnDisabled = validateState === "loading" || undefined;
  const migrateBtnDisabled =
    migrateState === "loading" ||
    (validateState === "success" && errorCount > 0) ||
    breakingPendingCount > 0 ||
    undefined;

  // ── reset helpers ─────────────────────────────────────────────────────────

  function resetFromModelDiff() {
    setModelDiffState("idle");
    setComparison(null);
    setSchemaCheckState("idle");
    setSchemaCheckResult(null);
    setCollectState("idle");
    setCollectError("");
    setCollectTimestamp("");
    setCollectSnapshotId(null);
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

  // Auto-check whether the selected syncVersion schema matches the live DB.
  // Fires whenever connection or syncVersion changes while in version-migration mode.
  useEffect(() => {
    if (connectState !== "success" || !activeConnectionId || !syncVersion || migrationPlan !== "version") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSyncCheckState("idle");
      setSyncCheckResult(null);
      return;
    }

    let cancelled = false;
    setSyncCheckState("loading");
    setSyncCheckResult(null);

    fetch("/api/migrations/check-sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectName, connectionId: activeConnectionId, syncVersion }),
    })
      .then((r) => r.json() as Promise<CheckSyncResponse>)
      .then((data) => {
        if (cancelled) return;
        setSyncCheckResult(data);
        setSyncCheckState(data.success && data.compatible ? "compatible" : "incompatible");
      })
      .catch(() => {
        if (!cancelled) setSyncCheckState("incompatible");
      });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectState, activeConnectionId, syncVersion, migrationPlan]);

  // ─── new migration: open destroy modal with DB data check ────────────────

  const handleDestroyOpen = () => {
    setDestroyConfirmText("");
    setDestroyDbPreview(null);
    setDestroyDbPreviewLoading(true);
    setShowDestroyModal(true);
    fetch("/api/migrations/test-connection", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ connectionId: activeConnectionId, withCounts: true }),
    })
      .then((r) => r.json() as Promise<TestConnectionResponse>)
      .then((data) => {
        if (data.success && data.tableCounts) {
          const total = data.tableCounts.reduce((s, t) => s + t.count, 0);
          setDestroyDbPreview({ tables: data.tableCounts, total });
        }
      })
      .catch(() => { /* silent — modal still functions without preview */ })
      .finally(() => setDestroyDbPreviewLoading(false));
  };

  // ─── new migration: push schema ───────────────────────────────────────────

  const handlePushNew = async (forceReset: boolean) => {
    setLastPushMode(forceReset ? "destroy" : "safe");
    setPushState("loading");
    setPushError("");
    try {
      const res = await fetch("/api/migrations/push-new", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectName, connectionId: activeConnectionId, targetVersion: newTargetVersion, forceReset }),
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
    setCollectSnapshotId(null);
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
      setCollectSnapshotId(data.snapshotId ?? null);
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
          snapshotId: collectSnapshotId,
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

  // ─── SSE stream reader ────────────────────────────────────────────────────

  async function readSSE(
    response: Response,
    handlers: {
      onPhase?: (phase: "schema_push" | "inserting", total?: number) => void;
      onProgress?: (event: MigrateProgressEvent) => void;
      onNeedsFix?: (data: RunResponse) => void;
      onDone: (data: RunResponse) => void;
      onError: (msg: string) => void;
    },
  ) {
    if (!response.body) throw new Error("No response body.");
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        try {
          const event = JSON.parse(line.slice(6)) as { type: string; [k: string]: unknown };
          if (event.type === "phase" && handlers.onPhase) {
            handlers.onPhase(
              event.phase as "schema_push" | "inserting",
              typeof event.total === "number" ? event.total : undefined,
            );
          } else if (event.type === "progress" && handlers.onProgress) {
            handlers.onProgress(event as unknown as MigrateProgressEvent);
          } else if (event.type === "needsFix" && handlers.onNeedsFix) {
            handlers.onNeedsFix(event as unknown as RunResponse);
            return;
          } else if (event.type === "done") {
            handlers.onDone(event as unknown as RunResponse);
            return;
          } else if (event.type === "error") {
            handlers.onError((event.error as string) ?? "Migration failed.");
            return;
          }
        } catch { /* malformed line */ }
      }
    }
  }

  async function consumeMigrateStream(
    body: RequestInit["body"],
    onNeedsFix: (data: RunResponse) => void,
    onError: (msg: string) => void,
    onDone: (data: RunResponse) => void,
  ) {
    const res = await fetch("/api/migrations/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    await readSSE(res, {
      onPhase: (phase, total) => {
        setMigratePhase(phase);
        if (phase === "inserting" && total !== undefined) setMigrateProgressTotal(total);
      },
      onProgress: (event) => setMigrateProgressTables((prev) => [...prev, event]),
      onNeedsFix,
      onDone,
      onError,
    });
  }

  // ─── migrate ─────────────────────────────────────────────────────────────

  const handleMigrate = async () => {
    setMigrateState("loading");
    setMigrateError("");
    setMigrateTables([]);
    setMigrateVersion("");
    setMigratePhase("idle");
    setMigrateProgressTables([]);
    setShowFixModal(false);
    setInvalidRows([]);
    setRowPatches({});
    setFixModalError("");

    try {
      await consumeMigrateStream(
        JSON.stringify({ projectName, connectionId: activeConnectionId, syncVersion, targetVersion, snapshotId: collectSnapshotId }),
        (data) => { setInvalidRows(data.invalidRows ?? []); setStage1Issues(data.stage1Issues ?? []); setStage2Issues(data.stage2Issues ?? []); setShowFixModal(true); setMigrateState("idle"); setMigratePhase("idle"); },
        (msg) => { setMigrateError(msg); setMigrateState("error"); setMigratePhase("idle"); },
        (data) => { applyMigrateSuccess(data); setMigratePhase("idle"); },
      );
    } catch (err) {
      setMigrateError(err instanceof Error ? err.message : "Migration failed.");
      setMigrateState("error");
      setMigratePhase("idle");
    }
  };

  // ─── fix modal: re-validate and run with patches ──────────────────────────

  const handleFixAndMigrate = async () => {
    setFixModalLoading(true);
    setFixModalError("");
    setMigratePhase("idle");
    setMigrateProgressTables([]);

    try {
      await consumeMigrateStream(
        JSON.stringify({ projectName, connectionId: activeConnectionId, syncVersion, targetVersion, snapshotId: collectSnapshotId, rowPatches }),
        (data) => { setInvalidRows(data.invalidRows ?? []); setStage2Issues(data.stage2Issues ?? []); },
        (msg) => { setFixModalError(msg); },
        (data) => { setShowFixModal(false); setInvalidRows([]); setRowPatches({}); applyMigrateSuccess(data); setMigratePhase("idle"); },
      );
    } catch (err) {
      setFixModalError(err instanceof Error ? err.message : "Migration failed.");
    } finally {
      setFixModalLoading(false);
    }
  };

  // ─── restore from snapshot ───────────────────────────────────────────────

  const handleRestore = async () => {
    setRestoreState("loading");
    setRestoreError("");
    setRestoreTables([]);
    setMigratePhase("idle");
    setMigrateProgressTables([]);

    try {
      const res = await fetch("/api/migrations/restore-snapshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectName, connectionId: activeConnectionId, snapshotId: collectSnapshotId, syncVersion }),
      });
      await readSSE(res, {
        onPhase: (phase, total) => {
          setMigratePhase(phase);
          if (phase === "inserting" && total !== undefined) setMigrateProgressTotal(total);
        },
        onProgress: (event) => setMigrateProgressTables((prev) => [...prev, event]),
        onDone: (data) => {
          setRestoreTables((data.tables as typeof restoreTables) ?? []);
          setRestoreState("success");
          setMigratePhase("idle");
        },
        onError: (msg) => {
          setRestoreError(msg);
          setRestoreState("error");
          setMigratePhase("idle");
        },
      });
    } catch (err) {
      setRestoreError(err instanceof Error ? err.message : "Restore failed.");
      setRestoreState("error");
      setMigratePhase("idle");
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

  const progressPct = migratePhase === "schema_push"
    ? 5
    : migratePhase === "inserting" && migrateProgressTotal > 0
      ? Math.round(5 + (migrateProgressTables.length / migrateProgressTotal) * 90)
      : 0;

  return (
    <div className="space-y-4">
      <MigrationProgressBar
        phase={migratePhase}
        progressPct={progressPct}
        progressTables={migrateProgressTables}
        progressTotal={migrateProgressTotal}
      />

      <MigrationPageHeader
        provider={provider}
        projectName={projectName}
        migrationPlan={migrationPlan}
        isNewPlan={isNewPlan}
        newTargetVersion={newTargetVersion}
        targetVersion={targetVersion}
        activeConnection={activeConnection}
      />

      {/* ── Session History ─────────────────────────────────────────────────── */}
      <SessionHistory
        sessions={sessions}
        onResume={(s) => {
          setMigrationPlan("version");
          setSyncVersion(s.fromVersion);
          setTargetVersion(s.toVersion);
          setActiveConnectionId(s.connectionId);
          setConnectState("success");
          if (s.collectTimestamp) {
            setCollectTimestamp(s.collectTimestamp);
            setCollectState("success");
            if (s.collectTables) { setCollectTables(s.collectTables); setCollectTotal(s.collectRowCount ?? 0); }
          }
          void persistMigrationState({ connectionId: s.connectionId, syncVersion: s.fromVersion, targetVersion: s.toVersion, dataTimestamp: s.collectTimestamp });
        }}
      />

      {/* ── Migration Type Selector ─────────────────────────────────────────── */}
      <MigrationTypeSelector
        canDoAnyMigration={canDoAnyMigration}
        isNewPlan={isNewPlan}
        isVersionPlan={isVersionPlan}
        canVersionMigrate={canVersionMigrate}
        dbIsEmpty={dbIsEmpty}
        syncVersion={syncVersion}
        targetVersion={targetVersion}
        versions={versions}
        syncCheckState={syncCheckState}
        syncCheckResult={syncCheckResult}
        onChangePlan={changePlan}
        onSyncVersionChange={(v) => {
          setSyncVersion(v);
          setTargetVersion("");
          resetFromModelDiff();
          void persistMigrationState({ syncVersion: v, targetVersion: null, zodGenerated: false, schemaCheckPassed: false, dataTimestamp: null, snapshotId: null, validationPassed: false, runLogPath: null });
        }}
        onTargetVersionChange={(v) => {
          setTargetVersion(v);
          resetFromModelDiff();
          void persistMigrationState({ targetVersion: v, zodGenerated: false, schemaCheckPassed: false, dataTimestamp: null, snapshotId: null, validationPassed: false, runLogPath: null });
        }}
      />

      {/* ── Step 1: Connection management ──────────────────────────────────── */}
      <ConnectionManagementCard
        canDoAnyMigration={canDoAnyMigration}
        migrationPlan={migrationPlan}
        connections={connections}
        activeConnectionId={activeConnectionId}
        activeConnection={activeConnection}
        loadingConnections={loadingConnections}
        deletingId={deletingId}
        testingId={testingId}
        testResults={testResults}
        remoteTables={remoteTables}
        showNewForm={showNewForm}
        connectionName={connectionName}
        host={host}
        port={port}
        dbUser={dbUser}
        password={password}
        database={database}
        connectState={connectState}
        connectError={connectError}
        isSQLite={isSQLite}
        onSelectConnection={selectConnection}
        onDeleteConnection={(uuid) => void handleDelete(uuid)}
        onTestConnection={(uuid) => void handleTestConnection(uuid)}
        onOpenConnString={() => void openConnStringModal()}
        onToggleNewForm={() => { setShowNewForm((v) => !v); setConnectError(""); }}
        onConnectionNameChange={setConnectionName}
        onHostChange={setHost}
        onPortChange={setPort}
        onDbUserChange={setDbUser}
        onPasswordChange={setPassword}
        onDatabaseChange={setDatabase}
        onConnect={() => void handleConnect(persistMigrationState)}
      />

      {/* ── Step 2: Deploy Schema (new plan only) ──────────────────────────── */}
      {isNewPlan && (
        <DeploySchemaCard
          connectState={connectState}
          pushState={pushState}
          pushError={pushError}
          lastPushMode={lastPushMode}
          newTargetVersion={newTargetVersion}
          versions={versions}
          onVersionChange={(v) => { setNewTargetVersion(v); setPushState("idle"); setPushError(""); setLastPushMode(null); }}
          onDeploySchema={() => void handlePushNew(false)}
          onDestroyOpen={handleDestroyOpen}
          onDeployAgain={() => { setPushState("idle"); setPushError(""); setLastPushMode(null); }}
        />
      )}

      {/* ── Steps 2–5: Version migration ──────────────────────────────────── */}
      <VersionMigrationSteps
        isVersionPlan={isVersionPlan}
        projectName={projectName}
        versions={versions}
        syncVersion={syncVersion}
        targetVersion={targetVersion}
        modelDiffState={modelDiffState}
        comparison={comparison}
        warnings={warnings}
        breakingPendingCount={breakingPendingCount}
        defaultsRequiredCount={defaultsRequiredCount}
        trackingHref={trackingHref}
        canModelDiff={canModelDiff}
        onZodGenerated={() => { setModelDiffState("success"); void persistMigrationState({ zodGenerated: true }); setSchemaCheckState("idle"); setSchemaCheckResult(null); void handleSchemaCheck(); }}
        onOpenFullScreen={() => setShowModelDiffModal(true)}
        onComparisonReady={(c) => setComparison(c)}
        canSchemaCheck={canSchemaCheck}
        schemaCheckState={schemaCheckState}
        schemaCheckResult={schemaCheckResult}
        onSchemaCheck={() => void handleSchemaCheck()}
        canCollect={canCollect}
        collectState={collectState}
        collectError={collectError}
        collectTables={collectTables}
        collectTotal={collectTotal}
        collectTimestamp={collectTimestamp}
        migrationOrder={migrationOrder}
        restoreState={restoreState}
        restoreError={restoreError}
        restoreTables={restoreTables}
        collectBtnDisabled={collectBtnDisabled}
        onCollect={() => void handleCollect()}
        onRestore={() => void handleRestore()}
        canMigrate={canMigrate}
        migrateState={migrateState}
        migrateError={migrateError}
        validateState={validateState}
        validateError={validateError}
        stage1Issues={stage1Issues}
        stage2Issues={stage2Issues}
        errorCount={errorCount}
        migrateTables={migrateTables}
        migrateVersion={migrateVersion}
        activeConnection={activeConnection}
        validateBtnDisabled={validateBtnDisabled}
        migrateBtnDisabled={migrateBtnDisabled}
        onValidate={() => void handleValidate()}
        onShowPreflight={() => setShowPreflightModal(true)}
        showModelDiffModal={showModelDiffModal}
        onCloseModelDiff={() => setShowModelDiffModal(false)}
      />

      {/* ── Collect result modal ────────────────────────────────────────────── */}
      <CollectResultModal
        isOpen={showEmptyModal}
        isVersionPlan={isVersionPlan}
        syncVersion={syncVersion}
        collectTotal={collectTotal}
        collectTables={collectTables}
        collectQueryError={collectQueryError}
        collectMismatches={collectMismatches}
        collectTimestamp={collectTimestamp}
        collectModalPage={collectModalPage}
        migrationOrder={migrationOrder}
        onPageChange={setCollectModalPage}
        onCancel={() => setShowEmptyModal(false)}
        onProceed={() => {
          setShowEmptyModal(false);
          setCollectState("success");
          void persistMigrationState({ dataTimestamp: collectTimestamp });
          fetch(`/api/migration-state?list=true&projectId=${projectId}`).then((r) => r.json()).then((list) => setSessions(list as MigrationSession[])).catch(() => {});
        }}
      />

      {/* ── Destroy & Deploy confirmation modal ─────────────────────────────── */}
      <DestroyDeployModal
        isOpen={showDestroyModal}
        newTargetVersion={newTargetVersion}
        destroyConfirmText={destroyConfirmText}
        destroyDbPreview={destroyDbPreview}
        destroyDbPreviewLoading={destroyDbPreviewLoading}
        onConfirmTextChange={setDestroyConfirmText}
        onCancel={() => setShowDestroyModal(false)}
        onConfirm={() => { setShowDestroyModal(false); void handlePushNew(true); }}
      />

      {/* ── Pre-flight summary modal ─────────────────────────────────────────── */}
      <PreflightModal
        isOpen={showPreflightModal}
        comparison={comparison}
        warnings={warnings}
        activeConnection={activeConnection}
        syncVersion={syncVersion}
        targetVersion={targetVersion}
        collectTables={collectTables}
        collectTotal={collectTotal}
        migrationOrder={migrationOrder}
        preflightTab={preflightTab}
        preflightPage={preflightPage}
        preflightPageSize={PREFLIGHT_PAGE_SIZE}
        onTabChange={(tab) => { setPreflightTab(tab); setPreflightPage(0); }}
        onPageChange={setPreflightPage}
        onCancel={() => setShowPreflightModal(false)}
        onBeginMigration={() => { setShowPreflightModal(false); void handleMigrate(); }}
      />

      {/* ── Fix-rows modal ──────────────────────────────────────────────────── */}
      <FixRowsModal
        isOpen={showFixModal}
        invalidRows={invalidRows}
        rowPatches={rowPatches}
        fixModalLoading={fixModalLoading}
        fixModalError={fixModalError}
        onPatch={setRowPatches}
        onCancel={() => { setShowFixModal(false); setMigrateState("idle"); }}
        onFixAndMigrate={() => void handleFixAndMigrate()}
      />

      {/* ── Connection String modal ─────────────────────────────────────────── */}
      <ConnectionStringModal
        isOpen={showConnStringModal}
        connStringValue={connStringValue}
        connStringORM={connStringORM}
        connStringEnvName={connStringEnvName}
        connStringCopied={connStringCopied}
        onClose={() => setShowConnStringModal(false)}
        onOrmChange={(orm) => { setConnStringORM(orm); rebuildConnStringValue(orm, connStringEnvName); setConnStringCopied(false); }}
        onEnvNameChange={(v) => { setConnStringEnvName(v); rebuildConnStringValue("custom", v); setConnStringCopied(false); }}
        onValueChange={(v) => { setConnStringValue(v); setConnStringCopied(false); }}
        onCopy={() => { void navigator.clipboard.writeText(connStringValue); setConnStringCopied(true); setTimeout(() => setConnStringCopied(false), 2000); }}
      />
    </div>
  );
}
