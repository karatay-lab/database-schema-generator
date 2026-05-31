"use client";

import { useCallback, useEffect, useState } from "react";
import { useProjectInfo } from "@/app/views/shared/project-info-context";
import type {
  ConnectionRecord,
  ConnectionsResponse,
  ConnectResponse,
  TestConnectionResponse,
} from "@/types/migrations";

type UseConnectionsOptions = {
  onConnected?: (tableCount: number) => void;
  onResetFromModelDiff?: () => void;
};

export function useMigrationConnections({ onConnected, onResetFromModelDiff }: UseConnectionsOptions = {}) {
  const { projectName, provider } = useProjectInfo();
  const isSQLite = provider.toLowerCase() === "sqlite";

  // ── Saved connections ─────────────────────────────────────────────────────
  const [connections, setConnections] = useState<ConnectionRecord[]>([]);
  const [activeConnectionId, setActiveConnectionId] = useState("");
  const [loadingConnections, setLoadingConnections] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [testingId, setTestingId] = useState("");
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; tables?: string[]; error?: string }>>({});
  const [remoteTables, setRemoteTables] = useState<string[]>([]);

  // ── New connection form ───────────────────────────────────────────────────
  const [showNewForm, setShowNewForm] = useState(false);
  const [connectionName, setConnectionName] = useState("");
  const [host, setHost] = useState("localhost");
  const [port, setPort] = useState(isSQLite ? "" : provider.toLowerCase() === "mysql" ? "3306" : "5432");
  const [dbUser, setDbUser] = useState("");
  const [password, setPassword] = useState("");
  const [database, setDatabase] = useState("");
  const [connectState, setConnectState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [connectError, setConnectError] = useState("");

  // ── Connection string modal ───────────────────────────────────────────────
  const [showConnStringModal, setShowConnStringModal] = useState(false);
  const [connStringValue, setConnStringValue] = useState("");
  const [connStringORM, setConnStringORM] = useState<"prisma" | "drizzle" | "custom" | "plain">("plain");
  const [connStringEnvName, setConnStringEnvName] = useState("DATABASE_URL");
  const [connStringCopied, setConnStringCopied] = useState(false);

  const activeConnection = connections.find((c) => c.uuid === activeConnectionId) ?? null;

  // ── Load connections ──────────────────────────────────────────────────────
  const loadConnections = useCallback(async () => {
    if (!projectName) return;
    setLoadingConnections(true);
    try {
      const res = await fetch(`/api/migrations/connections?projectName=${encodeURIComponent(projectName)}`);
      const data: ConnectionsResponse = await res.json();
      setConnections(data.connections ?? []);
    } catch { /* silent */ } finally {
      setLoadingConnections(false);
    }
  }, [projectName]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadConnections();
  }, [loadConnections]);

  // ── Select connection ─────────────────────────────────────────────────────
  const selectConnection = (uuid: string) => {
    setActiveConnectionId(uuid);
    setShowNewForm(false);
    setConnectState("success");
    setConnectError("");
    setRemoteTables([]);
    onResetFromModelDiff?.();
  };

  // ── Delete connection ─────────────────────────────────────────────────────
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
        onResetFromModelDiff?.();
      }
    } finally {
      setDeletingId("");
    }
  };

  // ── Test connection ───────────────────────────────────────────────────────
  const handleTestConnection = async (uuid: string) => {
    setTestingId(uuid);
    setTestResults((prev) => { const next = { ...prev }; delete next[uuid]; return next; });
    try {
      const res = await fetch("/api/migrations/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId: uuid }),
      });
      const data = await res.json() as { success: boolean; tables?: string[]; error?: string };
      setTestResults((prev) => ({ ...prev, [uuid]: data }));
    } catch {
      setTestResults((prev) => ({ ...prev, [uuid]: { success: false, error: "Request failed." } }));
    } finally {
      setTestingId("");
    }
  };

  // ── Create connection ─────────────────────────────────────────────────────
  const handleConnect = async (persistMigrationState?: (patch: Record<string, unknown>) => Promise<void>) => {
    setConnectState("loading");
    setConnectError("");
    try {
      const res = await fetch("/api/migrations/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectName,
          connectionName: connectionName || `${provider} — ${host}:${port}/${database}`,
          provider, host, port, user: dbUser, password, database,
        }),
      });
      const data: ConnectResponse = await res.json();
      if (!data.success) throw new Error(data.error ?? "Connection failed.");

      setActiveConnectionId(data.uuid!);
      setRemoteTables(data.tables ?? []);
      setConnectState("success");
      setShowNewForm(false);
      await loadConnections();
      onResetFromModelDiff?.();

      const tableCount = data.tables?.length ?? 0;
      onConnected?.(tableCount);

      await persistMigrationState?.({ connectionId: data.uuid });
    } catch (err) {
      setConnectError(err instanceof Error ? err.message : "Connection failed.");
      setConnectState("error");
    }
  };

  // ── Connection string modal ───────────────────────────────────────────────
  const openConnStringModal = async () => {
    const isPlain = connStringORM === "plain";
    const ormEnv = connStringORM === "custom" ? connStringEnvName : "DATABASE_URL";
    setConnStringCopied(false);
    setShowConnStringModal(true);
    if (!activeConnectionId) { setConnStringValue(isPlain ? "" : `${ormEnv}=`); return; }
    try {
      const res = await fetch(`/api/migrations/connections/url?connectionId=${activeConnectionId}`);
      const data = await res.json() as { success: boolean; url?: string };
      const url = data.success && data.url ? data.url : "";
      setConnStringValue(isPlain ? url : `${ormEnv}=${url}`);
    } catch {
      setConnStringValue(isPlain ? "" : `${ormEnv}=`);
    }
  };

  const rebuildConnStringValue = (orm: typeof connStringORM, envName: string) => {
    setConnStringValue((prev) => {
      const url = prev.includes("=") ? prev.split("=").slice(1).join("=") : prev;
      if (orm === "plain") return url;
      const ormEnv = orm === "custom" ? envName : "DATABASE_URL";
      return `${ormEnv}=${url}`;
    });
  };

  return {
    // saved connections
    connections, activeConnectionId, activeConnection,
    loadingConnections, deletingId, testingId, testResults, remoteTables,
    setActiveConnectionId, setRemoteTables,
    // form
    showNewForm, connectionName, host, port, dbUser, password, database,
    connectState, connectError, isSQLite,
    setShowNewForm, setConnectionName, setHost, setPort, setDbUser, setPassword, setDatabase,
    setConnectState, setConnectError,
    // conn string modal
    showConnStringModal, connStringValue, connStringORM, connStringEnvName, connStringCopied,
    setShowConnStringModal, setConnStringValue, setConnStringORM, setConnStringEnvName, setConnStringCopied,
    // handlers
    loadConnections, selectConnection, handleDelete, handleTestConnection, handleConnect,
    openConnStringModal, rebuildConnStringValue,
  };
}
