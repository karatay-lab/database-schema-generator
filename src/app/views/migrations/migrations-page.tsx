"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useProjectInfo } from "../shared/project-info-context";
import { useSchemaWarnings } from "@/hooks/use-schema-warnings";
import { useMigrationConnections } from "@/hooks/use-migration-connections";
import { useSyncCheck } from "@/hooks/use-sync-check";
import { useDestroyDeploy } from "@/hooks/use-destroy-deploy";
import { useMigrationWorkflow } from "@/hooks/use-migration-workflow";
import type { MigrationPlan, MigrationSession } from "@/types/migrations";
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

const PREFLIGHT_PAGE_SIZE = 8;

export function MigrationsPageContent() {
  const { projectId, projectName, provider, versions, hasProject } = useProjectInfo();
  const isSQLite = provider.toLowerCase() === "sqlite";
  const canDoAnyMigration = versions.length >= 1;
  const canVersionMigrate = versions.length >= 2;

  // ── page-level coordination state ────────────────────────────────────────
  const [migrationPlan, setMigrationPlan] = useState<MigrationPlan | null>(null);
  const [dbTableCount, setDbTableCount] = useState<number | null>(null);
  const [sessions, setSessions] = useState<MigrationSession[]>([]);
  const [syncVersion, setSyncVersion] = useState("");
  const [targetVersion, setTargetVersion] = useState("");

  const dbIsEmpty  = dbTableCount !== null && dbTableCount === 0;
  const isNewPlan  = migrationPlan === "new";
  const isVersionPlan = migrationPlan === "version";

  // ── best-effort persistence ───────────────────────────────────────────────
  const persistMigrationState = useCallback(async (patch: Record<string, unknown>) => {
    if (!hasProject) return;
    await fetch("/api/migration-state", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, ...patch }),
    }).catch(() => {/* best-effort */});
  }, [hasProject, projectId]);

  // ── ref trick: break the resetFromModelDiff ↔ useMigrationConnections cycle
  // useMigrationConnections needs the callback before workflow is initialized;
  // the ref stays stable while always calling the latest version.
  const resetFromModelDiffRef = useRef<() => void>(() => {});

  // ── hooks ─────────────────────────────────────────────────────────────────
  const { warnings, defaultsRequiredCount } = useSchemaWarnings(projectId, syncVersion, targetVersion);

  const breakingPendingCount = warnings.filter(
    (w) => !w.approvedAt && (w.resolution === "data_deleted" || w.resolution === "lossy_convert" || w.resolution === "precision_loss"),
  ).length;

  const conn = useMigrationConnections({
    onConnected: (tableCount) => {
      setDbTableCount(tableCount);
      if (tableCount === 0) {
        setMigrationPlan("new");
        destroy.resetPush();
      }
    },
    onResetFromModelDiff: () => resetFromModelDiffRef.current(),
  });

  const sync = useSyncCheck({
    projectName, activeConnectionId: conn.activeConnectionId,
    syncVersion, migrationPlan, connectState: conn.connectState,
  });

  const destroy = useDestroyDeploy({
    projectName, activeConnectionId: conn.activeConnectionId, versions,
  });

  const workflow = useMigrationWorkflow({
    projectName, projectId,
    activeConnectionId: conn.activeConnectionId,
    syncVersion, targetVersion,
    breakingPendingCount, defaultsRequiredCount,
    persistMigrationState,
    onSessionsRefresh: setSessions,
  });

  // Keep ref in sync on every render (safe — runs before effects)
  resetFromModelDiffRef.current = workflow.resetFromModelDiff;

  // ── restore workflow state from server on mount / project switch ──────────
  useEffect(() => {
    if (!hasProject) return;
    let cancelled = false;

    async function loadAll() {
      const sessRes = await fetch(`/api/migration-state?list=true&projectId=${projectId}`).catch(() => null);
      if (sessRes?.ok && !cancelled) {
        const list = await sessRes.json() as MigrationSession[];
        if (!cancelled) setSessions(list);
      }

      const res = await fetch(`/api/migration-state?projectId=${projectId}`).catch(() => null);
      if (!res?.ok || cancelled) return;
      type SavedState = {
        connectionId: string | null; syncVersion: string | null; targetVersion: string | null;
        dataTimestamp: string | null; snapshotId: string | null;
        snapshot: { tableCount: number; rowCount: number; tables: { name: string; count: number }[]; collectedAt: string } | null;
        zodGenerated: boolean; schemaCheckPassed: boolean; validationPassed: boolean; runLogPath: string | null;
      };
      const state = await res.json() as SavedState | null;
      if (!state || cancelled) return;

      if (state.connectionId) { conn.setActiveConnectionId(state.connectionId); conn.setConnectState("success"); }
      if (state.syncVersion)  setSyncVersion(state.syncVersion);
      if (state.targetVersion) setTargetVersion(state.targetVersion);
      workflow.dispatch({ type: "RESTORE_PHASE_STATES", payload: {
        modelDiff: state.zodGenerated,
        schemaCheck: state.schemaCheckPassed,
        validate: state.validationPassed,
        migrate: !!state.runLogPath,
      }});
      if (state.snapshotId && state.snapshot) {
        workflow.dispatch({ type: "RESTORE_COLLECT_STATE", payload: {
          snapshotId: state.snapshotId,
          timestamp: state.snapshot.collectedAt,
          tables: state.snapshot.tables,
          total: state.snapshot.rowCount,
        }});
      } else if (state.dataTimestamp) {
        workflow.dispatch({ type: "RESTORE_TIMESTAMP_ONLY", payload: state.dataTimestamp });
      }
      if (state.zodGenerated || state.schemaCheckPassed || state.snapshotId || state.dataTimestamp || state.validationPassed || state.runLogPath) {
        setMigrationPlan("version");
      }
    }

    void loadAll();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // ── tracking deep-link ────────────────────────────────────────────────────
  const BLOCKING_RESOLUTIONS = new Set(["data_deleted", "lossy_convert", "precision_loss"]);
  const trackingHref = (() => {
    if (breakingPendingCount > 0) {
      if (warnings.some((w) => !w.approvedAt && BLOCKING_RESOLUTIONS.has(w.resolution) && w.entityKind === "table")) return "/tracking?resolve=tables";
      if (warnings.some((w) => !w.approvedAt && BLOCKING_RESOLUTIONS.has(w.resolution) && w.entityKind === "enum"))  return "/tracking?resolve=enums";
      if (warnings.some((w) => !w.approvedAt && BLOCKING_RESOLUTIONS.has(w.resolution) && w.entityKind === "field")) return "/tracking?resolve=schema";
      if (warnings.some((w) => !w.approvedAt && BLOCKING_RESOLUTIONS.has(w.resolution) && w.entityKind === "relation")) return "/tracking?resolve=relations";
    }
    if (defaultsRequiredCount > 0) return "/tracking?resolve=schema";
    return "/tracking";
  })();

  const canModelDiff = conn.connectState === "success" && canVersionMigrate && !!syncVersion && !!targetVersion && syncVersion !== targetVersion && sync.syncCheckState === "compatible";

  function changePlan(plan: MigrationPlan) {
    if (plan === migrationPlan) return;
    setMigrationPlan(plan);
    destroy.resetPush();
    workflow.resetFromModelDiff();
  }

  // ── early return ─────────────────────────────────────────────────────────
  if (!hasProject) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-8 text-center">
        <p className="text-slate-600">Select a project to configure migrations.</p>
      </div>
    );
  }

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <MigrationProgressBar
        phase={workflow.migratePhase}
        progressPct={workflow.progressPct}
        progressTables={workflow.migrateProgressTables}
        progressTotal={workflow.migrateProgressTotal}
      />

      <MigrationPageHeader
        provider={provider}
        projectName={projectName}
        migrationPlan={migrationPlan}
        isNewPlan={isNewPlan}
        newTargetVersion={destroy.newTargetVersion}
        targetVersion={targetVersion}
        activeConnection={conn.activeConnection}
      />

      <SessionHistory
        sessions={sessions}
        onResume={(s) => {
          setMigrationPlan("version");
          setSyncVersion(s.fromVersion);
          setTargetVersion(s.toVersion);
          conn.setActiveConnectionId(s.connectionId);
          conn.setConnectState("success");
          if (s.collectTimestamp) {
            workflow.dispatch({ type: "RESTORE_COLLECT_STATE", payload: {
              snapshotId: s.id,
              timestamp: s.collectTimestamp,
              tables: s.collectTables ?? [],
              total: s.collectRowCount ?? 0,
            }});
          }
          void persistMigrationState({ connectionId: s.connectionId, syncVersion: s.fromVersion, targetVersion: s.toVersion, dataTimestamp: s.collectTimestamp });
        }}
      />

      <MigrationTypeSelector
        canDoAnyMigration={canDoAnyMigration}
        isNewPlan={isNewPlan}
        isVersionPlan={isVersionPlan}
        canVersionMigrate={canVersionMigrate}
        dbIsEmpty={dbIsEmpty}
        syncVersion={syncVersion}
        targetVersion={targetVersion}
        versions={versions}
        syncCheckState={sync.syncCheckState}
        syncCheckResult={sync.syncCheckResult}
        onChangePlan={changePlan}
        onSyncVersionChange={(v) => {
          setSyncVersion(v);
          setTargetVersion("");
          workflow.resetFromModelDiff();
          void persistMigrationState({ syncVersion: v, targetVersion: null, zodGenerated: false, schemaCheckPassed: false, dataTimestamp: null, snapshotId: null, validationPassed: false, runLogPath: null });
        }}
        onTargetVersionChange={(v) => {
          setTargetVersion(v);
          workflow.resetFromModelDiff();
          void persistMigrationState({ targetVersion: v, zodGenerated: false, schemaCheckPassed: false, dataTimestamp: null, snapshotId: null, validationPassed: false, runLogPath: null });
        }}
      />

      <ConnectionManagementCard
        canDoAnyMigration={canDoAnyMigration}
        migrationPlan={migrationPlan}
        connections={conn.connections}
        activeConnectionId={conn.activeConnectionId}
        activeConnection={conn.activeConnection}
        loadingConnections={conn.loadingConnections}
        deletingId={conn.deletingId}
        testingId={conn.testingId}
        testResults={conn.testResults}
        remoteTables={conn.remoteTables}
        showNewForm={conn.showNewForm}
        connectionName={conn.connectionName}
        host={conn.host}
        port={conn.port}
        dbUser={conn.dbUser}
        password={conn.password}
        database={conn.database}
        connectState={conn.connectState}
        connectError={conn.connectError}
        isSQLite={isSQLite}
        onSelectConnection={conn.selectConnection}
        onDeleteConnection={(uuid) => void conn.handleDelete(uuid)}
        onTestConnection={(uuid) => void conn.handleTestConnection(uuid)}
        onOpenConnString={() => void conn.openConnStringModal()}
        onToggleNewForm={() => { conn.setShowNewForm((v) => !v); conn.setConnectError(""); }}
        onConnectionNameChange={conn.setConnectionName}
        onHostChange={conn.setHost}
        onPortChange={conn.setPort}
        onDbUserChange={conn.setDbUser}
        onPasswordChange={conn.setPassword}
        onDatabaseChange={conn.setDatabase}
        onConnect={() => void conn.handleConnect(persistMigrationState)}
      />

      {isNewPlan && (
        <DeploySchemaCard
          connectState={conn.connectState}
          pushState={destroy.pushState}
          pushError={destroy.pushError}
          lastPushMode={destroy.lastPushMode}
          newTargetVersion={destroy.newTargetVersion}
          versions={versions}
          onVersionChange={(v) => { destroy.setNewTargetVersion(v); destroy.resetPush(); }}
          onDeploySchema={() => void destroy.handlePushNew(false)}
          onDestroyOpen={destroy.handleDestroyOpen}
          onDeployAgain={destroy.resetPush}
        />
      )}

      <VersionMigrationSteps
        isVersionPlan={isVersionPlan}
        projectName={projectName}
        versions={versions}
        syncVersion={syncVersion}
        targetVersion={targetVersion}
        modelDiffState={workflow.modelDiffState}
        comparison={workflow.comparison}
        warnings={warnings}
        breakingPendingCount={breakingPendingCount}
        defaultsRequiredCount={defaultsRequiredCount}
        trackingHref={trackingHref}
        canModelDiff={canModelDiff}
        onZodGenerated={() => {
          workflow.dispatch({ type: "MODEL_DIFF_SUCCESS" });
          void persistMigrationState({ zodGenerated: true });
          workflow.dispatch({ type: "SCHEMA_CHECK_LOADING" });
          void workflow.handleSchemaCheck();
        }}
        onOpenFullScreen={() => workflow.dispatch({ type: "SHOW_MODEL_DIFF_MODAL", payload: true })}
        onComparisonReady={(c) => workflow.dispatch({ type: "SET_COMPARISON", payload: c })}
        canSchemaCheck={workflow.canSchemaCheck}
        schemaCheckState={workflow.schemaCheckState}
        schemaCheckResult={workflow.schemaCheckResult}
        onSchemaCheck={() => void workflow.handleSchemaCheck()}
        canCollect={workflow.canCollect}
        collectState={workflow.collectState}
        collectError={workflow.collectError}
        collectTables={workflow.collectTables}
        collectTotal={workflow.collectTotal}
        collectTimestamp={workflow.collectTimestamp}
        migrationOrder={workflow.migrationOrder}
        restoreState={workflow.restoreState}
        restoreError={workflow.restoreError}
        restoreTables={workflow.restoreTables}
        collectBtnDisabled={workflow.collectBtnDisabled}
        onCollect={() => void workflow.handleCollect()}
        onRestore={() => void workflow.handleRestore()}
        canMigrate={workflow.canMigrate}
        migrateState={workflow.migrateState}
        migrateError={workflow.migrateError}
        validateState={workflow.validateState}
        validateError={workflow.validateError}
        stage1Issues={workflow.stage1Issues}
        stage2Issues={workflow.stage2Issues}
        errorCount={workflow.errorCount}
        migrateTables={workflow.migrateTables}
        migrateVersion={workflow.migrateVersion}
        activeConnection={conn.activeConnection}
        validateBtnDisabled={workflow.validateBtnDisabled}
        migrateBtnDisabled={workflow.migrateBtnDisabled}
        onValidate={() => void workflow.handleValidate()}
        onShowPreflight={() => workflow.dispatch({ type: "SHOW_PREFLIGHT", payload: true })}
        showModelDiffModal={workflow.showModelDiffModal}
        onCloseModelDiff={() => workflow.dispatch({ type: "SHOW_MODEL_DIFF_MODAL", payload: false })}
      />

      <CollectResultModal
        isOpen={workflow.showEmptyModal}
        isVersionPlan={isVersionPlan}
        syncVersion={syncVersion}
        collectTotal={workflow.collectTotal}
        collectTables={workflow.collectTables}
        collectQueryError={workflow.collectQueryError}
        collectMismatches={workflow.collectMismatches}
        collectTimestamp={workflow.collectTimestamp}
        collectModalPage={workflow.collectModalPage}
        migrationOrder={workflow.migrationOrder}
        onPageChange={(p) => workflow.dispatch({ type: "SET_COLLECT_MODAL_PAGE", payload: p })}
        onCancel={() => workflow.dispatch({ type: "SET_SHOW_EMPTY_MODAL", payload: false })}
        onProceed={() => {
          workflow.dispatch({ type: "COLLECT_CONFIRMED" });
          void persistMigrationState({ dataTimestamp: workflow.collectTimestamp });
          fetch(`/api/migration-state?list=true&projectId=${projectId}`)
            .then((r) => r.json()).then((list) => setSessions(list as MigrationSession[])).catch(() => {});
        }}
      />

      <DestroyDeployModal
        isOpen={destroy.showDestroyModal}
        newTargetVersion={destroy.newTargetVersion}
        destroyConfirmText={destroy.destroyConfirmText}
        destroyDbPreview={destroy.destroyDbPreview}
        destroyDbPreviewLoading={destroy.destroyDbPreviewLoading}
        onConfirmTextChange={destroy.setDestroyConfirmText}
        onCancel={() => destroy.setShowDestroyModal(false)}
        onConfirm={() => { destroy.setShowDestroyModal(false); void destroy.handlePushNew(true); }}
      />

      <PreflightModal
        isOpen={workflow.showPreflightModal}
        comparison={workflow.comparison}
        warnings={warnings}
        activeConnection={conn.activeConnection}
        syncVersion={syncVersion}
        targetVersion={targetVersion}
        collectTables={workflow.collectTables}
        collectTotal={workflow.collectTotal}
        migrationOrder={workflow.migrationOrder}
        preflightTab={workflow.preflightTab}
        preflightPage={workflow.preflightPage}
        preflightPageSize={PREFLIGHT_PAGE_SIZE}
        onTabChange={(tab) => workflow.dispatch({ type: "SET_PREFLIGHT_TAB", payload: tab })}
        onPageChange={(p) => workflow.dispatch({ type: "SET_PREFLIGHT_PAGE", payload: p })}
        onCancel={() => workflow.dispatch({ type: "SHOW_PREFLIGHT", payload: false })}
        onBeginMigration={() => { workflow.dispatch({ type: "SHOW_PREFLIGHT", payload: false }); void workflow.handleMigrate(); }}
      />

      <FixRowsModal
        isOpen={workflow.showFixModal}
        invalidRows={workflow.invalidRows}
        rowPatches={workflow.rowPatches}
        fixModalLoading={workflow.fixModalLoading}
        fixModalError={workflow.fixModalError}
        onPatch={(p) => workflow.dispatch({ type: "SET_ROW_PATCHES", payload: p })}
        onCancel={() => { workflow.dispatch({ type: "SET_SHOW_FIX_MODAL", payload: false }); workflow.dispatch({ type: "MIGRATE_ERROR", payload: "" }); }}
        onFixAndMigrate={() => void workflow.handleFixAndMigrate()}
      />

      <ConnectionStringModal
        isOpen={conn.showConnStringModal}
        connStringValue={conn.connStringValue}
        connStringORM={conn.connStringORM}
        connStringEnvName={conn.connStringEnvName}
        connStringCopied={conn.connStringCopied}
        onClose={() => conn.setShowConnStringModal(false)}
        onOrmChange={(orm) => { conn.setConnStringORM(orm); conn.rebuildConnStringValue(orm, conn.connStringEnvName); conn.setConnStringCopied(false); }}
        onEnvNameChange={(v) => { conn.setConnStringEnvName(v); conn.rebuildConnStringValue("custom", v); conn.setConnStringCopied(false); }}
        onValueChange={(v) => { conn.setConnStringValue(v); conn.setConnStringCopied(false); }}
        onCopy={() => { void navigator.clipboard.writeText(conn.connStringValue); conn.setConnStringCopied(true); setTimeout(() => conn.setConnStringCopied(false), 2000); }}
      />
    </div>
  );
}
