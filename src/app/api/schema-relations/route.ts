import { NextResponse } from "next/server";
import { refreshProjectStats } from "@/lib/projects-store";
import {
  createModelRelation,
  deleteModelRelation,
  readModelRelations,
  updateModelRelation,
  type PrismaRelationInput,
} from "@/lib/schema-store";

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getBoolean(value: unknown) {
  return typeof value === "boolean" ? value : false;
}

function getStringArray(value: unknown) {
  if (Array.isArray(value)) {
    return value.map(getString).filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function getRelationInput(body: Record<string, unknown>): PrismaRelationInput {
  return {
    name: getString(body.name),
    targetModel: getString(body.targetModel),
    backReferenceName: getString(body.backReferenceName),
    fields: getStringArray(body.fields),
    references: getStringArray(body.references),
    onDelete: getString(body.onDelete),
    onUpdate: getString(body.onUpdate),
    nullable: getBoolean(body.nullable),
    isArray: getBoolean(body.isArray),
    backReferenceIsArray:
      body.backReferenceIsArray === undefined
        ? true
        : getBoolean(body.backReferenceIsArray),
  };
}

function jsonError(error: unknown, status = 400) {
  const message =
    typeof error === "string"
      ? error
      : error instanceof Error
        ? error.message
        : "Schema relation request failed.";

  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectName = getString(searchParams.get("projectName"));
  const version = getString(searchParams.get("version"));
  const modelName = getString(searchParams.get("modelName"));
  const modelKey = getString(searchParams.get("modelKey"));

  if (!projectName || !version || (!modelName && !modelKey)) {
    return jsonError("Project name, version, and model are required.");
  }

  try {
    const data = await readModelRelations(
      projectName,
      version,
      modelName,
      modelKey,
    );
    return NextResponse.json(data);
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  const body = (await request.json()) as Record<string, unknown>;
  const projectName = getString(body.projectName);
  const version = getString(body.version);
  const modelName = getString(body.modelName);
  const modelKey = getString(body.modelKey);

  if (!projectName || !version || (!modelName && !modelKey)) {
    return jsonError("Project name, version, and model are required.");
  }

  try {
    const data = await createModelRelation(
      projectName,
      version,
      modelName,
      getRelationInput(body),
      modelKey,
    );
    void refreshProjectStats(projectName);
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: Request) {
  const body = (await request.json()) as Record<string, unknown>;
  const projectName = getString(body.projectName);
  const version = getString(body.version);
  const modelName = getString(body.modelName);
  const modelKey = getString(body.modelKey);
  const relationKey = getString(body.relationKey);

  if (!projectName || !version || (!modelName && !modelKey) || !relationKey) {
    return jsonError("Project name, version, model, and relation are required.");
  }

  try {
    const data = await updateModelRelation(
      projectName,
      version,
      modelName,
      relationKey,
      getRelationInput(body),
      modelKey,
    );
    void refreshProjectStats(projectName);
    return NextResponse.json(data);
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: Request) {
  const body = (await request.json()) as Record<string, unknown>;
  const projectName = getString(body.projectName);
  const version = getString(body.version);
  const modelName = getString(body.modelName);
  const modelKey = getString(body.modelKey);
  const relationKey = getString(body.relationKey);

  if (!projectName || !version || (!modelName && !modelKey) || !relationKey) {
    return jsonError("Project name, version, model, and relation are required.");
  }

  try {
    const data = await deleteModelRelation(
      projectName,
      version,
      modelName,
      relationKey,
      modelKey,
    );
    void refreshProjectStats(projectName);
    return NextResponse.json(data);
  } catch (error) {
    return jsonError(error);
  }
}
