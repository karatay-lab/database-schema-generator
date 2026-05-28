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
