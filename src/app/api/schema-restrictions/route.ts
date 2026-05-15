import { NextResponse } from "next/server";
import { refreshProjectStats } from "@/lib/projects-store";
import {
  createModelRestriction,
  deleteModelRestriction,
  readModelRestrictions,
  updateModelRestriction,
  type PrismaRestrictionType,
} from "@/lib/schema-store";

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.map(getString).filter(Boolean)
    : [];
}

function getRestrictionType(value: unknown): PrismaRestrictionType {
  const type = getString(value);

  if (type !== "UNIQUE" && type !== "INDEX") {
    throw new Error("Restriction type must be Unique or Index.");
  }

  return type;
}

function getRestrictionInput(body: Record<string, unknown>) {
  return {
    type: getRestrictionType(body.type),
    fields: getStringArray(body.fields),
    dbName: getString(body.dbName),
  };
}

function jsonError(error: unknown, status = 400) {
  const message =
    typeof error === "string"
      ? error
      : error instanceof Error
        ? error.message
        : "Schema restriction request failed.";

  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectName = searchParams.get("projectName") ?? "";
  const version = searchParams.get("version") ?? "";
  const modelName = searchParams.get("modelName") ?? "";
  const modelKey = searchParams.get("modelKey") ?? "";

  if (!projectName || !version || (!modelName && !modelKey)) {
    return jsonError("Project name, version, and model are required.");
  }

  try {
    const data = await readModelRestrictions(
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
    const data = await createModelRestriction(
      projectName,
      version,
      modelName,
      getRestrictionInput(body),
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
  const restrictionKey = getString(body.restrictionKey);

  if (!projectName || !version || (!modelName && !modelKey) || !restrictionKey) {
    return jsonError("Project name, version, model, and restriction are required.");
  }

  try {
    const data = await updateModelRestriction(
      projectName,
      version,
      modelName,
      restrictionKey,
      getRestrictionInput(body),
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
  const restrictionKey = getString(body.restrictionKey);

  if (!projectName || !version || (!modelName && !modelKey) || !restrictionKey) {
    return jsonError("Project name, version, model, and restriction are required.");
  }

  try {
    const data = await deleteModelRestriction(
      projectName,
      version,
      modelName,
      restrictionKey,
      modelKey,
    );
    void refreshProjectStats(projectName);
    return NextResponse.json(data);
  } catch (error) {
    return jsonError(error);
  }
}
