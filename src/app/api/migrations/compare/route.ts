import { NextResponse } from "next/server";
import type {
  CompareResponse,
  FieldMatchResult,
  ModelComparisonResult,
  ModelMatchResult,
} from "@/types/migrations";
import { db } from "@/lib/db/client";

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

type CanonicalField = {
  key: string;
  fieldId?: string;
  name: string;
  type: string;
  nullable: boolean;
  default: string;
  comment: string;
  constraints: unknown[];
  array?: boolean;
  relation?: unknown;
};

type CanonicalModel = {
  key: string;
  tableId?: string;
  name: string;
  description: string;
  fields: CanonicalField[];
  restrictions: unknown[];
};

type CanonicalModelStore = {
  models: CanonicalModel[];
};

function readModelStoreFromDb(projectName: string, version: string): CanonicalModelStore | null {
  try {
    const projectRow = db.prepare("SELECT id FROM projects WHERE name = ?").get(projectName) as { id: string } | undefined;
    if (!projectRow) return null;
    const storeRow = db.prepare("SELECT content FROM model_stores WHERE project_id = ? AND version = ?").get(projectRow.id, version) as { content: string } | undefined;
    if (!storeRow) return null;
    return JSON.parse(storeRow.content) as CanonicalModelStore;
  } catch {
    return null;
  }
}

function fieldStableId(f: CanonicalField): string {
  return f.fieldId ?? f.key;
}

function compareFields(
  fromFields: CanonicalField[],
  toFields: CanonicalField[],
): {
  matchedFields: FieldMatchResult[];
  addedFields: { key: string; name: string; type: string; nullable: boolean }[];
  removedFields: { key: string; name: string; type: string; nullable: boolean }[];
} {
  // Match by stable fieldId (falls back to key for data created before fieldId existed)
  const fromMap = new Map(fromFields.map((f) => [fieldStableId(f), f]));
  const toMap = new Map(toFields.map((f) => [fieldStableId(f), f]));

  const matchedFields: FieldMatchResult[] = [];
  const addedFields: { key: string; name: string; type: string; nullable: boolean }[] = [];
  const removedFields: { key: string; name: string; type: string; nullable: boolean }[] = [];

  for (const [stableId, toField] of toMap) {
    const fromField = fromMap.get(stableId);
    if (!fromField) {
      addedFields.push({ key: stableId, name: toField.name, type: toField.type, nullable: toField.nullable });
      continue;
    }
    matchedFields.push({
      key: stableId,
      fromName: fromField.name,
      toName: toField.name,
      fromType: fromField.type,
      toType: toField.type,
      fromNullable: fromField.nullable,
      toNullable: toField.nullable,
      fromDefault: fromField.default ?? "",
      toDefault: toField.default ?? "",
      fromComment: fromField.comment ?? "",
      toComment: toField.comment ?? "",
      nameChanged: fromField.name !== toField.name,
      typeChanged: fromField.type !== toField.type,
      nullabilityChanged: fromField.nullable !== toField.nullable,
      defaultChanged: (fromField.default ?? "") !== (toField.default ?? ""),
      commentChanged: (fromField.comment ?? "") !== (toField.comment ?? ""),
      isRelation: !!toField.relation || !!fromField.relation,
    });
  }

  for (const [stableId, fromField] of fromMap) {
    if (!toMap.has(stableId)) {
      removedFields.push({ key: stableId, name: fromField.name, type: fromField.type, nullable: fromField.nullable });
    }
  }

  return { matchedFields, addedFields, removedFields };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectName = getString(searchParams.get("projectName"));
  const fromVersion = getString(searchParams.get("fromVersion"));
  const toVersion = getString(searchParams.get("toVersion"));

  if (!projectName || !fromVersion || !toVersion) {
    return NextResponse.json<CompareResponse>(
      { success: false, error: "projectName, fromVersion, and toVersion are required." },
      { status: 400 },
    );
  }

  if (fromVersion === toVersion) {
    return NextResponse.json<CompareResponse>(
      { success: false, error: "fromVersion and toVersion must be different." },
      { status: 400 },
    );
  }

  try {
    const fromStore = readModelStoreFromDb(projectName, fromVersion);
    const toStore = readModelStoreFromDb(projectName, toVersion);

    if (!fromStore) {
      return NextResponse.json<CompareResponse>(
        { success: false, error: `Model store not found for version ${fromVersion}.` },
        { status: 404 },
      );
    }
    if (!toStore) {
      return NextResponse.json<CompareResponse>(
        { success: false, error: `Model store not found for version ${toVersion}.` },
        { status: 404 },
      );
    }

    // Match models by stable tableId (falls back to key for older data)
    const modelStableId = (m: CanonicalModel) => m.tableId ?? m.key;
    const fromModelMap = new Map(fromStore.models.map((m) => [modelStableId(m), m]));
    const toModelMap = new Map(toStore.models.map((m) => [modelStableId(m), m]));

    const matchedModels: ModelMatchResult[] = [];
    const addedModels: { key: string; name: string }[] = [];
    const removedModels: { key: string; name: string }[] = [];

    for (const [stableId, toModel] of toModelMap) {
      const fromModel = fromModelMap.get(stableId);
      if (!fromModel) {
        addedModels.push({ key: stableId, name: toModel.name });
        continue;
      }
      const { matchedFields, addedFields, removedFields } = compareFields(
        fromModel.fields,
        toModel.fields,
      );
      const hasChanges =
        fromModel.name !== toModel.name ||
        addedFields.length > 0 ||
        removedFields.length > 0 ||
        matchedFields.some(
          (f) => f.nameChanged || f.typeChanged || f.nullabilityChanged || f.defaultChanged || f.commentChanged,
        );
      matchedModels.push({
        key: stableId,
        fromName: fromModel.name,
        toName: toModel.name,
        nameChanged: fromModel.name !== toModel.name,
        hasChanges,
        matchedFields,
        addedFields,
        removedFields,
      });
    }

    for (const [stableId, fromModel] of fromModelMap) {
      if (!toModelMap.has(stableId)) {
        removedModels.push({ key: stableId, name: fromModel.name });
      }
    }

    const totalFieldChanges = matchedModels.reduce((sum, m) => {
      const changed = m.matchedFields.filter(
        (f) => f.nameChanged || f.typeChanged || f.nullabilityChanged || f.defaultChanged || f.commentChanged,
      ).length;
      return sum + changed + m.addedFields.length + m.removedFields.length;
    }, 0);

    const comparison: ModelComparisonResult = {
      fromVersion,
      toVersion,
      matchedModels,
      addedModels,
      removedModels,
      totalFieldChanges,
    };

    return NextResponse.json<CompareResponse>({ success: true, comparison });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Comparison failed.";
    return NextResponse.json<CompareResponse>({ success: false, error: message }, { status: 500 });
  }
}
