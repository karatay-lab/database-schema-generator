import { NextResponse } from "next/server";
import { getUiState, setActiveProject, setVersionForProject, setActiveVersionsMap } from "@/lib/db/ui-state";

export const dynamic = "force-dynamic";

export async function GET() {
  const state = getUiState();
  return NextResponse.json(state);
}

export async function PATCH(request: Request) {
  const body = (await request.json()) as {
    activeProjectId?: string;
    activeVersionsMap?: Record<string, string>;
    projectId?: string;
    version?: string;
  };

  if (body.activeProjectId) {
    setActiveProject(body.activeProjectId);
  }

  if (body.activeVersionsMap) {
    setActiveVersionsMap(body.activeVersionsMap);
  }

  if (body.projectId && body.version) {
    setVersionForProject(body.projectId, body.version);
  }

  return NextResponse.json(getUiState());
}
