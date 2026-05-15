import { prisma } from "../../lib/prisma";

// ─── graph types ──────────────────────────────────────────────────────────────

export type SchemaGraphTable = {
  id: string;
  modelKey: string;
  tableId: string;
  name: string;
  dbName: string | null;
  comment: string;
  sortOrder: number;
};

export type SchemaGraphField = {
  id: string;
  fieldKey: string;
  fieldId: string;
  tableId: string;
  name: string;
  dbName: string | null;
  logicalType: string;
  nativeType: { name: string; args?: string[] } | null;
  nullable: boolean;
  isArray: boolean;
  isId: boolean;
  defaultKind: string;
  defaultValue: string;
  defaultPostgres: string | null;
  defaultMysql: string | null;
  defaultSqlite: string | null;
  comment: string;
  isUpdatedAt: boolean;
  sortOrder: number;
};

export type SchemaGraphConstraint = {
  id: string;
  tableId: string;
  type: "PK" | "UNIQUE" | "INDEX";
  name: string | null;
  dbName: string | null;
  fieldIds: string[];
};

export type SchemaGraphRelation = {
  id: string;
  versionId: string;
  name: string;
  sourceTableId: string;
  targetTableId: string;
  cardinality: string;
  onDelete: string;
  onUpdate: string;
  fieldPairs: { sourceFieldId: string; targetFieldId: string; sortOrder: number }[];
  sides: {
    id: string;
    tableId: string;
    fieldName: string;
    isOwner: boolean;
    isList: boolean;
    nullable: boolean;
  }[];
};

export type SchemaGraphEnum = {
  id: string;
  name: string;
  dbName: string | null;
  values: { id: string; name: string; dbName: string | null; sortOrder: number }[];
};

export type ProjectVersionGraph = {
  project: {
    id: string;
    name: string;
    provider: string;
    schemaOptions: Record<string, unknown>;
  };
  version: {
    id: string;
    name: string;
  };
  tables: SchemaGraphTable[];
  fields: SchemaGraphField[];
  constraints: SchemaGraphConstraint[];
  relations: SchemaGraphRelation[];
  enums: SchemaGraphEnum[];
};

// ─── canonical store types (used by renderers) ─────────────────────────────────

type CanonicalConstraint =
  | { type: "PK" | "UNIQUE" | "UPDATED_AT" }
  | { type: "NATIVE"; name: string; args?: string[] };

export type CanonicalField = {
  key: string;
  name: string;
  type: string;
  nullable: boolean;
  default: string;
  comment: string;
  constraints: CanonicalConstraint[];
  array?: boolean;
  relation?: {
    name?: string;
    fields?: string[];
    references?: string[];
    onDelete?: string;
    onUpdate?: string;
  };
};

export type CanonicalModel = {
  key: string;
  name: string;
  fields: CanonicalField[];
  restrictions?: {
    key: string;
    type: "UNIQUE" | "INDEX";
    fields: string[];
    dbName?: string;
  }[];
};

export type CanonicalStore = {
  projectName: string;
  projectVersion: string;
  provider: string;
  enums?: { name: string; values: string[] }[];
  models: CanonicalModel[];
};

// ─── nativeType parser ────────────────────────────────────────────────────────

export function parseNativeType(raw: string | null): { name: string; args?: string[] } | null {
  if (!raw) return null;
  // Handles both "@db.TypeName" and "@db.TypeName(arg1, arg2)" formats
  const match = raw.match(/^@db\.([A-Za-z]+)(?:\(([^)]*)\))?$/);
  if (!match) return null;
  const name = match[1];
  const args = match[2]
    ? match[2].split(",").map((s) => s.trim()).filter(Boolean)
    : undefined;
  return args?.length ? { name, args } : { name };
}

export function normalizeProvider(provider: string): string {
  const p = provider.toLowerCase();
  if (p === "postgres" || p === "postgresql") return "postgresql";
  if (p === "mysql") return "mysql";
  if (p === "sqlite") return "sqlite";
  if (p === "sqlserver") return "sqlserver";
  if (p === "mongodb") return "mongodb";
  if (p === "cockroachdb") return "cockroachdb";
  return p;
}

