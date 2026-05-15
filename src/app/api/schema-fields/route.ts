import { NextResponse } from "next/server";
import { refreshProjectStats } from "@/lib/projects-store";
import {
  createModelField,
  deleteModelField,
  readModelFields,
  updateModelField,
  type PrismaNativeAttribute,
  type PrismaFieldInput,
} from "@/lib/schema-store";

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getBoolean(value: unknown) {
  return typeof value === "boolean" ? value : false;
}

function getStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.map(getString).filter(Boolean)
    : [];
}

function getNativeAttribute(value: unknown): PrismaNativeAttribute | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const name = getString(record.name);

  if (!["Uuid", "VarChar", "SmallInt", "Timestamptz"].includes(name)) {
    return undefined;
  }

  return {
    name: name as PrismaNativeAttribute["name"],
    args: getStringArray(record.args),
  };
}

function getFieldInput(body: Record<string, unknown>): PrismaFieldInput {
  return {
    name: getString(body.name),
    type: getString(body.type),
    nullable: getBoolean(body.nullable),
    unique: getBoolean(body.unique),
    defaultValue: getString(body.defaultValue),
    comment: getString(body.comment),
    nativeAttribute: getNativeAttribute(body.nativeAttribute),
    updatedAtAttribute:
      getBoolean(body.updatedAtAttribute) || getBoolean(body.updatedAt),
    isId: getBoolean(body.isId),
  };
}

function jsonError(error: unknown, status = 400) {
  const message =
    typeof error === "string"
      ? error
      : error instanceof Error
        ? error.message
        : "Schema field request failed.";

  return NextResponse.json(
    { error: message },
    { status },
  );
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
    const data = await readModelFields(projectName, version, modelName, modelKey);
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
    const data = await createModelField(
      projectName,
      version,
      modelName,
      getFieldInput(body),
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
  const oldFieldName = getString(body.oldFieldName);
  const fieldKey = getString(body.fieldKey);

  if (!projectName || !version || (!modelName && !modelKey) || (!oldFieldName && !fieldKey)) {
    return jsonError("Project name, version, model, and current field are required.");
  }

  try {
    const data = await updateModelField(
      projectName,
      version,
      modelName,
      oldFieldName,
      getFieldInput(body),
      modelKey,
      fieldKey,
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
  const fieldName = getString(body.fieldName);
  const fieldKey = getString(body.fieldKey);

  if (!projectName || !version || (!modelName && !modelKey) || (!fieldName && !fieldKey)) {
    return jsonError("Project name, version, model, and field are required.");
  }

  try {
    const data = await deleteModelField(
      projectName,
      version,
      modelName,
      fieldName,
      modelKey,
      fieldKey,
    );
    void refreshProjectStats(projectName);
    return NextResponse.json(data);
  } catch (error) {
    return jsonError(error);
  }
}
