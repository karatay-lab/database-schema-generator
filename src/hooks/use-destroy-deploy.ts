"use client";

import { useState } from "react";
import type { PhaseState, PushNewResponse, TestConnectionResponse } from "@/types/migrations";

export function useDestroyDeploy({
  projectName,
  activeConnectionId,
  versions,
}: {
  projectName: string;
  activeConnectionId: string;
  versions: string[];
}) {
  const [newTargetVersion, setNewTargetVersion] = useState(versions[versions.length - 1] ?? "");
  const [pushState, setPushState] = useState<PhaseState>("idle");
  const [pushError, setPushError] = useState("");
  const [lastPushMode, setLastPushMode] = useState<"safe" | "destroy" | null>(null);
  const [showDestroyModal, setShowDestroyModal] = useState(false);
  const [destroyConfirmText, setDestroyConfirmText] = useState("");
  const [destroyDbPreview, setDestroyDbPreview] = useState<{
    tables: { name: string; count: number }[];
    total: number;
  } | null>(null);
  const [destroyDbPreviewLoading, setDestroyDbPreviewLoading] = useState(false);

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

  const resetPush = () => {
    setPushState("idle");
    setPushError("");
    setLastPushMode(null);
  };

  return {
    newTargetVersion, setNewTargetVersion,
    pushState, setPushState, pushError, setPushError,
    lastPushMode, setLastPushMode,
    showDestroyModal, setShowDestroyModal,
    destroyConfirmText, setDestroyConfirmText,
    destroyDbPreview, destroyDbPreviewLoading,
    handleDestroyOpen,
    handlePushNew,
    resetPush,
  };
}
