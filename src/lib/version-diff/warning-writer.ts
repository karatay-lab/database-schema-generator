import "server-only";
import { randomUUID } from "crypto";
import { db } from "@/lib/db/client";
import { upsertWarnings, type NewSchemaWarning } from "@/lib/schema-warnings-store";
import { getTypeResolution, getPkTypeResolution, worstResolution, type Resolution } from "@/solutions/type-conversion-matrix";
import type { VersionDiff, FieldDiff, TableDiff, EnumDiff, RelationDiff } from "@/lib/version-diff/detect-changes";

function projectIdFromName(projectName: string): string | null {
  const row = db
    .prepare("SELECT id FROM projects WHERE name = ?")
    .get(projectName) as { id: string } | undefined;
  return row?.id ?? null;
}

function fieldResolution(fd: FieldDiff): Resolution | null {
  switch (fd.changeKind) {
    case "added":
      return fd.severity === "warning" ? "backfill_required" : null;
    case "removed":
      return "data_deleted";
    case "renamed":
      return null; // safe
    case "nullability_changed":
      return fd.message.includes("Made required") ? "backfill_required" : null;
    case "default_changed":
      return "backfill_required";
    case "type_changed": {
      const r = getTypeResolution(fd.from, fd.to);
      return r === "safe" ? null : r;
    }
    case "pk_type_changed": {
      const r = getPkTypeResolution(fd.from, fd.to);
      return r === "safe" ? null : r;
    }
    case "multiple": {
      const parts: (Resolution | undefined)[] = [];
      if (fd.from !== fd.to) parts.push(getTypeResolution(fd.from, fd.to));
      if (fd.message.includes("Made required") || fd.message.includes("Default removed")) parts.push("backfill_required");
      const worst = worstResolution(...parts);
      return worst === "safe" ? null : worst;
    }
    default:
      return null;
  }
}

function tableWarning(projectId: string, fromVersion: string, toVersion: string, td: TableDiff): NewSchemaWarning | null {
  if (td.changeKind !== "removed") return null;
  return {
    id: randomUUID(),
    projectId,
    fromVersion,
    toVersion,
    entityKind: "table",
    entityId: td.tableId,
    entityName: td.tableName,
    changeKind: td.changeKind,
    resolution: "data_deleted",
    fromValue: null,
    toValue: null,
    message: `Table "${td.tableName}" was removed. All data in this table will be permanently deleted when migrating.`,
  };
}

function fieldWarnings(projectId: string, fromVersion: string, toVersion: string, tableName: string, fds: FieldDiff[]): NewSchemaWarning[] {
  const results: NewSchemaWarning[] = [];
  for (const fd of fds) {
    const resolution = fieldResolution(fd);
    if (!resolution) continue;
    results.push({
      id: randomUUID(),
      projectId,
      fromVersion,
      toVersion,
      entityKind: "field",
      entityId: fd.fieldId,
      entityName: `${tableName}.${fd.fieldName}`,
      changeKind: fd.changeKind,
      resolution,
      fromValue: fd.from || null,
      toValue: fd.to || null,
      message: fd.message,
    });
  }
  return results;
}

function enumWarning(projectId: string, fromVersion: string, toVersion: string, ed: EnumDiff): NewSchemaWarning | null {
  if (ed.changeKind === "added") return null;
  if (ed.changeKind === "values_changed" && ed.removedValues.length === 0) return null;
  return {
    id: randomUUID(),
    projectId,
    fromVersion,
    toVersion,
    entityKind: "enum",
    entityId: ed.enumId,
    entityName: ed.enumName,
    changeKind: ed.changeKind,
    resolution: "data_deleted",
    fromValue: ed.removedValues.length > 0 ? ed.removedValues.join(", ") : null,
    toValue: ed.addedValues.length > 0 ? ed.addedValues.join(", ") : null,
    message: ed.message,
  };
}

function relationWarning(projectId: string, fromVersion: string, toVersion: string, rd: RelationDiff): NewSchemaWarning | null {
  if (rd.changeKind !== "removed") return null;
  return {
    id: randomUUID(),
    projectId,
    fromVersion,
    toVersion,
    entityKind: "relation",
    entityId: rd.relationId,
    entityName: `${rd.sourceTableName}.${rd.fieldName} → ${rd.targetTableName}`,
    changeKind: rd.changeKind,
    resolution: "data_deleted",
    fromValue: null,
    toValue: null,
    message: rd.message,
  };
}

export function writeWarningsForDiff(
  projectName: string,
  fromVersion: string,
  toVersion: string,
  diff: VersionDiff,
): void {
  const projectId = projectIdFromName(projectName);
  if (!projectId) return;

  const warnings: NewSchemaWarning[] = [];

  for (const td of diff.tableDiffs) {
    const tw = tableWarning(projectId, fromVersion, toVersion, td);
    if (tw) warnings.push(tw);
    const fws = fieldWarnings(projectId, fromVersion, toVersion, td.tableName, td.fieldDiffs);
    warnings.push(...fws);
  }

  for (const ed of diff.enumDiffs) {
    const ew = enumWarning(projectId, fromVersion, toVersion, ed);
    if (ew) warnings.push(ew);
  }

  for (const rd of diff.relationDiffs) {
    const rw = relationWarning(projectId, fromVersion, toVersion, rd);
    if (rw) warnings.push(rw);
  }

  if (warnings.length > 0) upsertWarnings(warnings);
}
