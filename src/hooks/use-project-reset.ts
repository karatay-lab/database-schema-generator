"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function useProjectReset() {
  const router = useRouter();
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetConfirmation, setResetConfirmation] = useState("");
  const [isResetting, setIsResetting] = useState(false);
  const [resetError, setResetError] = useState("");

  const openReset = () => { setShowResetConfirm(true); setResetConfirmation(""); setResetError(""); };
  const closeReset = () => { setShowResetConfirm(false); setResetConfirmation(""); };

  const confirmReset = async () => {
    if (resetConfirmation !== "RESET") return;
    setIsResetting(true);
    setResetError("");
    try {
      const res = await fetch("/api/reset", { method: "POST" });
      const data = await res.json() as { success: boolean; error?: string };
      if (!data.success) throw new Error(data.error ?? "Reset failed.");
      closeReset();
      router.push("/");
    } catch (err) {
      setResetError(err instanceof Error ? err.message : "Reset failed.");
    } finally {
      setIsResetting(false);
    }
  };

  return {
    showResetConfirm, openReset, closeReset,
    resetConfirmation, setResetConfirmation,
    isResetting, resetError,
    confirmReset,
  };
}