// ─── graph reader ─────────────────────────────────────────────────────────────

export async function readProjectVersionGraph(
  projectName: string,
  versionName: string,
): Promise<ProjectVersionGraph> {
  const project = await prisma.project.findUniqueOrThrow({ where: { name: projectName } });
  const version = await prisma.projectVersion.findFirstOrThrow({
    where: { projectId: project.id, name: versionName },
  });

  const tableRows = await prisma.schemaTable.findMany({
    where: { versionId: version.id },
    orderBy: [{ sortOrder: "asc" }],
    include: {
      schemaFields: { orderBy: [{ sortOrder: "asc" }] },
      constraints: {
        include: { constraintFields: { orderBy: [{ sortOrder: "asc" }] } },
      },
    },
  });

  const tables: SchemaGraphTable[] = tableRows.map((t) => ({
    id: t.id,
    modelKey: t.modelKey || t.id,
    tableId: t.tableId || t.id,
    name: t.name,
    dbName: t.dbName ?? null,
    comment: t.comment,
    sortOrder: t.sortOrder,
  }));

  const fields: SchemaGraphField[] = tableRows.flatMap((t) =>
    t.schemaFields.map((f) => ({
      id: f.id,
      fieldKey: f.fieldKey || f.id,
      fieldId: f.fieldId || f.id,
      tableId: f.tableId,
      name: f.name,
      dbName: f.dbName ?? null,
      logicalType: f.logicalType,
      nativeType: parseNativeType(f.nativeType ?? null),
      nullable: f.nullable,
      isArray: f.isArray,
      isId: f.isId,
      defaultKind: f.defaultKind,
      defaultValue: f.defaultValue,
      defaultPostgres: f.defaultPostgres ?? null,
      defaultMysql: f.defaultMysql ?? null,
      defaultSqlite: f.defaultSqlite ?? null,
      comment: f.comment,
      isUpdatedAt: f.isUpdatedAt,
      sortOrder: f.sortOrder,
    })),
  );

  const constraints: SchemaGraphConstraint[] = tableRows.flatMap((t) =>
    t.constraints.map((c) => ({
      id: c.id,
      tableId: c.tableId,
      type: c.type as "PK" | "UNIQUE" | "INDEX",
      name: c.name ?? null,
      dbName: c.dbName ?? null,
      fieldIds: c.constraintFields
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((cf) => cf.fieldId),
    })),
  );

  const relationRows = await prisma.schemaRelation.findMany({
    where: { versionId: version.id },
    include: {
      relationFields: { orderBy: [{ sortOrder: "asc" }] },
      relationSides: { orderBy: [{ isOwner: "desc" }] },
    },
  });

  const relations: SchemaGraphRelation[] = relationRows.map((r) => ({
    id: r.id,
    versionId: r.versionId,
    name: r.name,
    sourceTableId: r.sourceTableId,
    targetTableId: r.targetTableId,
    cardinality: r.cardinality,
    onDelete: r.onDelete,
    onUpdate: r.onUpdate,
    fieldPairs: r.relationFields.map((rf) => ({
      sourceFieldId: rf.sourceFieldId,
      targetFieldId: rf.targetFieldId,
      sortOrder: rf.sortOrder,
    })),
    sides: r.relationSides.map((s) => ({
      id: s.id,
      tableId: s.tableId,
      fieldName: s.fieldName,
      isOwner: s.isOwner,
      isList: s.isList,
      nullable: s.nullable,
    })),
  }));

  const enumRows = await prisma.schemaEnum.findMany({
    where: { versionId: version.id },
    orderBy: [{ sortOrder: "asc" }],
    include: { enumValues: { orderBy: [{ sortOrder: "asc" }] } },
  });

  const enums: SchemaGraphEnum[] = enumRows.map((e) => ({
    id: e.id,
    name: e.name,
    dbName: e.dbName ?? null,
    values: e.enumValues.map((v) => ({
      id: v.id,
      name: v.name,
      dbName: v.dbName ?? null,
      sortOrder: v.sortOrder,
    })),
  }));

  return {
    project: {
      id: project.id,
      name: project.name,
      provider: project.provider,
      schemaOptions: JSON.parse(project.schemaOptions) as Record<string, unknown>,
    },
    version: { id: version.id, name: version.name },
    tables,
    fields,
    constraints,
    relations,
    enums,
  };
}

