import type { Severity, StrategyName } from "@/constants/tracking";
import type { SchemaWarning } from "@/lib/schema-warnings-store";

export type TrackingEntryKind = "field_default" | "enum" | "enum_value";

export type TrackingChangeKind =
  | "added"
  | "removed"
  | "changed"
  | "renamed"
  | "value_added"
  | "value_removed";

export type TrackingEntry = {
  fromVersion: string;
  toVersion: string;
  entityKind: TrackingEntryKind;
  // primary entity: table name for field_default, enum name for enum/enum_value
  entityName: string;
  // secondary: field name for field_default, value name for enum_value, null for enum
  subName: string | null;
  changeKind: TrackingChangeKind;
  fromDisplay: string;
  toDisplay: string;
};

// Keep backward-compat exports used by the router
export type DefaultChangeKind = "added" | "removed" | "changed";

export type DefaultChange = {
  fromVersion: string;
  toVersion: string;
  tableName: string;
  fieldName: string;
  fieldId: string;
  fromKind: string;
  fromValue: string;
  toKind: string;
  toValue: string;
  changeType: DefaultChangeKind;
};

export function formatDefault(kind: string, value: string): string {
  if (kind === "none") return "—";
  if (kind === "autoincrement") return "autoincrement()";
  if (kind === "uuid" || kind === "cuid" || kind === "cuid2" || kind === "nanoid") return `${kind}()`;
  if (kind === "now") return "now()";
  if (kind === "dbgenerated") return value ? `dbgenerated("${value}")` : "dbgenerated()";
  if (kind === "sequence") return "sequence()";
  return value || kind;
}

// ─── Warning panel helpers ────────────────────────────────────────────────────

export function resolutionSeverity(w: SchemaWarning): Severity {
  if (w.approvedAt) {
    if (w.resolution === "backfill_required" && w.targetNullable === false && !w.replacementValue) return "warning";
    return "approved";
  }
  if (w.resolution === "data_deleted") return "breaking";
  if (w.resolution === "lossy_convert" || w.resolution === "precision_loss" || w.resolution === "backfill_required") return "warning";
  return "info";
}

export function warningNavHref(w: SchemaWarning): string {
  if (w.entityKind === "field")    return `/schema?table=${w.entityName.split(".")[0] ?? ""}`;
  if (w.entityKind === "enum")     return "/enums";
  if (w.entityKind === "relation") return "/relations";
  return "/tables";
}

export function resolveStrategy(w: SchemaWarning): StrategyName {
  if (!w.approvedAt) return "Pending";
  if (w.entityKind === "restriction") return "Acknowledged";
  if (w.entityKind === "enum" && w.changeKind === "value_removed") {
    return w.replacementValue ? "Remapped" : "Set NULL";
  }
  if (w.entityKind === "field") {
    const isUniquePrefix = w.targetUnique === true &&
      !["Int","BigInt","Float","Decimal","Boolean","DateTime","Json","Bytes"].includes(w.toValue ?? "");
    if (w.resolution === "data_deleted" && w.changeKind !== "type_changed" && w.changeKind !== "multiple") return "Data Dropped";
    if ((w.changeKind === "type_changed" || w.changeKind === "multiple") && !w.replacementValue) return "Type Cast";
    if (w.replacementValue) return isUniquePrefix ? "Unique Prefix + UUID" : "Static Default";
    if (w.targetNullable === true) return "Set NULL";
    return "Acknowledged";
  }
  return "Acknowledged";
}

export function defaultChangeToEntry(c: DefaultChange): TrackingEntry {
  return {
    fromVersion: c.fromVersion,
    toVersion: c.toVersion,
    entityKind: "field_default",
    entityName: c.tableName,
    subName: c.fieldName,
    changeKind: c.changeType,
    fromDisplay: formatDefault(c.fromKind, c.fromValue),
    toDisplay: formatDefault(c.toKind, c.toValue),
  };
}
