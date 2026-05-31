"use client";

import { useEffect, useState } from "react";
import type { CheckSyncResponse, MigrationPlan } from "@/types/migrations";

export function useSyncCheck({
  projectName,
  activeConnectionId,
  syncVersion,
  migrationPlan,
  connectState,
}: {
  projectName: string;
  activeConnectionId: string;
  syncVersion: string;
  migrationPlan: MigrationPlan | null;
  connectState: string;
}) {
  const [syncCheckState, setSyncCheckState] = useState<"idle" | "loading" | "compatible" | "incompatible">("idle");
  const [syncCheckResult, setSyncCheckResult] = useState<CheckSyncResponse | null>(null);

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

  return { syncCheckState, syncCheckResult };
}