// ─── graph → canonical store ──────────────────────────────────────────────────

export function graphToCanonicalStore(graph: ProjectVersionGraph): CanonicalStore {
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

  const tableById = new Map(graph.tables.map((t) => [t.id, t]));
  const fieldById = new Map(graph.fields.map((f) => [f.id, f]));

  return {
    projectName: graph.project.name,
    projectVersion: graph.version.name,
    provider: normalizeProvider(graph.project.provider),
    enums: graph.enums.map((e) => ({
      name: e.name,
      values: e.values.map((v) => v.name),
    })),
    models: graph.tables.map((table) => {
      const tableFields = fieldsByTable.get(table.id) ?? [];
      const tableConstraints = constraintsByTable.get(table.id) ?? [];
      const relationFields: CanonicalField[] = [];

      for (const relation of graph.relations) {
        const side = relation.sides.find((s) => s.tableId === table.id);
        if (!side) continue;

        const targetTable = tableById.get(
          side.isOwner ? relation.targetTableId : relation.sourceTableId,
        );
        if (!targetTable) continue;

        const orderedPairs = [...relation.fieldPairs].sort(
          (a, b) => a.sortOrder - b.sortOrder,
        );

        relationFields.push({
          key: side.id,
          name: side.fieldName,
          type: targetTable.name,
          nullable: side.nullable,
          default: "",
          comment: "",
          constraints: [],
          array: side.isList,
          relation: {
            name: relation.name,
            // Use field names so the Drizzle FK map lookup works
            fields: side.isOwner
              ? orderedPairs
                  .map((p) => fieldById.get(p.sourceFieldId)?.name)
                  .filter((n): n is string => Boolean(n))
              : [],
            references: side.isOwner
              ? orderedPairs
                  .map((p) => fieldById.get(p.targetFieldId)?.name)
                  .filter((n): n is string => Boolean(n))
              : [],
            onDelete: side.isOwner ? relation.onDelete : "",
            onUpdate: side.isOwner ? relation.onUpdate : "",
          },
        });
      }

      return {
        key: table.modelKey,
        name: table.name,
        fields: [
          ...tableFields.map(
            (field): CanonicalField => ({
              key: field.fieldKey,
              name: field.name,
              type: field.logicalType,
              nullable: field.nullable,
              default: field.defaultValue,
              comment: field.comment,
              constraints: [
                // PK is stored on the field itself (isId), not in SchemaConstraint
                ...(field.isId ? [{ type: "PK" as const }] : []),
                ...tableConstraints
                  .filter(
                    (c) =>
                      c.fieldIds.length === 1 &&
                      c.fieldIds[0] === field.id &&
                      c.type === "UNIQUE",
                  )
                  .map((c) => ({ type: c.type as "UNIQUE" })),
                ...(field.nativeType
                  ? [{ type: "NATIVE" as const, ...field.nativeType }]
                  : []),
                ...(field.isUpdatedAt ? [{ type: "UPDATED_AT" as const }] : []),
              ],
              array: field.isArray,
            }),
          ),
          ...relationFields,
        ],
        restrictions: tableConstraints
          .filter((c) => c.type !== "PK")
          .map((c) => ({
            key: c.id,
            type: c.type as "UNIQUE" | "INDEX",
            // Use field names for Drizzle block-level index generation
            fields: c.fieldIds
              .map((fid) => fieldById.get(fid)?.name)
              .filter((n): n is string => Boolean(n)),
            dbName: c.dbName ?? "",
          })),
      };
    }),
  };
}
