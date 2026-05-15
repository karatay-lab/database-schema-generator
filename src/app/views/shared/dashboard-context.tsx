"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import {
  type Project,
  type SchemaOptions,
} from "./dashboard-data";

type DashboardContextValue = {
  activeProject: Project | null;
  activeProjectId: string;
  activeVersions: string[];
  createProject: (name: string, provider: string, schemaOptions: SchemaOptions) => Promise<void>;
  databaseName: string;
  deleteProject: (projectId: string) => Promise<void>;
  forkVersion: (projectId: string) => Promise<string>;
  projectName: string;
  projects: Project[];
  selectedProvider: string;
  selectedVersion: string;
  setActiveProjectId: (projectId: string) => void;
  setSelectedVersion: (version: string) => void;
  updateProject: (projectId: string, name: string, provider: string, schemaOptions: SchemaOptions) => Promise<void>;
  versionName: string;
};

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

export function DashboardProvider({
  children,
  initialProjectList,
  initialProjectId,
  initialVersionsMap = {},
}: {
  children: ReactNode;
  initialProjectList: Project[];
  initialProjectId?: string;
  initialVersionsMap?: Record<string, string>;
}) {
  const [projects, setProjects] = useState<Project[]>(initialProjectList);
  const [activeProjectId, setActiveProjectIdState] = useState<string>(
    initialProjectId ?? initialProjectList[0]?.id ?? "",
  );

  const [selectedVersions, setSelectedVersions] = useState<Record<string, string>>(() => {
    const fromServer: Record<string, string> = { ...initialVersionsMap };
    // Fill in any missing projects with their first version
    for (const p of initialProjectList) {
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

  const selectedProvider = activeProject?.provider ?? "No DB";
  const projectName = activeProject?.name.trim() || "No project";
  const databaseName = activeProject ? `Database-${projectName}` : "No database";

  const activeVersions = useMemo(
    () => activeProject?.versions.map((v) => v.name) ?? [],
    [activeProject],
  );

  const selectedVersion =
    (activeProject ? selectedVersions[activeProject.id] : undefined) ??
    activeVersions[0] ??
    "No version";

  const versionName = selectedVersion;

  const setSelectedVersion = useCallback((version: string) => {
    if (!activeProject) return;
    setSelectedVersions((cur) => ({ ...cur, [activeProject.id]: version }));
    void persistVersion(activeProject.id, version);
  }, [activeProject]);

  const createProject = async (name: string, provider: string, schemaOptions: SchemaOptions) => {
    const response = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, provider, ...schemaOptions }),
    });
    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      throw new Error(data.error ?? "Project could not be created.");
    }
    const data = (await response.json()) as { project: Project };
    const newProject = data.project;
    setProjects((cur) => [...cur, newProject]);
    setActiveProjectId(newProject.id);
    setSelectedVersions((cur) => ({ ...cur, [newProject.id]: newProject.versions[0]?.name ?? "1.0111" }));
  };

  const updateProject = async (projectId: string, name: string, provider: string, schemaOptions: SchemaOptions) => {
    const response = await fetch("/api/projects", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: projectId, name, provider, ...schemaOptions }),
    });
    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      throw new Error(data.error ?? "Project could not be updated.");
    }
    const data = (await response.json()) as { projects: Project[] };
    setProjects(data.projects);
  };

  const forkVersion = async (projectId: string): Promise<string> => {
    const response = await fetch("/api/projects/version", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId }),
    });
    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      throw new Error(data.error ?? "Could not create new version.");
    }
    const data = (await response.json()) as { projects: Project[]; newVersion: string };
    setProjects(data.projects);
    setSelectedVersions((cur) => ({ ...cur, [projectId]: data.newVersion }));
    void persistVersion(projectId, data.newVersion);
    return data.newVersion;
  };

  const deleteProject = async (projectId: string) => {
    const response = await fetch("/api/projects", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: projectId }),
    });
    if (!response.ok) throw new Error("Project could not be deleted.");
    const data = (await response.json()) as { projects: Project[] };
    const nextProjects = data.projects;
    const nextActive = nextProjects.find((p) => p.id === activeProjectId) ?? nextProjects[0] ?? null;
    setProjects(nextProjects);
    if (nextActive) setActiveProjectId(nextActive.id);
    setSelectedVersions((cur) => {
      const next = { ...cur };
      delete next[projectId];
      if (nextActive && !next[nextActive.id]) {
        next[nextActive.id] = nextActive.versions[0]?.name ?? "1.0111";
      }
      return next;
    });
  };

  return (
    <DashboardContext.Provider
      value={{
        activeProject,
        activeProjectId,
        activeVersions,
        createProject,
        databaseName,
        deleteProject,
        forkVersion,
        projectName,
        projects,
        selectedProvider,
        selectedVersion,
        setActiveProjectId,
        setSelectedVersion,
        updateProject,
        versionName,
      }}
    >
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (!context) throw new Error("useDashboard must be used within DashboardProvider");
  return context;
}
