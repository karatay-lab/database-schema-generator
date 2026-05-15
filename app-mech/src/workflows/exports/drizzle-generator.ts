import type { CanonicalStore } from "./graph";

// ─── helpers ──────────────────────────────────────────────────────────────────

function toSnakeCase(name: string): string {
  return name
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2")
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

const SCALAR_TYPES = new Set([
  "string", "integer", "bigint", "float", "decimal",
  "boolean", "timestamp", "json", "bytes",
]);

type NativeConstraint = { type: "NATIVE"; name: string; args?: string[] };

function nativeOf(
  constraints: Array<{ type: string; name?: string; args?: string[] }>,
): NativeConstraint | undefined {
  return constraints.find((c): c is NativeConstraint => c.type === "NATIVE");
}

// ─── default value mapper ──────────────────────────────────────────────────────

function drizzleDefault(defaultVal: string, provider: string, colExpr: string): string {
  if (!defaultVal || defaultVal === "autoincrement()") return "";
  if (colExpr.includes(".defaultRandom()")) return "";

  if (defaultVal === "now()") {
    return provider === "sqlite" ? ".$defaultFn(() => new Date())" : ".defaultNow()";
  }
  if (defaultVal === "uuid()" || defaultVal.includes("gen_random_uuid")) {
    return provider === "postgresql" ? "" : ".$defaultFn(() => crypto.randomUUID())";
  }
  if (defaultVal === "cuid()") return ".$defaultFn(() => /* cuid() */ '')";
  if (defaultVal === "true") return ".default(true)";
  if (defaultVal === "false") return ".default(false)";

  if (/^["'].*["']$/.test(defaultVal)) {
    try {
      return `.default(${JSON.stringify(JSON.parse(defaultVal))})`;
    } catch {
      return `.default(${defaultVal})`;
    }
  }

  if (!isNaN(Number(defaultVal))) return `.default(${defaultVal})`;

  return ` /* .default(${defaultVal}) */`;
}

// ─── per-provider column expression builders ──────────────────────────────────

type FieldShape = {
  name: string;
  type: string;
  nullable: boolean;
  default: string;
  constraints: Array<{ type: string; name?: string; args?: string[] }>;
  array?: boolean;
  relation?: { fields?: string[]; references?: string[] };
};

function pgCol(
  field: FieldShape,
  colName: string,
  isPk: boolean,
  used: Set<string>,
): string {
  const { type } = field;
  const nat = nativeOf(field.constraints);
  const isAutoUuid =
    field.default.includes("gen_random_uuid") || field.default === "uuid()";

  if (type === "string" || !SCALAR_TYPES.has(type)) {
    if (nat?.name === "Uuid") {
      used.add("uuid");
      const expr = `uuid("${colName}")${isPk ? ".primaryKey()" : ""}`;
      return isAutoUuid ? expr + ".defaultRandom()" : expr;
    }
    if (nat?.name === "VarChar") {
      const len = nat.args?.[0] ? parseInt(nat.args[0], 10) : 255;
      used.add("varchar");
      return `varchar("${colName}", { length: ${isNaN(len) ? 255 : len} })${isPk ? ".primaryKey()" : ""}`;
    }
    used.add("text");
    return `text("${colName}")${isPk ? ".primaryKey()" : ""}`;
  }
  if (type === "integer") {
    if (nat?.name === "SmallInt") { used.add("smallint"); return `smallint("${colName}")`; }
    if (isPk && field.default === "autoincrement()") { used.add("serial"); return `serial("${colName}").primaryKey()`; }
    used.add("integer");
    return `integer("${colName}")${isPk ? ".primaryKey()" : ""}`;
  }
  if (type === "bigint") { used.add("bigint"); return `bigint("${colName}", { mode: "number" })${isPk ? ".primaryKey()" : ""}`; }
  if (type === "float") { used.add("doublePrecision"); return `doublePrecision("${colName}")`; }
  if (type === "decimal") { used.add("numeric"); return `numeric("${colName}")`; }
  if (type === "boolean") { used.add("boolean"); return `boolean("${colName}")`; }
  if (type === "timestamp") {
    used.add("timestamp");
    return nat?.name === "Timestamptz"
      ? `timestamp("${colName}", { withTimezone: true })`
      : `timestamp("${colName}")`;
  }
  if (type === "json") { used.add("jsonb"); return `jsonb("${colName}")`; }
  if (type === "bytes") { used.add("text"); return `text("${colName}") /* bytes */`; }

  return `${toSnakeCase(type)}Enum("${colName}")`;
}

function sqliteCol(
  field: FieldShape,
  colName: string,
  isPk: boolean,
  used: Set<string>,
): string {
  const { type } = field;

  if (type === "string" || !SCALAR_TYPES.has(type)) {
    used.add("text");
    return `text("${colName}")${isPk ? ".primaryKey()" : ""}`;
  }
  if (type === "integer") {
    used.add("integer");
    if (isPk && field.default === "autoincrement()") return `integer("${colName}").primaryKey({ autoIncrement: true })`;
    return `integer("${colName}")${isPk ? ".primaryKey()" : ""}`;
  }
  if (type === "bigint") { used.add("blob"); return `blob("${colName}", { mode: "bigint" })${isPk ? ".primaryKey()" : ""}`; }
  if (type === "float") { used.add("real"); return `real("${colName}")`; }
  if (type === "decimal") { used.add("numeric"); return `numeric("${colName}")`; }
  if (type === "boolean") { used.add("integer"); return `integer("${colName}", { mode: "boolean" })`; }
  if (type === "timestamp") { used.add("integer"); return `integer("${colName}", { mode: "timestamp" })`; }
  if (type === "json") { used.add("text"); return `text("${colName}", { mode: "json" })`; }
  if (type === "bytes") { used.add("blob"); return `blob("${colName}")`; }

  used.add("text");
  return `text("${colName}") /* enum: ${type} */`;
}

function mysqlCol(
  field: FieldShape,
  colName: string,
  isPk: boolean,
  used: Set<string>,
): string {
  const { type } = field;
  const nat = nativeOf(field.constraints);

  if (type === "string" || !SCALAR_TYPES.has(type)) {
    if (nat?.name === "Uuid") {
      used.add("varchar");
      return `varchar("${colName}", { length: 36 })${isPk ? ".primaryKey()" : ""}`;
    }
    if (nat?.name === "VarChar") {
      const len = nat.args?.[0] ? parseInt(nat.args[0], 10) : 255;
      used.add("varchar");
      return `varchar("${colName}", { length: ${isNaN(len) ? 255 : len} })${isPk ? ".primaryKey()" : ""}`;
    }
    used.add("text");
    return `text("${colName}")${isPk ? ".primaryKey()" : ""}`;
  }
  if (type === "integer") {
    if (isPk && field.default === "autoincrement()") { used.add("serial"); return `serial("${colName}")`; }
    used.add("int");
    return `int("${colName}")${isPk ? ".primaryKey()" : ""}`;
  }
  if (type === "bigint") { used.add("bigint"); return `bigint("${colName}", { mode: "number" })${isPk ? ".primaryKey()" : ""}`; }
  if (type === "float") { used.add("float"); return `float("${colName}")`; }
  if (type === "decimal") { used.add("decimal"); return `decimal("${colName}")`; }
  if (type === "boolean") { used.add("boolean"); return `boolean("${colName}")`; }
  if (type === "timestamp") { used.add("timestamp"); return `timestamp("${colName}")`; }
  if (type === "json") { used.add("json"); return `json("${colName}")`; }
  if (type === "bytes") { used.add("binary"); return `binary("${colName}")`; }

  return `text("${colName}") /* enum: ${type} */`;
}

// ─── Drizzle schema generator ─────────────────────────────────────────────────

export function generateDrizzleSchema(store: CanonicalStore): string {
  const { provider } = store;
  const enumNames = (store.enums ?? []).map((e) => e.name);
  const usedImports = new Set<string>();
  const tableBlocks: string[] = [];

  const tableFn =
    provider === "postgresql" ? "pgTable"
    : provider === "sqlite" ? "sqliteTable"
    : "mysqlTable";
  usedImports.add(tableFn);

  const enumBlocks: string[] = [];
  if (store.enums && store.enums.length > 0) {
    if (provider === "postgresql") {
      usedImports.add("pgEnum");
      for (const e of store.enums) {
        const varName = `${toSnakeCase(e.name)}Enum`;
        const vals = e.values.map((v) => `"${v}"`).join(", ");
        enumBlocks.push(`export const ${varName} = pgEnum("${toSnakeCase(e.name)}", [${vals}]);`);
      }
    } else if (provider === "mysql") {
      usedImports.add("mysqlEnum");
      for (const e of store.enums) {
        const varName = `${toSnakeCase(e.name)}Enum`;
        const vals = e.values.map((v) => `"${v}"`).join(", ");
        enumBlocks.push(`export const ${varName} = mysqlEnum([${vals}]);`);
      }
    }
  }

  for (const model of store.models) {
    const tableVar = toSnakeCase(model.name);
    const tableSql = toSnakeCase(model.name);

    // Build FK map: local scalar field name → { targetModel, targetRef }
    const fkMap = new Map<string, { targetModel: string; targetRef: string }>();
    for (const field of model.fields) {
      const relationFields = field.relation?.fields ?? [];
      if (field.relation && relationFields.length > 0) {
        relationFields.forEach((localName, i) => {
          fkMap.set(localName, {
            targetModel: field.type,
            targetRef: field.relation?.references?.[i] ?? "id",
          });
        });
      }
    }

    const colLines: string[] = [];
    const restrictionLines: string[] = [];

    for (const field of model.fields) {
      if (field.relation !== undefined) continue;

      const colName = toSnakeCase(field.name);
      const isPk = field.constraints.some((c) => c.type === "PK");
      const isUnique = field.constraints.some((c) => c.type === "UNIQUE");
      const isUpdatedAt = field.constraints.some((c) => c.type === "UPDATED_AT");
      const isEnum = !SCALAR_TYPES.has(field.type) && enumNames.includes(field.type);

      let expr: string;

      if (isEnum && provider !== "sqlite" && provider !== "mysql") {
        expr = `${toSnakeCase(field.type)}Enum("${colName}")`;
      } else if (provider === "postgresql") {
        expr = pgCol(field, colName, isPk, usedImports);
      } else if (provider === "sqlite") {
        expr = sqliteCol(field, colName, isPk, usedImports);
      } else {
        expr = mysqlCol(field, colName, isPk, usedImports);
      }

      const isSerial = expr.includes("serial(");

      if (!field.nullable && !isPk && !isSerial) expr += ".notNull()";
      if (isUnique && !isPk) expr += ".unique()";

      const def = drizzleDefault(field.default, provider, expr);
      if (def) expr += def;

      const fk = fkMap.get(field.name);
      if (fk) {
        const targetVar = toSnakeCase(fk.targetModel);
        const targetCol = toSnakeCase(fk.targetRef);
        expr += `.references(() => ${targetVar}.${targetCol})`;
      }

      if (isUpdatedAt) expr += " /* @updatedAt */";

      if (field.comment) colLines.push(`  // ${field.comment}`);
      colLines.push(`  ${field.name}: ${expr},`);
    }

    for (const r of model.restrictions ?? []) {
      const cols = r.fields.map((f) => `table.${f}`).join(", ");
      const name = r.dbName || `${tableSql}_${r.fields.join("_")}_${r.type.toLowerCase()}`;
      if (r.type === "UNIQUE") {
        usedImports.add("uniqueIndex");
        restrictionLines.push(`  uniqueIndex("${name}").on(${cols}),`);
      } else {
        usedImports.add("index");
        restrictionLines.push(`  index("${name}").on(${cols}),`);
      }
    }

    const block = restrictionLines.length > 0
      ? `export const ${tableVar} = ${tableFn}("${tableSql}", {\n${colLines.join("\n")}\n}, (table) => [\n${restrictionLines.join("\n")}\n]);`
      : `export const ${tableVar} = ${tableFn}("${tableSql}", {\n${colLines.join("\n")}\n});`;

    tableBlocks.push(block);
  }

  const corePkg =
    provider === "postgresql" ? "drizzle-orm/pg-core"
    : provider === "sqlite" ? "drizzle-orm/sqlite-core"
    : "drizzle-orm/mysql-core";

  const importLine = `import { ${[...usedImports].sort().join(", ")} } from "${corePkg}";`;

  const parts = [
    `// Generated by Schema Studio`,
    `// Provider: ${provider}`,
    `// Project: ${store.projectName} – ${store.projectVersion}`,
    ``,
    importLine,
  ];

  if (enumBlocks.length > 0) parts.push("", ...enumBlocks);
  if (tableBlocks.length > 0) parts.push("", tableBlocks.join("\n\n"));

  return parts.join("\n") + "\n";
}
