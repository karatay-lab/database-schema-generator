import type { PrismaField } from "@/lib/schema-store";

export function formatDuration(ms: number): string {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(2)}s`;
}

export function cellDisplay(value: unknown): { text: string; muted: boolean } {
  if (value === null) return { text: "null", muted: true };
  if (value === true) return { text: "true", muted: false };
  if (value === false) return { text: "false", muted: false };
  return { text: String(value), muted: false };
}

function mockStr(len: number) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

function mockUuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function mockDate() {
  const ms = new Date(2020, 0, 1).getTime() + Math.random() * (4 * 365 * 86400 * 1000);
  return new Date(ms).toISOString().replace("T", " ").slice(0, 19);
}

function mockInt() {
  return String(Math.floor(Math.random() * 9999) + 1);
}

function mockFloat() {
  return (Math.random() * 9999).toFixed(2);
}

export function sqlMockValue(field: PrismaField): string {
  if (field.isRelation) return "NULL";
  const isUuid = field.nativeAttribute?.name === "Uuid" || field.type === "Uuid";
  switch (field.type) {
    case "String": return isUuid ? `'${mockUuid()}'` : `'${mockStr(10)}'`;
    case "Int": return mockInt();
    case "BigInt": return mockInt();
    case "Float": case "Decimal": return mockFloat();
    case "Boolean": return Math.random() > 0.5 ? "1" : "0";
    case "DateTime": return `'${mockDate()}'`;
    case "Json": return "'{}'";
    case "Bytes": return "''";
    default: return `'${mockStr(8)}'`;
  }
}

function chunked(items: string[], perLine = 6): string {
  const lines: string[] = [];
  for (let i = 0; i < items.length; i += perLine) {
    lines.push(items.slice(i, i + perLine).join(", "));
  }
  return lines.join(",\n  ");
}

function colFields(fields: PrismaField[]) {
  return fields.filter((f) => !f.isRelation || f.isId);
}

function editableFields(fields: PrismaField[]) {
  return fields.filter((f) => !f.isRelation && !f.isId && !f.isArray);
}

function pkField(fields: PrismaField[]) {
  return fields.find((f) => f.isId);
}

function q(name: string) {
  return `"${name}"`;
}

export function generateSelect(modelName: string, fields: PrismaField[]): string {
  const cols = chunked(colFields(fields).map((f) => q(f.dbName)));
  return `SELECT\n  ${cols}\nFROM ${q(modelName)}\nLIMIT 10;`;
}

export function generateInsert(modelName: string, fields: PrismaField[]): string {
  const insertable = colFields(fields).filter(
    (f) => !f.isId || (f.isId && f.defaultValue !== "autoincrement()"),
  );
  const cols = chunked(insertable.map((f) => q(f.dbName)));
  const vals = chunked(insertable.map((f) => sqlMockValue(f)));
  return `INSERT INTO ${q(modelName)} (\n  ${cols}\n) VALUES (\n  ${vals}\n);`;
}

export function generateUpdate(modelName: string, fields: PrismaField[]): string {
  const pk = pkField(fields);
  const updatable = editableFields(fields);
  if (!pk || updatable.length === 0) return `-- No editable fields on ${modelName}`;
  const pairs = updatable.map((f) => `${q(f.dbName)} = ${sqlMockValue(f)}`);
  const setClause = chunked(pairs);
  const pkVal = sqlMockValue(pk);
  return `UPDATE ${q(modelName)}\nSET\n  ${setClause}\nWHERE ${q(pk.dbName)} = ${pkVal};`;
}

export function generateDelete(modelName: string, fields: PrismaField[]): string {
  const pk = pkField(fields);
  if (!pk) return `-- No primary key on ${modelName}`;
  return `DELETE FROM ${q(modelName)}\nWHERE ${q(pk.dbName)} = ${sqlMockValue(pk)};`;
}
