import { NextResponse } from "next/server";
import {
  addModel,
  modelExistsInSchema,
  readSchema,
  updateModel,
} from "@/lib/schema-store";
import { refreshProjectStats } from "@/lib/projects-store";

function jsonError(error: unknown, status = 500) {
  const message = error instanceof Error ? error.message : "Request failed.";
  return NextResponse.json({ error: message }, { status });
}

const prismaIdentifierPattern = /^[a-zA-Z][a-zA-Z0-9_]*$/;
const validPkTypes = ["String", "Int", "BigInt", "DateTime", "Uuid"];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectName = searchParams.get("projectName") ?? "";
  const version = searchParams.get("version") ?? "";

  try {
    const models = await readSchema(projectName, version);
    return NextResponse.json({ models });
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    modelName?: unknown;
    pkName?: unknown;
    pkType?: unknown;
    projectName?: unknown;
    version?: unknown;
  };

  const projectName = typeof body.projectName === "string" ? body.projectName : "";
  const version = typeof body.version === "string" ? body.version : "";
  const modelName = typeof body.modelName === "string" ? body.modelName.trim() : "";
  const pkName = typeof body.pkName === "string" ? body.pkName.trim() : "id";
  const pkType = typeof body.pkType === "string" ? body.pkType : "String";

  if (!projectName || !version) {
    return NextResponse.json(
      { error: "Project name and version are required." },
      { status: 400 },
    );
  }

  if (!modelName) {
    return NextResponse.json(
      { error: "Model name is required." },
      { status: 400 },
    );
  }

  if (!validPkTypes.includes(pkType)) {
    return NextResponse.json(
      { error: "Invalid primary key type." },
      { status: 400 },
    );
  }

  if (!prismaIdentifierPattern.test(modelName)) {
    return NextResponse.json(
      { error: "Model name must start with a letter and contain only letters, numbers, and underscores." },
      { status: 400 },
    );
  }

  if (!prismaIdentifierPattern.test(pkName)) {
    return NextResponse.json(
      { error: "Primary key name must start with a letter and contain only letters, numbers, and underscores." },
      { status: 400 },
    );
  }

  const exists = await modelExistsInSchema(projectName, version, modelName);
  if (exists) {
    return NextResponse.json(
      { error: "A model with this name already exists." },
      { status: 400 },
    );
  }

  try {
    await addModel(projectName, version, modelName, pkName, pkType);
    const models = await readSchema(projectName, version);
    void refreshProjectStats(projectName);
    return NextResponse.json({ models }, { status: 201 });
  } catch (err) {
    return jsonError(err);
  }
}

export async function PATCH(request: Request) {
  const body = (await request.json()) as {
    newModelName?: unknown;
    oldModelName?: unknown;
    modelKey?: unknown;
    projectName?: unknown;
    version?: unknown;
    pkName?: unknown;
    pkType?: unknown;
  };

  const projectName = typeof body.projectName === "string" ? body.projectName : "";
  const version = typeof body.version === "string" ? body.version : "";
  const oldModelName =
    typeof body.oldModelName === "string" ? body.oldModelName.trim() : "";
  const modelKey = typeof body.modelKey === "string" ? body.modelKey.trim() : "";
  const newModelName =
    typeof body.newModelName === "string" ? body.newModelName.trim() : "";
  const pkName = typeof body.pkName === "string" ? body.pkName.trim() : "";
  const pkType = typeof body.pkType === "string" ? body.pkType : "";

  if (!projectName || !version) {
    return NextResponse.json(
      { error: "Project name and version are required." },
      { status: 400 },
    );
  }

  if (!oldModelName && !modelKey) {
    return NextResponse.json(
      { error: "Current model is required." },
      { status: 400 },
    );
  }

  if (!newModelName) {
    return NextResponse.json(
      { error: "New model name is required." },
      { status: 400 },
    );
  }

  if (!pkName) {
    return NextResponse.json(
      { error: "Primary key name is required." },
      { status: 400 },
    );
  }

  if (!pkType) {
    return NextResponse.json(
      { error: "Primary key type is required." },
      { status: 400 },
    );
  }

  if (!validPkTypes.includes(pkType)) {
    return NextResponse.json(
      { error: "Invalid primary key type." },
      { status: 400 },
    );
  }

  if (!prismaIdentifierPattern.test(pkName)) {
    return NextResponse.json(
      { error: "Primary key name must start with a letter and contain only letters, numbers, and underscores." },
      { status: 400 },
    );
  }

  if (newModelName !== oldModelName) {
    if (!prismaIdentifierPattern.test(newModelName)) {
      return NextResponse.json(
        { error: "Model name must start with a letter and contain only letters, numbers, and underscores." },
        { status: 400 },
      );
    }

    const exists = await modelExistsInSchema(projectName, version, newModelName);
    if (exists) {
      return NextResponse.json(
        { error: "A model with this name already exists." },
        { status: 400 },
      );
    }
  }

  try {
    await updateModel(
      projectName,
      version,
      oldModelName,
      newModelName,
      pkName,
      pkType,
      modelKey,
    );
    const models = await readSchema(projectName, version);
    void refreshProjectStats(projectName);
    return NextResponse.json({ models });
  } catch (err) {
    return jsonError(err);
  }
}
