import type { MockFieldDef } from "./types";

function s(name: string): string | undefined {
  const snake = name.replace(/([A-Z])/g, (m) => `_${m.toLowerCase()}`);
  return snake === name ? undefined : snake;
}

// ─── Postgres field builders ──────────────────────────────────────────────────

export const pg = {
  pk: (sortOrder = 0): MockFieldDef => ({
    name: "id", dbName: undefined, logicalType: "string",
    nativeType: "@db.Uuid", nullable: false, isArray: false, isId: true,
    defaultKind: "function", defaultValue: "", defaultPostgres: "gen_random_uuid()",
    comment: "Primary key — database-generated UUID", isUpdatedAt: false, sortOrder,
  }),

  varchar: (name: string, len: number, comment: string, sortOrder: number, opts?: { nullable?: boolean }): MockFieldDef => ({
    name, dbName: s(name), logicalType: "string",
    nativeType: `@db.VarChar(${len})`, nullable: opts?.nullable ?? false,
    isArray: false, isId: false, defaultKind: "none", defaultValue: "",
    comment, isUpdatedAt: false, sortOrder,
  }),

  text: (name: string, comment: string, sortOrder: number, opts?: { nullable?: boolean }): MockFieldDef => ({
    name, dbName: s(name), logicalType: "string",
    nativeType: "@db.Text", nullable: opts?.nullable ?? true,
    isArray: false, isId: false, defaultKind: "none", defaultValue: "",
    comment, isUpdatedAt: false, sortOrder,
  }),

  int: (name: string, comment: string, sortOrder: number, defaultVal?: number): MockFieldDef => ({
    name, dbName: s(name), logicalType: "integer",
    nullable: false, isArray: false, isId: false,
    defaultKind: defaultVal !== undefined ? "literal" : "none",
    defaultValue: defaultVal !== undefined ? String(defaultVal) : "",
    comment, isUpdatedAt: false, sortOrder,
  }),

  decimal: (name: string, p: number, scale: number, comment: string, sortOrder: number, opts?: { nullable?: boolean }): MockFieldDef => ({
    name, dbName: s(name), logicalType: "decimal",
    nativeType: `@db.Decimal(${p}, ${scale})`, nullable: opts?.nullable ?? false,
    isArray: false, isId: false, defaultKind: "none", defaultValue: "",
    comment, isUpdatedAt: false, sortOrder,
  }),

  float: (name: string, comment: string, sortOrder: number, opts?: { nullable?: boolean }): MockFieldDef => ({
    name, dbName: s(name), logicalType: "float",
    nativeType: "@db.DoublePrecision", nullable: opts?.nullable ?? false,
    isArray: false, isId: false, defaultKind: "none", defaultValue: "",
    comment, isUpdatedAt: false, sortOrder,
  }),

  bool: (name: string, comment: string, sortOrder: number, defaultVal: boolean): MockFieldDef => ({
    name, dbName: s(name), logicalType: "boolean",
    nullable: false, isArray: false, isId: false,
    defaultKind: "literal", defaultValue: String(defaultVal),
    comment, isUpdatedAt: false, sortOrder,
  }),

  jsonb: (name: string, comment: string, sortOrder: number, opts?: { nullable?: boolean }): MockFieldDef => ({
    name, dbName: s(name), logicalType: "json",
    nativeType: "@db.JsonB", nullable: opts?.nullable ?? true,
    isArray: false, isId: false, defaultKind: "none", defaultValue: "",
    comment, isUpdatedAt: false, sortOrder,
  }),

  fk: (name: string, comment: string, sortOrder: number, opts?: { nullable?: boolean }): MockFieldDef => ({
    name, dbName: s(name), logicalType: "string",
    nativeType: "@db.Uuid", nullable: opts?.nullable ?? false,
    isArray: false, isId: false, defaultKind: "none", defaultValue: "",
    comment, isUpdatedAt: false, sortOrder,
  }),

  createdAt: (sortOrder: number): MockFieldDef => ({
    name: "createdAt", dbName: "created_at", logicalType: "timestamp",
    nativeType: "@db.Timestamptz(6)", nullable: false,
    isArray: false, isId: false, defaultKind: "now", defaultValue: "",
    comment: "Record creation timestamp", isUpdatedAt: false, sortOrder,
  }),

  updatedAt: (sortOrder: number): MockFieldDef => ({
    name: "updatedAt", dbName: "updated_at", logicalType: "timestamp",
    nativeType: "@db.Timestamptz(6)", nullable: false,
    isArray: false, isId: false, defaultKind: "none", defaultValue: "",
    comment: "Record last-modified timestamp", isUpdatedAt: true, sortOrder,
  }),

  timestamp: (name: string, comment: string, sortOrder: number, opts?: { nullable?: boolean }): MockFieldDef => ({
    name, dbName: s(name), logicalType: "timestamp",
    nativeType: "@db.Timestamptz(6)", nullable: opts?.nullable ?? false,
    isArray: false, isId: false, defaultKind: "none", defaultValue: "",
    comment, isUpdatedAt: false, sortOrder,
  }),
};

