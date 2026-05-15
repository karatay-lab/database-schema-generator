"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useDashboard } from "./dashboard-context";

export type ProjectInfo = {
  /** Raw project UUID — e.g. "project-abc123" */
  projectId: string;
  /** Trimmed display name — empty string when no project is active */
  projectName: string;
  /** Currently selected version name — e.g. "1.0112" */
  version: string;
  /** All version names for the active project, oldest first */
  versions: string[];
  /** DB provider label — "Postgres" | "MySQL" | "SQLite" */
  provider: string;
  /** False when no project exists or has been selected yet */
  hasProject: boolean;
};

const ProjectInfoContext = createContext<ProjectInfo | null>(null);

export function ProjectInfoProvider({ children }: { children: ReactNode }) {
  const { activeProject, activeProjectId, selectedVersion, activeVersions } = useDashboard();

  const value = useMemo<ProjectInfo>(
    () => ({
      projectId: activeProjectId,
      projectName: activeProject?.name.trim() ?? "",
      version: selectedVersion,
      versions: activeVersions,
      provider: activeProject?.provider ?? "",
      hasProject: Boolean(activeProject),
    }),
    [activeProject, activeProjectId, selectedVersion, activeVersions],
  );

  return <ProjectInfoContext.Provider value={value}>{children}</ProjectInfoContext.Provider>;
}

export function useProjectInfo(): ProjectInfo {
  const ctx = useContext(ProjectInfoContext);
  if (!ctx) throw new Error("useProjectInfo must be used inside ProjectInfoProvider");
  return ctx;
}
