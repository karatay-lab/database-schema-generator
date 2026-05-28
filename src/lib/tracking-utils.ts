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
