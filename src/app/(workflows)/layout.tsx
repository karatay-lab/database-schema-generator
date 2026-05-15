import { DashboardProvider } from "@/app/views/shared/dashboard-context";
import { DashboardShell } from "@/app/views/shared/dashboard-shell";
import { readProjects } from "@/lib/projects-store";
import { getUiState } from "@/lib/db/ui-state";
import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

export default async function WorkflowLayout({ children }: { children: ReactNode }) {
  const projects = await readProjects();
  const { activeProjectId, activeVersionsMap } = getUiState();

  const resolvedProjectId =
    activeProjectId ??
    projects[0]?.id ??
    "";

  return (
    <DashboardProvider
      initialProjectList={projects}
      initialProjectId={resolvedProjectId}
      initialVersionsMap={activeVersionsMap}
    >
      <DashboardShell>{children}</DashboardShell>
    </DashboardProvider>
  );
}
