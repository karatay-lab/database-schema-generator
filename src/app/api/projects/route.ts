import { NextResponse } from "next/server";
import {
  createProject,
  deleteProject,
  readProjects,
  updateProject,
} from "@/lib/projects-store";
import {
  graphqlOptions,
  prismaClients,
  providers,
} from "@/constants/projects";

export async function GET() {
  const projects = await readProjects();
  return NextResponse.json({ projects });
}

export async function DELETE(request: Request) {
  const body = (await request.json()) as { id?: unknown };

  if (typeof body.id !== "string") {
    return NextResponse.json(
      { error: "Project id is required." },
      { status: 400 },
    );
  }

  const projects = await deleteProject(body.id);

  return NextResponse.json({ projects });
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    client?: unknown;
    graphql?: unknown;
    name?: unknown;
    provider?: unknown;
  };
  const name = typeof body.name === "string" ? body.name : "";
  const provider = typeof body.provider === "string" ? body.provider : "";
  const client = typeof body.client === "string" ? body.client : "";
  const graphql = typeof body.graphql === "string" ? body.graphql : "";
  const trimmedName = name.trim();

  if (trimmedName.length < 8) {
    return NextResponse.json(
      { error: "Project name must be at least 8 characters." },
      { status: 400 },
    );
  }

  if (!providers.includes(provider)) {
    return NextResponse.json(
      { error: "A valid DB provider is required." },
      { status: 400 },
    );
  }

  if (!prismaClients.includes(client)) {
    return NextResponse.json(
      { error: "A valid Prisma client is required." },
      { status: 400 },
    );
  }

  if (!graphqlOptions.includes(graphql)) {
    return NextResponse.json(
      { error: "A valid GraphQL option is required." },
      { status: 400 },
    );
  }

  const projects = await readProjects();
  const nameExists = projects.some(
    (project) => project.name.trim().toLowerCase() === trimmedName.toLowerCase(),
  );

  if (nameExists) {
    return NextResponse.json(
      { error: "Project name must be unique." },
      { status: 400 },
    );
  }

  const project = await createProject(trimmedName, provider, {
    client,
    graphql,
  });

  return NextResponse.json({ project }, { status: 201 });
}

export async function PATCH(request: Request) {
  const body = (await request.json()) as {
    client?: unknown;
    graphql?: unknown;
    id?: unknown;
    name?: unknown;
    provider?: unknown;
  };
  const name = typeof body.name === "string" ? body.name : "";
  const provider = typeof body.provider === "string" ? body.provider : "";
  const client = typeof body.client === "string" ? body.client : "";
  const graphql = typeof body.graphql === "string" ? body.graphql : "";
  const trimmedName = name.trim();

  if (typeof body.id !== "string") {
    return NextResponse.json(
      { error: "Project id is required." },
      { status: 400 },
    );
  }

  if (trimmedName.length < 8) {
    return NextResponse.json(
      { error: "Project name must be at least 8 characters." },
      { status: 400 },
    );
  }

  if (!providers.includes(provider)) {
    return NextResponse.json(
      { error: "A valid DB provider is required." },
      { status: 400 },
    );
  }

  if (!prismaClients.includes(client)) {
    return NextResponse.json(
      { error: "A valid Prisma client is required." },
      { status: 400 },
    );
  }

  if (!graphqlOptions.includes(graphql)) {
    return NextResponse.json(
      { error: "A valid GraphQL option is required." },
      { status: 400 },
    );
  }

  const currentProjects = await readProjects();
  const projectExists = currentProjects.some((project) => project.id === body.id);
  const nameExists = currentProjects.some(
    (project) =>
      project.id !== body.id &&
      project.name.trim().toLowerCase() === trimmedName.toLowerCase(),
  );

  if (!projectExists) {
    return NextResponse.json(
      { error: "Project could not be found." },
      { status: 404 },
    );
  }

  if (nameExists) {
    return NextResponse.json(
      { error: "Project name must be unique." },
      { status: 400 },
    );
  }

  const projects = await updateProject(body.id, trimmedName, provider, {
    client,
    graphql,
  });

  return NextResponse.json({ projects });
}
