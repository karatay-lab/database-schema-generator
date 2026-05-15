import { NextResponse } from "next/server";
import {
  createFieldTemplate,
  deleteFieldTemplate,
  readFieldTemplateStore,
  updateFieldTemplate,
  type FieldTemplateInput,
  type FieldTemplateUpdateInput,
} from "@/lib/field-template-store";
import type { PrismaNativeAttribute } from "@/lib/schema-store";

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

function getTemplateInput(body: Record<string, unknown>): FieldTemplateInput {
  const type = getString(body.type) || "String";

  return {
    name: getString(body.name),
    type,
    nullable: getBoolean(body.nullable),
    unique: type === "Boolean" ? false : getBoolean(body.unique),
    defaultValue: getString(body.defaultValue),
    comment: getString(body.comment),
    nativeAttribute: getNativeAttribute(body.nativeAttribute),
    updatedAtAttribute:
      getBoolean(body.updatedAtAttribute) || getBoolean(body.updatedAt),
    isId: getBoolean(body.isId),
  };
}

function getTemplateUpdateInput(
  body: Record<string, unknown>,
): FieldTemplateUpdateInput {
  return {
    ...getTemplateInput(body),
    id: getString(body.id),
  };
}

function jsonError(error: unknown, status = 400) {
  const message =
    typeof error === "string"
      ? error
      : error instanceof Error
        ? error.message
        : "Field template request failed.";

  return NextResponse.json({ error: message }, { status });
}

export async function GET() {
  try {
    const store = await readFieldTemplateStore();
    return NextResponse.json({
      templates: store.fields,
      fields: store.fields,
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const data = await createFieldTemplate(getTemplateInput(body));

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const input = getTemplateUpdateInput(body);

    if (!input.id) {
      return jsonError("Template field id is required.");
    }

    const data = await updateFieldTemplate(input);
    return NextResponse.json(data);
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const id = getString(body.id);

    if (!id) {
      return jsonError("Template field id is required.");
    }

    const data = await deleteFieldTemplate(id);
    return NextResponse.json(data);
  } catch (error) {
    return jsonError(error);
  }
}