// ─── MySQL field builders ─────────────────────────────────────────────────────

export const my = {
  pk: (sortOrder = 0): MockFieldDef => ({
    name: "id", dbName: undefined, logicalType: "string",
    nativeType: "@db.Char(36)", nullable: false, isArray: false, isId: true,
    defaultKind: "uuid", defaultValue: "",
    comment: "Primary key — Prisma client-generated UUID", isUpdatedAt: false, sortOrder,
  }),

  varchar: (name: string, len: number, comment: string, sortOrder: number, opts?: { nullable?: boolean }): MockFieldDef => ({
    name, dbName: s(name), logicalType: "string",
    nativeType: `@db.VarChar(${len})`, nullable: opts?.nullable ?? false,
    isArray: false, isId: false, defaultKind: "none", defaultValue: "",
    comment, isUpdatedAt: false, sortOrder,
  }),

  text: (name: string, comment: string, sortOrder: number, opts?: { nullable?: boolean }): MockFieldDef => ({
    name, dbName: s(name), logicalType: "string",
    nativeType: "@db.Text", nullable: opts?.nullable ?? true,
    isArray: false, isId: false, defaultKind: "none", defaultValue: "",
    comment, isUpdatedAt: false, sortOrder,
  }),

  int: (name: string, comment: string, sortOrder: number, defaultVal?: number): MockFieldDef => ({
    name, dbName: s(name), logicalType: "integer",
    nullable: false, isArray: false, isId: false,
    defaultKind: defaultVal !== undefined ? "literal" : "none",
    defaultValue: defaultVal !== undefined ? String(defaultVal) : "",
    comment, isUpdatedAt: false, sortOrder,
  }),

  decimal: (name: string, p: number, scale: number, comment: string, sortOrder: number, opts?: { nullable?: boolean }): MockFieldDef => ({
    name, dbName: s(name), logicalType: "decimal",
    nativeType: `@db.Decimal(${p}, ${scale})`, nullable: opts?.nullable ?? false,
    isArray: false, isId: false, defaultKind: "none", defaultValue: "",
    comment, isUpdatedAt: false, sortOrder,
  }),

  float: (name: string, comment: string, sortOrder: number, opts?: { nullable?: boolean }): MockFieldDef => ({
    name, dbName: s(name), logicalType: "float",
    nativeType: "@db.Float", nullable: opts?.nullable ?? false,
    isArray: false, isId: false, defaultKind: "none", defaultValue: "",
    comment, isUpdatedAt: false, sortOrder,
  }),

  bool: (name: string, comment: string, sortOrder: number, defaultVal: boolean): MockFieldDef => ({
    name, dbName: s(name), logicalType: "boolean",
    nativeType: "@db.TinyInt(1)", nullable: false, isArray: false, isId: false,
    defaultKind: "literal", defaultValue: String(defaultVal),
    comment, isUpdatedAt: false, sortOrder,
  }),

  json: (name: string, comment: string, sortOrder: number, opts?: { nullable?: boolean }): MockFieldDef => ({
    name, dbName: s(name), logicalType: "json",
    nativeType: "@db.Json", nullable: opts?.nullable ?? true,
    isArray: false, isId: false, defaultKind: "none", defaultValue: "",
    comment, isUpdatedAt: false, sortOrder,
  }),

  fk: (name: string, comment: string, sortOrder: number, opts?: { nullable?: boolean }): MockFieldDef => ({
    name, dbName: s(name), logicalType: "string",
    nativeType: "@db.Char(36)", nullable: opts?.nullable ?? false,
    isArray: false, isId: false, defaultKind: "none", defaultValue: "",
    comment, isUpdatedAt: false, sortOrder,
  }),

  createdAt: (sortOrder: number): MockFieldDef => ({
    name: "createdAt", dbName: "created_at", logicalType: "timestamp",
    nativeType: "@db.DateTime(0)", nullable: false,
    isArray: false, isId: false, defaultKind: "now", defaultValue: "",
    comment: "Record creation timestamp", isUpdatedAt: false, sortOrder,
  }),

  updatedAt: (sortOrder: number): MockFieldDef => ({
    name: "updatedAt", dbName: "updated_at", logicalType: "timestamp",
    nativeType: "@db.DateTime(0)", nullable: false,
    isArray: false, isId: false, defaultKind: "none", defaultValue: "",
    comment: "Record last-modified timestamp", isUpdatedAt: true, sortOrder,
  }),

  timestamp: (name: string, comment: string, sortOrder: number, opts?: { nullable?: boolean }): MockFieldDef => ({
    name, dbName: s(name), logicalType: "timestamp",
    nativeType: "@db.DateTime(0)", nullable: opts?.nullable ?? false,
    isArray: false, isId: false, defaultKind: "none", defaultValue: "",
    comment, isUpdatedAt: false, sortOrder,
  }),
};
