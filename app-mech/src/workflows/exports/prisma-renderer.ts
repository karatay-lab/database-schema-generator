import {
  normalizeProvider,
  type ProjectVersionGraph,
  type SchemaGraphConstraint,
  type SchemaGraphField,
  type SchemaGraphRelation,
  type SchemaGraphTable,
} from "./graph";

const logicalToPrisma: Record<string, string> = {
  string: "String",
  integer: "Int",
  bigint: "BigInt",
  float: "Float",
  decimal: "Decimal",
  boolean: "Boolean",
  timestamp: "DateTime",
  json: "Json",
  bytes: "Bytes",
};

function prismaType(type: string) {
  return logicalToPrisma[type] ?? type;
}

function quote(value: string) {
  return JSON.stringify(value);
}

function docComment(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => `  /// ${line}`)
    .join("\n");
}

// Native types that take no arguments in Prisma — strip any stored args at render time
const ZERO_ARG_NATIVE_TYPES = new Set([
  "TinyInt", "SmallInt", "MediumInt", "Int", "BigInt",
  "Float", "Double", "Real", "DoublePrecision",
  "TinyText", "Text", "MediumText", "LongText",
  "TinyBlob", "Blob", "MediumBlob", "LongBlob",
  "Date", "Year", "Json", "JsonB", "Xml",
  "ByteA", "Boolean", "Uuid", "Inet", "Citext", "Oid",
]);

function nativeAttribute(field: SchemaGraphField) {
  if (!field.nativeType) return "";
  const hasArgs = field.nativeType.args?.length && !ZERO_ARG_NATIVE_TYPES.has(field.nativeType.name);
  const args = hasArgs
    ? `(${field.nativeType.args!
        .map((arg) => (/^-?\d+(?:\.\d+)?$/.test(arg) ? arg : quote(arg)))
        .join(", ")})`
    : "";
  return `@db.${field.nativeType.name}${args}`;
}

function defaultAttribute(field: SchemaGraphField, provider: string) {
  if (field.defaultKind === "none") return "";

  // These kinds don't need a stored value — emit unconditionally
  if (field.defaultKind === "autoincrement") return "@default(autoincrement())";
  if (field.defaultKind === "cuid") return "@default(cuid())";
  if (field.defaultKind === "now") return "@default(now())";

  const providerValue =
    provider === "postgresql"
      ? field.defaultPostgres
      : provider === "mysql"
        ? field.defaultMysql
        : provider === "sqlite"
          ? field.defaultSqlite
          : null;
  const value = providerValue || field.defaultValue;

  if (field.defaultKind === "uuid")
    return value?.startsWith("dbgenerated(") ? `@default(${value})` : "@default(uuid())";

  if (!value) return "";
  if (field.defaultKind === "literal") {
    const needsQuote = field.logicalType === "string" || field.logicalType === "text";
    return needsQuote ? `@default(${JSON.stringify(value)})` : `@default(${value})`;
  }
  // both "dbgenerated" and "function" kinds emit a DB-evaluated expression
  if (field.defaultKind === "dbgenerated" || field.defaultKind === "function")
    return `@default(dbgenerated(${JSON.stringify(value)}))`;
  return `@default(${value})`;
}

function fieldConstraint(
  field: SchemaGraphField,
  constraints: SchemaGraphConstraint[],
  type: "PK" | "UNIQUE",
) {
  return constraints.find(
    (c) =>
      c.type === type && c.fieldIds.length === 1 && c.fieldIds[0] === field.id,
  );
}

function fieldLine(
  field: SchemaGraphField,
  constraints: SchemaGraphConstraint[],
  provider: string,
) {
  const attrs: string[] = [];
  // PK is stored as field.isId in app-mech, not as a SchemaConstraint row
  const pk = field.isId || fieldConstraint(field, constraints, "PK") != null;
  const unique = fieldConstraint(field, constraints, "UNIQUE");
  const typeSuffix = field.isArray ? "[]" : field.nullable ? "?" : "";

  if (pk) attrs.push("@id");
  if (unique && !pk)
    attrs.push(unique.dbName ? `@unique(map: ${quote(unique.dbName)})` : "@unique");

  const defaultValue = defaultAttribute(field, provider);
  if (defaultValue) attrs.push(defaultValue);
  if (field.isUpdatedAt) attrs.push("@updatedAt");

  const native = nativeAttribute(field);
  if (native) attrs.push(native);
  if (field.dbName && field.dbName !== field.name) attrs.push(`@map(${quote(field.dbName)})`);

  const line = `  ${field.name} ${prismaType(field.logicalType)}${typeSuffix}${attrs.length ? ` ${attrs.join(" ")}` : ""}`;
  return field.comment ? `${docComment(field.comment)}\n${line}` : line;
}

