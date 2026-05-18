"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import type { SchemaOptions } from "./dashboard-data";

// ─── Types ────────────────────────────────────────────────────────────────────

type DashboardContextValue = {
  // UI state only — no project data / no API calls
  activeProjectId: string;
  selectedVersion: string;
  selectedVersions: Record<string, string>;
  setActiveProjectId: (projectId: string) => void;
  setSelectedVersion: (version: string) => void;
};

// ─── Context ──────────────────────────────────────────────────────────────────

const DashboardContext = createContext<DashboardContextValue | null>(null);

async function persistActiveProject(projectId: string) {
  await fetch("/api/ui-state", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ activeProjectId: projectId }),
  }).catch(() => {/* best-effort */});
}

async function persistVersion(projectId: string, version: string) {
  await fetch("/api/ui-state", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId, version }),
  }).catch(() => {/* best-effort */});
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function DashboardProvider({
  children,
  initialProjectId,
  initialVersionsMap = {},
}: {
  children: ReactNode;
  initialProjectId?: string;
  initialVersionsMap?: Record<string, string>;
}) {
  const trpc = useTRPC();
  const { data: projects = [] } = useQuery(trpc.projects.list.queryOptions());

  const [activeProjectId, setActiveProjectIdState] = useState<string>(
    initialProjectId ?? projects[0]?.id ?? "",
  );

  const [selectedVersions, setSelectedVersions] = useState<Record<string, string>>(() => {
    const fromServer: Record<string, string> = { ...initialVersionsMap };
    for (const p of projects) {
      if (!fromServer[p.id]) {
        fromServer[p.id] = p.versions[0]?.name ?? "1.0111";
      }
    }
    return fromServer;
  });

  const setActiveProjectId = useCallback((projectId: string) => {
    setActiveProjectIdState(projectId);
    void persistActiveProject(projectId);
  }, []);

  const activeProject = useMemo(
    () => projects.find((p) => p.id === activeProjectId) ?? projects[0] ?? null,
    [activeProjectId, projects],
  );

  const selectedVersion =
    (activeProject ? selectedVersions[activeProject.id] : undefined) ??
    activeProject?.versions[0]?.name ??
    "No version";

  const setSelectedVersion = useCallback(
    (version: string) => {
      if (!activeProject) return;
      setSelectedVersions((cur) => ({ ...cur, [activeProject.id]: version }));
      void persistVersion(activeProject.id, version);
    },
    [activeProject],
  );

  return (
    <DashboardContext.Provider
      value={{
        activeProjectId: activeProject?.id ?? activeProjectId,
        selectedVersion,
        selectedVersions,
        setActiveProjectId,
        setSelectedVersion,
      }}
    >
      {children}
    </DashboardContext.Provider>
  );
}

// ─── Consumer hook ────────────────────────────────────────────────────────────

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (!context) throw new Error("useDashboard must be used within DashboardProvider");
  return context;
}

// ─── Derived hook — gives callers the active project from tRPC cache ──────────

export function useActiveProject() {
  const trpc = useTRPC();
  const { data: projects = [] } = useQuery(trpc.projects.list.queryOptions());
  const { activeProjectId } = useDashboard();
  return useMemo(
    () => projects.find((p) => p.id === activeProjectId) ?? projects[0] ?? null,
    [activeProjectId, projects],
  );
}

// Re-export SchemaOptions so callers that previously imported from here still compile.
export type { SchemaOptions };
