import "server-only";
import type {
  ProjectVersionGraph,
  SchemaGraphConstraint,
  SchemaGraphField,
  SchemaGraphRelation,
  SchemaGraphTable,
} from "@/lib/schema-db/graph";
import { isInternalMigrationField, MIGRATION_REFERENCE_FIELD } from "@/lib/schema-naming";

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

function nativeAttribute(field: SchemaGraphField) {
  if (!field.nativeType) return "";
  const args = field.nativeType.args?.length
    ? `(${field.nativeType.args.map((arg) => (/^-?\d+(?:\.\d+)?$/.test(arg) ? arg : quote(arg))).join(", ")})`
    : "";
  return `@db.${field.nativeType.name}${args}`;
}

function defaultAttribute(field: SchemaGraphField, provider: string) {
  const providerValue =
    provider === "postgresql"
      ? field.defaultPostgres
      : provider === "mysql"
        ? field.defaultMysql
        : provider === "sqlite"
          ? field.defaultSqlite
          : null;
  const value = providerValue || field.defaultValue;

  if (!value || field.defaultKind === "none") return "";
  if (field.defaultKind === "literal") {
    // Enum types require bare unquoted values: @default(AUTHOR) not @default("AUTHOR").
    // Scalar types (String, Int, etc.) keep their surrounding quotes as-is.
    const isEnum = !(field.logicalType in logicalToPrisma);
    const cleanValue = isEnum ? value.replace(/^["']|["']$/g, "") : value;
    return `@default(${cleanValue})`;
  }
  if (field.defaultKind === "dbgenerated") return `@default(${value})`;
  if (field.defaultKind === "autoincrement") return "@default(autoincrement())";
  if (field.defaultKind === "uuid") return value.startsWith("dbgenerated(") ? `@default(${value})` : "@default(uuid())";
  if (field.defaultKind === "cuid") return "@default(cuid())";
  if (field.defaultKind === "now") return "@default(now())";
  return `@default(${value})`;
}

function fieldConstraint(
  field: SchemaGraphField,
  constraints: SchemaGraphConstraint[],
  type: "PK" | "UNIQUE",
) {
  return constraints.find(
    (constraint) =>
      constraint.type === type &&
      constraint.fieldIds.length === 1 &&
      constraint.fieldIds[0] === field.id,
  );
}

function fieldLine(
  field: SchemaGraphField,
  constraints: SchemaGraphConstraint[],
  provider: string,
) {
  const attrs: string[] = [];
  const pk = fieldConstraint(field, constraints, "PK");
  const unique = fieldConstraint(field, constraints, "UNIQUE");
  const typeSuffix = field.isArray ? "[]" : field.nullable ? "?" : "";

  if (pk) attrs.push("@id");
  if (unique && !pk) attrs.push(unique.dbName ? `@unique(map: ${quote(unique.dbName)})` : "@unique");

  const defaultValue = defaultAttribute(field, provider);
  if (defaultValue) attrs.push(defaultValue);
  if (field.isUpdatedAt) attrs.push("@updatedAt");

  const native = nativeAttribute(field);
  if (native) attrs.push(native);
  if (field.dbName && field.dbName !== field.name) attrs.push(`@map(${quote(field.dbName)})`);

  const line = `  ${field.name} ${prismaType(field.logicalType)}${typeSuffix}${attrs.length ? ` ${attrs.join(" ")}` : ""}`;
  return field.comment ? `${docComment(field.comment)}\n${line}` : line;
}

function migrationReferenceLine() {
  return `  ${MIGRATION_REFERENCE_FIELD} String? @unique @map("${MIGRATION_REFERENCE_FIELD}")`;
}

function relationLine(
  relation: SchemaGraphRelation,
  side: SchemaGraphRelation["sides"][number],
  tableById: Map<string, SchemaGraphTable>,
  fieldById: Map<string, SchemaGraphField>,
) {
  const targetTable = tableById.get(side.isOwner ? relation.targetTableId : relation.sourceTableId);
  if (!targetTable) return "";

  const typeSuffix = side.isList ? "[]" : side.nullable ? "?" : "";
  const attrs: string[] = [];

  if (side.isOwner) {
    const orderedPairs = [...relation.fieldPairs].sort((left, right) => left.sortOrder - right.sortOrder);
    const fields = orderedPairs
      .map((pair) => fieldById.get(pair.sourceFieldId)?.name)
      .filter((name): name is string => Boolean(name));
    const references = orderedPairs
      .map((pair) => fieldById.get(pair.targetFieldId)?.name)
      .filter((name): name is string => Boolean(name));
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

function blockConstraint(constraint: SchemaGraphConstraint, fieldById: Map<string, SchemaGraphField>) {
  if (constraint.fieldIds.length <= 1 && constraint.type !== "INDEX") return "";

  const fields = constraint.fieldIds
    .map((fieldId) => fieldById.get(fieldId)?.name)
    .filter((name): name is string => Boolean(name));
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
    `// Generated from app.db normalized schema graph.`,
    ``,
    `generator client {`,
    `  provider = ${quote(client)}`,
    `}`,
    ``,
    `datasource db {`,
    `  provider = ${quote(graph.project.provider)}`,
    `}`,
  ].join("\n");
}

export function renderPrismaSchemaFromGraph(
  graph: ProjectVersionGraph,
  options: { includeMigrationReference?: boolean } = {},
) {
  const tableById = new Map(graph.tables.map((table) => [table.id, table]));
  const fieldById = new Map(graph.fields.map((field) => [field.id, field]));
  const fieldsByTable = new Map<string, SchemaGraphField[]>();
  const constraintsByTable = new Map<string, SchemaGraphConstraint[]>();

  for (const field of graph.fields) {
    if (!fieldsByTable.has(field.tableId)) fieldsByTable.set(field.tableId, []);
    fieldsByTable.get(field.tableId)!.push(field);
  }

  for (const constraint of graph.constraints) {
    if (!constraintsByTable.has(constraint.tableId)) constraintsByTable.set(constraint.tableId, []);
    constraintsByTable.get(constraint.tableId)!.push(constraint);
  }

  const chunks = [renderPrelude(graph)];

  for (const item of graph.enums) {
    const values = item.values.map((value) => `  ${value.name}`).join("\n");
    chunks.push(`enum ${item.name} {\n${values}\n}`);
  }

  for (const table of graph.tables) {
    const lines: string[] = [];
    const fields = (fieldsByTable.get(table.id) ?? []).filter(
      (field) => !isInternalMigrationField(field.name),
    );
    const constraints = constraintsByTable.get(table.id) ?? [];

    if (table.comment) lines.push(docComment(table.comment));

    lines.push(
      ...fields
        .sort((left, right) => left.sortOrder - right.sortOrder)
        .map((field) => fieldLine(field, constraints, graph.project.provider)),
    );

    if (options.includeMigrationReference) {
      lines.push(migrationReferenceLine());
    }

    for (const relation of graph.relations) {
      const side = relation.sides.find((item) => item.tableId === table.id);
      if (!side) continue;
      const rendered = relationLine(relation, side, tableById, fieldById);
      if (rendered) lines.push(rendered);
    }

    lines.push(
      ...constraints
        .map((constraint) => blockConstraint(constraint, fieldById))
        .filter(Boolean),
    );

    if (table.dbName && table.dbName !== table.name) {
      lines.push(`  @@map(${quote(table.dbName)})`);
    }

    chunks.push(`model ${table.name} {\n${lines.join("\n")}\n}`);
  }

  return `${chunks.filter(Boolean).join("\n\n")}\n`;
}