function relationLine(
  relation: SchemaGraphRelation,
  side: SchemaGraphRelation["sides"][number],
  tableById: Map<string, SchemaGraphTable>,
  fieldById: Map<string, SchemaGraphField>,
) {
  const targetTable = tableById.get(
    side.isOwner ? relation.targetTableId : relation.sourceTableId,
  );
  if (!targetTable) return "";

  const typeSuffix = side.isList ? "[]" : side.nullable ? "?" : "";
  const attrs: string[] = [];

  if (side.isOwner) {
    const orderedPairs = [...relation.fieldPairs].sort(
      (a, b) => a.sortOrder - b.sortOrder,
    );
    const fields = orderedPairs
      .map((p) => fieldById.get(p.sourceFieldId)?.name)
      .filter((n): n is string => Boolean(n));
    const references = orderedPairs
      .map((p) => fieldById.get(p.targetFieldId)?.name)
      .filter((n): n is string => Boolean(n));
    const args = [
      `name: ${quote(relation.name)}`,
      fields.length ? `fields: [${fields.join(", ")}]` : "",
      references.length ? `references: [${references.join(", ")}]` : "",
      relation.onDelete ? `onDelete: ${relation.onDelete}` : "",
      relation.onUpdate ? `onUpdate: ${relation.onUpdate}` : "",
    ].filter(Boolean);
    attrs.push(`@relation(${args.join(", ")})`);
  } else {
    attrs.push(`@relation(${quote(relation.name)})`);
  }

  return `  ${side.fieldName} ${targetTable.name}${typeSuffix} ${attrs.join(" ")}`;
}

function blockConstraint(
  constraint: SchemaGraphConstraint,
  fieldById: Map<string, SchemaGraphField>,
) {
  if (constraint.fieldIds.length <= 1 && constraint.type !== "INDEX") return "";

  const fields = constraint.fieldIds
    .map((fid) => fieldById.get(fid)?.name)
    .filter((n): n is string => Boolean(n));
  if (fields.length === 0) return "";

  const args = [
    `[${fields.join(", ")}]`,
    constraint.dbName ? `map: ${quote(constraint.dbName)}` : "",
  ].filter(Boolean);

  if (constraint.type === "UNIQUE") return `  @@unique(${args.join(", ")})`;
  if (constraint.type === "INDEX") return `  @@index(${args.join(", ")})`;
  return "";
}


function renderPrelude(graph: ProjectVersionGraph) {
  const client =
    typeof graph.project.schemaOptions.client === "string"
      ? graph.project.schemaOptions.client
      : "prisma-client-js";

  return [
    `// ${graph.project.name} ${graph.version.name} Prisma schema`,
    `// Generated from app-mech database.`,
    ``,
    `generator client {`,
    `  provider = ${quote(client)}`,
    `}`,
    ``,
    `datasource db {`,
    `  provider = ${quote(normalizeProvider(graph.project.provider))}`,
    `}`,
  ].join("\n");
}

export function renderPrismaSchemaFromGraph(graph: ProjectVersionGraph): string {
  const provider = normalizeProvider(graph.project.provider);
  const tableById = new Map(graph.tables.map((t) => [t.id, t]));
  const fieldById = new Map(graph.fields.map((f) => [f.id, f]));
  const fieldsByTable = new Map<string, SchemaGraphField[]>();
  const constraintsByTable = new Map<string, SchemaGraphConstraint[]>();

  for (const field of graph.fields) {
    if (!fieldsByTable.has(field.tableId)) fieldsByTable.set(field.tableId, []);
    fieldsByTable.get(field.tableId)!.push(field);
  }

  for (const constraint of graph.constraints) {
    if (!constraintsByTable.has(constraint.tableId))
      constraintsByTable.set(constraint.tableId, []);
    constraintsByTable.get(constraint.tableId)!.push(constraint);
  }

  const chunks = [renderPrelude(graph)];

  for (const item of graph.enums) {
    const values = item.values.map((v) => `  ${v.name}`).join("\n");
    chunks.push(`enum ${item.name} {\n${values}\n}`);
  }

  for (const table of graph.tables) {
    const lines: string[] = [];
    const fields = fieldsByTable.get(table.id) ?? [];
    const constraints = constraintsByTable.get(table.id) ?? [];

    if (table.comment) lines.push(docComment(table.comment));

    lines.push(
      ...fields
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((f) => fieldLine(f, constraints, provider)),
    );

    for (const relation of graph.relations) {
      for (const side of relation.sides.filter((s) => s.tableId === table.id)) {
        const rendered = relationLine(relation, side, tableById, fieldById);
        if (rendered) lines.push(rendered);
      }
    }

    lines.push(
      ...constraints
        .map((c) => blockConstraint(c, fieldById))
        .filter(Boolean),
    );

    if (table.dbName && table.dbName !== table.name) {
      lines.push(`  @@map(${quote(table.dbName)})`);
    }

    chunks.push(`model ${table.name} {\n${lines.join("\n")}\n}`);
  }

  return `${chunks.filter(Boolean).join("\n\n")}\n`;
}
