"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useDashboard, useActiveProject } from "./dashboard-context";

export type ProjectInfo = {
  projectId: string;
  projectName: string;
  version: string;
  versions: string[];
  provider: string;
  hasProject: boolean;
};

const ProjectInfoContext = createContext<ProjectInfo | null>(null);

export function ProjectInfoProvider({ children }: { children: ReactNode }) {
  const { activeProjectId, selectedVersion } = useDashboard();
  const activeProject = useActiveProject();

  const value = useMemo<ProjectInfo>(
    () => ({
      projectId: activeProjectId,
      projectName: activeProject?.name.trim() ?? "",
      version: selectedVersion,
      versions: activeProject?.versions.map((v) => v.name) ?? [],
      provider: activeProject?.provider ?? "",
      hasProject: Boolean(activeProject),
    }),
    [activeProject, activeProjectId, selectedVersion],
  );

  return <ProjectInfoContext.Provider value={value}>{children}</ProjectInfoContext.Provider>;
}

export function useProjectInfo(): ProjectInfo {
  const ctx = useContext(ProjectInfoContext);
  if (!ctx) throw new Error("useProjectInfo must be used inside ProjectInfoProvider");
  return ctx;
}
