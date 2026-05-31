"use client";

import { useCallback, useEffect, useState } from "react";
import type { DbStatus, MigrateResult } from "@/types/sql-query";

export function useDbManagement({
  projectName,
  version,
}: {
  projectName: string;
  version: string;
}) {
  const [dbStatus, setDbStatus] = useState<DbStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [migrateOpen, setMigrateOpen] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [migrateResult, setMigrateResult] = useState<MigrateResult | null>(null);
  const [deletingSchema, setDeletingSchema] = useState(false);

  const fetchStatus = useCallback(async () => {
    if (!projectName || !version) {
      setDbStatus(null);
      setLoadingStatus(false);
      return;
    }
    try {
      const params = new URLSearchParams({ projectName, version });
      const res = await fetch(`/api/sql-query/status?${params}`);
      setDbStatus(await res.json() as DbStatus);
    } catch {
      setDbStatus(null);
    } finally {
      setLoadingStatus(false);
    }
  }, [projectName, version]);

  useEffect(() => {
    setLoadingStatus(true);
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
      const data = await res.json() as MigrateResult;
      setMigrateResult(data);
      if (data.success) await fetchStatus();
    } catch (err) {
      setMigrateResult({
        success: false, stage: "push",
        steps: [{ name: "push", success: false, output: err instanceof Error ? err.message : "Migration failed." }],
        relPath: "", schemaRelPath: "",
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

  return {
    dbStatus,
    loadingStatus,
    isInitialized: dbStatus?.initialized ?? false,
    migrateOpen, setMigrateOpen,
    migrating,
    migrateResult,
    deletingSchema,
    handleMigrate,
    handleDeleteSchema,
  };
}
