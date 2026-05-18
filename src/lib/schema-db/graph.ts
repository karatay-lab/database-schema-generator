import "server-only";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db/client";
import { isInternalMigrationField, normalizeDatabaseIdentifier } from "@/lib/schema-naming";

type DbProject = {
  id: string;
  name: string;
  provider: string;
  schema_options: string;
};

type DbVersion = {
  id: number;
  name: string;
  project_id: string;
};

type CanonicalConstraint =
  | { type: "PK" | "UNIQUE" | "UPDATED_AT" }
  | { type: "NATIVE"; name: string; args?: string[] };

type CanonicalField = {
  key: string;
  fieldId?: string;
  name: string;
  dbName?: string;
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

type CanonicalModel = {
  key: string;
  tableId?: string;
  name: string;
  fields: CanonicalField[];
  restrictions?: {
    key: string;
    type: "UNIQUE" | "INDEX";
    fields: string[];
    dbName?: string;
  }[];
};

type CanonicalStore = {
  schemaVersion?: number;
  projectName: string;
  projectVersion: string;
  provider: string;
  enums?: { name: string; values: string[] }[];
  models: CanonicalModel[];
};

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
  versionId: number;
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
    id: number;
    name: string;
  };
  tables: SchemaGraphTable[];
  fields: SchemaGraphField[];
  constraints: SchemaGraphConstraint[];
  relations: SchemaGraphRelation[];
  enums: SchemaGraphEnum[];
};

type TableRow = {
  id: string;
  model_key: string;
  table_id: string;
  name: string;
  db_name: string | null;
  comment: string;
  sort_order: number;
};

type FieldRow = {
  id: string;
  field_key: string;
  field_id: string;
  table_id: string;
  name: string;
  db_name: string | null;
  logical_type: string;
  native_type: string | null;
  nullable: number;
  is_array: number;
  default_kind: string;
  default_value: string;
  default_postgres: string | null;
  default_mysql: string | null;
  default_sqlite: string | null;
  comment: string;
  is_updated_at: number;
  sort_order: number;
};

type ConstraintRow = {
  id: string;
  table_id: string;
  type: "PK" | "UNIQUE" | "INDEX";
  name: string | null;
  db_name: string | null;
};

type ConstraintFieldRow = {
  constraint_id: string;
  field_id: string;
  sort_order: number;
};

type RelationRow = {
  id: string;
  version_id: number;
  name: string;
  source_table_id: string;
  target_table_id: string;
  cardinality: string;
  on_delete: string;
  on_update: string;
};

type RelationFieldRow = {
  relation_id: string;
  source_field_id: string;
  target_field_id: string;
  sort_order: number;
};

type RelationSideRow = {
  id: string;
  relation_id: string;
  table_id: string;
  field_name: string;
  is_owner: number;
  is_list: number;
  nullable: number;
};

function now() {
  return new Date().toISOString();
}

function toProvider(provider: string) {
  if (provider === "MySQL") return "mysql";
  if (provider === "SQLite") return "sqlite";
  return "postgresql";
}

function defaultKind(value: string) {
  const v = value.trim();
  if (!v) return "none";
  if (v === "autoincrement()") return "autoincrement";
  if (v === "uuid()" || v.startsWith("uuid(")) return "uuid";
  if (v === "cuid()" || v.startsWith("cuid(")) return "cuid";
  if (v === "now()") return "now";
  if (v.startsWith("dbgenerated(")) return "dbgenerated";
  return "literal";
}

function nativeConstraint(field: CanonicalField) {
  const native = field.constraints.find(
    (constraint): constraint is Extract<CanonicalConstraint, { type: "NATIVE" }> =>
      constraint.type === "NATIVE",
  );
  return native ? JSON.stringify({ name: native.name, args: native.args ?? [] }) : null;
}

function hasConstraint(field: CanonicalField, type: CanonicalConstraint["type"]) {
  return field.constraints.some((constraint) => constraint.type === type);
}

function cardinality(owner: CanonicalField, backReference?: CanonicalField) {
  if (owner.array && backReference?.array) return "many-to-many";
  if (owner.array) return "one-to-many";
  if (backReference?.array) return "many-to-one";
  return "one-to-one";
}

