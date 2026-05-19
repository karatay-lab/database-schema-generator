import { DashboardProvider } from "@/app/views/shared/dashboard-context";
import { DashboardShell } from "@/app/views/shared/dashboard-shell";
import { getUiState } from "@/lib/db/ui-state";
import { trpc, HydrateClient, getQueryClient } from "@/trpc/server";
import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

export default async function WorkflowLayout({ children }: { children: ReactNode }) {
  const { activeProjectId, activeVersionsMap } = getUiState();

  const queryClient = getQueryClient();
  await queryClient.prefetchQuery(trpc.projects.list.queryOptions());

  return (
    <HydrateClient>
      <DashboardProvider
        initialProjectId={activeProjectId ?? undefined}
        initialVersionsMap={activeVersionsMap}
      >
        <DashboardShell>{children}</DashboardShell>
      </DashboardProvider>
    </HydrateClient>
  );
}