// Always generate from source/field/target — used for owning fields.
function ownerRelationName(source: CanonicalModel, target: CanonicalModel, field: CanonicalField) {
  return `${source.name}_${field.name}_${target.name}_rl`;
}

// For back-references: prefer the stored name (matches the owning side); fall back to generated.
function relationFallbackName(source: CanonicalModel, target: CanonicalModel, field: CanonicalField) {
  return field.relation?.name?.trim() || `${source.name}_${target.name}_${field.name}_rl`;
}

function getProjectAndVersion(projectName: string, version: string) {
  const project = db.prepare("SELECT * FROM projects WHERE name = ?").get(projectName) as
    | DbProject
    | undefined;
  if (!project) throw new Error("Project was not found.");

  const versionRow = db
    .prepare("SELECT * FROM project_versions WHERE project_id = ? AND name = ?")
    .get(project.id, version) as DbVersion | undefined;
  if (!versionRow) throw new Error("Project version was not found.");

  return { project, version: versionRow };
}

function readLegacyStore(projectId: string, version: string) {
  const row = db
    .prepare("SELECT content FROM model_stores WHERE project_id = ? AND version = ?")
    .get(projectId, version) as { content: string } | undefined;
  return row ? (JSON.parse(row.content) as CanonicalStore) : null;
}

function insertConstraint(tableId: string, type: "PK" | "UNIQUE" | "INDEX", fieldIds: string[], dbName = "", restrictionId: string = randomUUID()) {
  if (fieldIds.length === 0) return;
  const id = randomUUID();
  const stamp = now();
  db.prepare(`
    INSERT INTO schema_constraints (id, restriction_id, table_id, type, name, db_name, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, restrictionId, tableId, type, null, dbName || null, stamp, stamp);

  const insertField = db.prepare(`
    INSERT INTO schema_constraint_fields (constraint_id, field_id, sort_order)
    VALUES (?, ?, ?)
  `);
  fieldIds.forEach((fieldId, index) => insertField.run(id, fieldId, index));
}

function migrateLegacyStore(project: DbProject, version: DbVersion, store: CanonicalStore) {
  const stamp = now();
  const tableByModelKey = new Map<string, CanonicalModel>();
  const tableIdByModelName = new Map<string, string>();
  const modelByName = new Map<string, CanonicalModel>();
  const modelByKey = new Map<string, CanonicalModel>();
  const fieldIdByModelAndName = new Map<string, Map<string, string>>();
  const fieldIdByModelAndKey = new Map<string, Map<string, string>>();

  const insertTable = db.prepare(`
    INSERT INTO schema_tables
      (id, model_key, table_id, project_id, version_id, name, db_name, comment, sort_order, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertField = db.prepare(`
    INSERT INTO schema_fields
      (id, field_key, field_id, table_id, name, db_name, logical_type, native_type, nullable, is_array,
       default_kind, default_value, comment, is_updated_at, sort_order, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const [index, model] of store.models.entries()) {
    const tableId = randomUUID();
    const crossVersionId = model.tableId ?? model.key;
    insertTable.run(tableId, model.key, crossVersionId, project.id, version.id, model.name, null, "", index, stamp, stamp);
    tableByModelKey.set(model.key, model);
    tableIdByModelName.set(model.name, tableId);
    modelByName.set(model.name, model);
    modelByKey.set(model.key, model);
  }

  for (const model of store.models) {
    const tableId = tableIdByModelName.get(model.name)!;
    const fieldsByName = new Map<string, string>();
    const fieldsByKey = new Map<string, string>();
    fieldIdByModelAndName.set(model.name, fieldsByName);
    fieldIdByModelAndKey.set(model.name, fieldsByKey);

    for (const [index, field] of model.fields.filter((item) => !item.relation).entries()) {
      const fieldRowId = randomUUID();
      const stableFieldId = field.fieldId ?? field.key;
      insertField.run(
        fieldRowId,
        field.key,
        stableFieldId,
        tableId,
        field.name,
        field.dbName || normalizeDatabaseIdentifier(field.name),
        field.type,
        nativeConstraint(field),
        field.nullable ? 1 : 0,
        field.array ? 1 : 0,
        defaultKind(field.default),
        field.default,
        field.comment ?? "",
        hasConstraint(field, "UPDATED_AT") ? 1 : 0,
        index,
        stamp,
        stamp,
      );
      fieldsByName.set(field.name, fieldRowId);
      fieldsByKey.set(field.key, fieldRowId);

      if (hasConstraint(field, "PK")) insertConstraint(tableId, "PK", [fieldRowId]);
      if (hasConstraint(field, "UNIQUE")) insertConstraint(tableId, "UNIQUE", [fieldRowId]);
    }

    for (const restriction of model.restrictions ?? []) {
      const fieldIds = restriction.fields
        .map((nameOrKey) =>
          fieldIdByModelAndKey.get(model.name)?.get(nameOrKey) ??
          fieldIdByModelAndName.get(model.name)?.get(nameOrKey)
        )
        .filter((id): id is string => Boolean(id));
      insertConstraint(tableId, restriction.type, fieldIds, restriction.dbName ?? "", restriction.key);
    }
  }

  const insertRelation = db.prepare(`
    INSERT INTO schema_relations
      (id, relation_id, version_id, name, source_table_id, target_table_id, cardinality, on_delete, on_update, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertRelationField = db.prepare(`
    INSERT INTO schema_relation_fields (relation_id, source_field_id, target_field_id, sort_order)
    VALUES (?, ?, ?, ?)
  `);
  const insertRelationSide = db.prepare(`
    INSERT OR IGNORE INTO schema_relation_sides
      (id, relation_id, table_id, field_name, is_owner, is_list, nullable, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const relationIdByName = new Map<string, string>();
  // keyed by `${ownerTableId}|${otherTableId}` — used to match back-refs when names differ
  const relationIdByTablePair = new Map<string, string>();

  // Pass 1: owning fields — create relations and insert owning sides + field pairs.
  for (const sourceModel of store.models) {
    for (const field of sourceModel.fields.filter((item) => item.relation)) {
      const isOwner = (field.relation?.fields ?? []).length > 0;
      if (!isOwner) continue;

      const targetModel = modelByKey.get(field.type) ?? modelByName.get(field.type);
      if (!targetModel) continue;

      const relationName = ownerRelationName(sourceModel, targetModel, field);
      let relationId = relationIdByName.get(relationName);

      const backField = targetModel.fields.find(
        (candidate) =>
          (candidate.type === sourceModel.name || candidate.type === sourceModel.key) &&
          (candidate.relation?.fields ?? []).length === 0 &&
          candidate.key !== field.key,
      );

      if (!relationId) {
        relationId = randomUUID();
        relationIdByName.set(relationName, relationId);
        const ownerTableId = tableIdByModelName.get(sourceModel.name)!;
        const otherTableId = tableIdByModelName.get(targetModel.name)!;
        // Use the owning FK field's stable fieldId as the relation_id so the relation
        // has a stable cross-version identity that survives renames.
        const stableRelationId = field.fieldId ?? field.key;
        insertRelation.run(
          relationId,
          stableRelationId,
          version.id,
          relationName,
          ownerTableId,
          otherTableId,
          cardinality(field, backField),
          field.relation?.onDelete ?? "",
          field.relation?.onUpdate ?? "",
          stamp,
          stamp,
        );
        // Store by table pair so back-references with different names can find this relation.
        relationIdByTablePair.set(`${ownerTableId}|${otherTableId}`, relationId);
      }

      insertRelationSide.run(
        randomUUID(),
        relationId,
        tableIdByModelName.get(sourceModel.name)!,
        field.name,
        1,
        field.array ? 1 : 0,
        field.nullable ? 1 : 0,
        stamp,
        stamp,
      );

      const sourceFieldIds = (field.relation?.fields ?? [])
        .map((nameOrKey) =>
          fieldIdByModelAndKey.get(sourceModel.name)?.get(nameOrKey) ??
          fieldIdByModelAndName.get(sourceModel.name)?.get(nameOrKey)
        )
        .filter((id): id is string => Boolean(id));
      const targetFieldIds = (field.relation?.references ?? [])
        .map((nameOrKey) =>
          fieldIdByModelAndKey.get(targetModel.name)?.get(nameOrKey) ??
          fieldIdByModelAndName.get(targetModel.name)?.get(nameOrKey)
        )
        .filter((id): id is string => Boolean(id));

      for (let index = 0; index < Math.min(sourceFieldIds.length, targetFieldIds.length); index += 1) {
        insertRelationField.run(relationId, sourceFieldIds[index], targetFieldIds[index], index);
      }
    }
  }

  // Pass 2: back-reference fields — attach to existing relations.
  // Falls back to table-pair lookup when the imported schema has mismatched relation names.
  for (const sourceModel of store.models) {
    for (const field of sourceModel.fields.filter((item) => item.relation)) {
      const isOwner = (field.relation?.fields ?? []).length > 0;
      if (isOwner) continue;

      const targetModel = modelByKey.get(field.type) ?? modelByName.get(field.type);
      if (!targetModel) continue;

      const relationName = relationFallbackName(sourceModel, targetModel, field);
      let relationId = relationIdByName.get(relationName);

      // Name didn't match — try to find the relation by its owning side's table pair.
      if (!relationId) {
        const ownerTableId = tableIdByModelName.get(targetModel.name);
        const otherTableId = tableIdByModelName.get(sourceModel.name);
        if (ownerTableId && otherTableId) {
          relationId = relationIdByTablePair.get(`${ownerTableId}|${otherTableId}`);
        }
      }

      // No matching owning relation found — create a standalone relation for this back-ref.
      if (!relationId) {
        relationId = randomUUID();
        relationIdByName.set(relationName, relationId);
        const ownerTableId = tableIdByModelName.get(targetModel.name)!;
        const otherTableId = tableIdByModelName.get(sourceModel.name)!;
        insertRelation.run(
          relationId,
          field.fieldId ?? field.key,
          version.id,
          relationName,
          ownerTableId,
          otherTableId,
          field.array ? "many-to-one" : "one-to-one",
          "",
          "",
          stamp,
          stamp,
        );
      }

      insertRelationSide.run(
        randomUUID(),
        relationId,
        tableIdByModelName.get(sourceModel.name)!,
        field.name,
        0,
        field.array ? 1 : 0,
        field.nullable ? 1 : 0,
        stamp,
        stamp,
      );
    }
  }

  for (const [enumIndex, item] of (store.enums ?? []).entries()) {
    const enumId = randomUUID();
    db.prepare(`
      INSERT INTO schema_enums
        (id, version_id, name, db_name, sort_order, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(enumId, version.id, item.name, null, enumIndex, stamp, stamp);

    const insertValue = db.prepare(`
      INSERT INTO schema_enum_values
        (id, enum_id, name, db_name, sort_order, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    item.values.forEach((value, valueIndex) => {
      insertValue.run(randomUUID(), enumId, value, null, valueIndex, stamp, stamp);
    });
  }
}

export function ensureNormalizedSchema(projectName: string, versionName: string) {
  const { project, version } = getProjectAndVersion(projectName, versionName);
  const count = db
    .prepare("SELECT COUNT(*) AS count FROM schema_tables WHERE version_id = ?")
    .get(version.id) as { count: number };

  if (count.count > 0) return { project, version };

  const legacyStore = readLegacyStore(project.id, version.name);
  if (!legacyStore) return { project, version };

  db.transaction(() => {
    migrateLegacyStore(project, version, legacyStore);
  })();

  return { project, version };
}

export function replaceNormalizedSchemaFromCanonicalStore(
  projectName: string,
  versionName: string,
  store: CanonicalStore,
) {
  const { project, version } = getProjectAndVersion(projectName, versionName);

  db.transaction(() => {
    db.prepare("DELETE FROM schema_tables WHERE version_id = ?").run(version.id);
    db.prepare("DELETE FROM schema_enums WHERE version_id = ?").run(version.id);
    migrateLegacyStore(project, version, store);
  })();
}

export function readProjectVersionGraph(projectName: string, versionName: string): ProjectVersionGraph {
  const { project, version } = ensureNormalizedSchema(projectName, versionName);

  const tableRows = db
    .prepare("SELECT id, model_key, table_id, name, db_name, comment, sort_order FROM schema_tables WHERE version_id = ? ORDER BY sort_order, rowid")
    .all(version.id) as TableRow[];
  const tableIds = tableRows.map((table) => table.id);

  const fields = tableIds.length
    ? (db
        .prepare(`SELECT * FROM schema_fields WHERE table_id IN (${tableIds.map(() => "?").join(",")}) ORDER BY sort_order, rowid`)
        .all(...tableIds) as FieldRow[])
    : [];
  const constraints = tableIds.length
    ? (db
        .prepare(`SELECT * FROM schema_constraints WHERE table_id IN (${tableIds.map(() => "?").join(",")}) ORDER BY rowid`)
        .all(...tableIds) as ConstraintRow[])
    : [];
  const constraintIds = constraints.map((constraint) => constraint.id);
  const constraintFields = constraintIds.length
    ? (db
        .prepare(`SELECT * FROM schema_constraint_fields WHERE constraint_id IN (${constraintIds.map(() => "?").join(",")}) ORDER BY sort_order`)
        .all(...constraintIds) as ConstraintFieldRow[])
    : [];
  const relationRows = db
    .prepare("SELECT * FROM schema_relations WHERE version_id = ? ORDER BY rowid")
    .all(version.id) as RelationRow[];
  const relationIds = relationRows.map((relation) => relation.id);
  const relationFields = relationIds.length
    ? (db
        .prepare(`SELECT * FROM schema_relation_fields WHERE relation_id IN (${relationIds.map(() => "?").join(",")}) ORDER BY sort_order`)
        .all(...relationIds) as RelationFieldRow[])
    : [];
  const relationSides = relationIds.length
    ? (db
        .prepare(`SELECT * FROM schema_relation_sides WHERE relation_id IN (${relationIds.map(() => "?").join(",")}) ORDER BY is_owner DESC, rowid`)
        .all(...relationIds) as RelationSideRow[])
    : [];

  const enumRows = db
    .prepare("SELECT id, name, db_name, sort_order FROM schema_enums WHERE version_id = ? ORDER BY sort_order, rowid")
    .all(version.id) as { id: string; name: string; db_name: string | null; sort_order: number }[];
  const enumIds = enumRows.map((item) => item.id);
  const enumValues = enumIds.length
    ? (db
        .prepare(`SELECT id, enum_id, name, db_name, sort_order FROM schema_enum_values WHERE enum_id IN (${enumIds.map(() => "?").join(",")}) ORDER BY sort_order, rowid`)
        .all(...enumIds) as { id: string; enum_id: string; name: string; db_name: string | null; sort_order: number }[])
    : [];

  return {
    project: {
      id: project.id,
      name: project.name,
      provider: toProvider(project.provider),
      schemaOptions: JSON.parse(project.schema_options) as Record<string, unknown>,
    },
    version: {
      id: version.id,
      name: version.name,
    },
    tables: tableRows.map((table) => ({
      id: table.id,
      modelKey: table.model_key,
      tableId: table.table_id || table.model_key,
      name: table.name,
      dbName: table.db_name,
      comment: table.comment,
      sortOrder: table.sort_order,
    })),
    fields: fields.map((field) => ({
      id: field.id,
      fieldKey: field.field_key,
      fieldId: field.field_id || field.field_key,
      tableId: field.table_id,
      name: field.name,
      dbName: field.db_name,
      logicalType: field.logical_type,
      nativeType: field.native_type ? (JSON.parse(field.native_type) as { name: string; args?: string[] }) : null,
      nullable: field.nullable === 1,
      isArray: field.is_array === 1,
      defaultKind: field.default_kind,
      defaultValue: field.default_value,
      defaultPostgres: field.default_postgres,
      defaultMysql: field.default_mysql,
      defaultSqlite: field.default_sqlite,
      comment: field.comment,
      isUpdatedAt: field.is_updated_at === 1,
      sortOrder: field.sort_order,
    })),
    constraints: constraints.map((constraint) => ({
      id: constraint.id,
      tableId: constraint.table_id,
      type: constraint.type,
      name: constraint.name,
      dbName: constraint.db_name,
      fieldIds: constraintFields
        .filter((field) => field.constraint_id === constraint.id)
        .sort((left, right) => left.sort_order - right.sort_order)
        .map((field) => field.field_id),
    })),
    relations: relationRows.map((relation) => ({
      id: relation.id,
      versionId: relation.version_id,
      name: relation.name,
      sourceTableId: relation.source_table_id,
      targetTableId: relation.target_table_id,
      cardinality: relation.cardinality,
      onDelete: relation.on_delete,
      onUpdate: relation.on_update,
      fieldPairs: relationFields
        .filter((field) => field.relation_id === relation.id)
        .map((field) => ({
          sourceFieldId: field.source_field_id,
          targetFieldId: field.target_field_id,
          sortOrder: field.sort_order,
        })),
      sides: relationSides
        .filter((side) => side.relation_id === relation.id)
        .map((side) => ({
          id: side.id,
          tableId: side.table_id,
          fieldName: side.field_name,
          isOwner: side.is_owner === 1,
          isList: side.is_list === 1,
          nullable: side.nullable === 1,
        })),
    })),
    enums: enumRows.map((item) => ({
      id: item.id,
      name: item.name,
      dbName: item.db_name,
      values: enumValues
        .filter((value) => value.enum_id === item.id)
        .map((value) => ({
          id: value.id,
          name: value.name,
          dbName: value.db_name,
          sortOrder: value.sort_order,
        })),
    })),
  };
}

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

  const tableById = new Map(graph.tables.map((table) => [table.id, table]));
  const fieldById = new Map(graph.fields.map((field) => [field.id, field]));

  return {
    schemaVersion: 2,
    projectName: graph.project.name,
    projectVersion: graph.version.name,
    provider: graph.project.provider,
    enums: graph.enums.map((item) => ({
      name: item.name,
      values: item.values.map((value) => value.name),
    })),
    models: graph.tables.map((table) => {
      const tableFields = fieldsByTable.get(table.id) ?? [];
      const tableConstraints = constraintsByTable.get(table.id) ?? [];
      const relationFields: CanonicalField[] = [];

      for (const relation of graph.relations) {
        const side = relation.sides.find((item) => item.tableId === table.id);
        if (!side) continue;

        const targetTable = tableById.get(side.isOwner ? relation.targetTableId : relation.sourceTableId);
        if (!targetTable) continue;

        if (isInternalMigrationField(side.fieldName)) continue;

        relationFields.push({
          key: side.id,
          name: side.fieldName,
          type: targetTable.modelKey,
          nullable: side.nullable,
          default: "",
          comment: "",
          constraints: [],
          array: side.isList,
          relation: {
            name: relation.name,
            fields: side.isOwner
              ? relation.fieldPairs
                  .sort((left, right) => left.sortOrder - right.sortOrder)
                  .map((pair) => fieldById.get(pair.sourceFieldId)?.fieldKey)
                  .filter((key): key is string => Boolean(key))
              : [],
            references: side.isOwner
              ? relation.fieldPairs
                  .sort((left, right) => left.sortOrder - right.sortOrder)
                  .map((pair) => fieldById.get(pair.targetFieldId)?.fieldKey)
                  .filter((key): key is string => Boolean(key))
              : [],
            onDelete: side.isOwner ? relation.onDelete : "",
            onUpdate: side.isOwner ? relation.onUpdate : "",
          },
        });
      }

      return {
        key: table.modelKey,
        tableId: table.tableId,
        name: table.name,
        fields: [
          ...tableFields.map((field): CanonicalField => ({
            key: field.fieldKey,
            fieldId: field.fieldId,
            name: field.name,
            dbName: field.dbName ?? normalizeDatabaseIdentifier(field.name),
            type: field.logicalType,
            nullable: field.nullable,
            default: field.defaultValue,
            comment: field.comment,
            constraints: [
              ...tableConstraints
                .filter((constraint) => constraint.fieldIds.length === 1 && constraint.fieldIds[0] === field.id)
                .filter((constraint) => constraint.type === "PK" || constraint.type === "UNIQUE")
                .map((constraint) => ({ type: constraint.type as "PK" | "UNIQUE" })),
              ...(field.nativeType ? [{ type: "NATIVE" as const, ...field.nativeType }] : []),
              ...(field.isUpdatedAt ? [{ type: "UPDATED_AT" as const }] : []),
            ],
            array: field.isArray,
          })),
          ...relationFields,
        ],
        restrictions: tableConstraints
          .filter((constraint) => constraint.type !== "PK")
          .map((constraint) => ({
            key: constraint.id,
            type: constraint.type as "UNIQUE" | "INDEX",
            fields: constraint.fieldIds
              .map((fieldId) => fieldById.get(fieldId)?.fieldKey)
              .filter((key): key is string => Boolean(key)),
            dbName: constraint.dbName ?? "",
          })),
      };
    }),
  };
}
