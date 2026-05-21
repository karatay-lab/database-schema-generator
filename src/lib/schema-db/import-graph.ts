import "server-only";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db/client";
import type {
  SchemaGraphTable,
  SchemaGraphField,
  SchemaGraphConstraint,
  SchemaGraphRelation,
  SchemaGraphEnum,
} from "./graph";

export type PickleVersionData = {
  name: string;
  tables: SchemaGraphTable[];
  fields: SchemaGraphField[];
  constraints: SchemaGraphConstraint[];
  relations: SchemaGraphRelation[];
  enums: SchemaGraphEnum[];
};

export function clearVersionGraph(versionId: number): void {
  // Deleting tables cascades fields, constraints, constraint_fields,
  // and relations (via source/target table FKs), relation_fields, relation_sides.
  db.prepare("DELETE FROM schema_tables WHERE version_id = ?").run(versionId);
  // Enum values cascade from enums.
  db.prepare("DELETE FROM schema_enums WHERE version_id = ?").run(versionId);
}

export function writeVersionGraph(
  projectId: string,
  versionId: number,
  data: PickleVersionData,
): void {
  const stamp = new Date().toISOString();
  const tableIdMap = new Map<string, string>();
  const fieldIdMap = new Map<string, string>();

  const insertTable = db.prepare(`
    INSERT INTO schema_tables
      (id, model_key, table_id, project_id, version_id, name, db_name, comment, sort_order, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const table of data.tables) {
    const newId = randomUUID();
    tableIdMap.set(table.id, newId);
    insertTable.run(
      newId, table.modelKey, table.tableId, projectId, versionId,
      table.name, table.dbName ?? null, table.comment ?? "",
      table.sortOrder, stamp, stamp,
    );
  }

  const insertField = db.prepare(`
    INSERT INTO schema_fields
      (id, field_key, field_id, table_id, name, db_name, logical_type, native_type,
       nullable, is_array, default_kind, default_value, default_postgres, default_mysql,
       default_sqlite, comment, is_updated_at, sort_order, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const field of data.fields) {
    const newId = randomUUID();
    const newTableId = tableIdMap.get(field.tableId);
    if (!newTableId) continue;
    fieldIdMap.set(field.id, newId);
    insertField.run(
      newId, field.fieldKey, field.fieldId, newTableId,
      field.name, field.dbName ?? null, field.logicalType,
      field.nativeType ? JSON.stringify(field.nativeType) : null,
      field.nullable ? 1 : 0, field.isArray ? 1 : 0,
      field.defaultKind, field.defaultValue,
      field.defaultPostgres ?? null, field.defaultMysql ?? null, field.defaultSqlite ?? null,
      field.comment ?? "", field.isUpdatedAt ? 1 : 0, field.sortOrder,
      stamp, stamp,
    );
  }

  const insertConstraint = db.prepare(`
    INSERT INTO schema_constraints
      (id, restriction_id, table_id, type, name, db_name, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertConstraintField = db.prepare(`
    INSERT INTO schema_constraint_fields (constraint_id, field_id, sort_order)
    VALUES (?, ?, ?)
  `);
  for (const constraint of data.constraints) {
    const newId = randomUUID();
    const newTableId = tableIdMap.get(constraint.tableId);
    if (!newTableId) continue;
    insertConstraint.run(
      newId, randomUUID(), newTableId, constraint.type,
      constraint.name ?? null, constraint.dbName ?? null, stamp, stamp,
    );
    for (const [i, oldFieldId] of constraint.fieldIds.entries()) {
      const newFieldId = fieldIdMap.get(oldFieldId);
      if (newFieldId) insertConstraintField.run(newId, newFieldId, i);
    }
  }

  const insertRelation = db.prepare(`
    INSERT INTO schema_relations
      (id, relation_id, version_id, name, source_table_id, target_table_id,
       cardinality, on_delete, on_update, created_at, updated_at)
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
  for (const relation of data.relations) {
    const newRelId = randomUUID();
    const newSourceTableId = tableIdMap.get(relation.sourceTableId);
    const newTargetTableId = tableIdMap.get(relation.targetTableId);
    if (!newSourceTableId || !newTargetTableId) continue;
    insertRelation.run(
      newRelId, randomUUID(), versionId, relation.name,
      newSourceTableId, newTargetTableId,
      relation.cardinality, relation.onDelete, relation.onUpdate,
      stamp, stamp,
    );
    for (const pair of relation.fieldPairs) {
      const newSrcFieldId = fieldIdMap.get(pair.sourceFieldId);
      const newTgtFieldId = fieldIdMap.get(pair.targetFieldId);
      if (newSrcFieldId && newTgtFieldId) {
        insertRelationField.run(newRelId, newSrcFieldId, newTgtFieldId, pair.sortOrder);
      }
    }
    for (const side of relation.sides) {
      const newSideTableId = tableIdMap.get(side.tableId);
      if (!newSideTableId) continue;
      insertRelationSide.run(
        randomUUID(), newRelId, newSideTableId,
        side.fieldName, side.isOwner ? 1 : 0, side.isList ? 1 : 0, side.nullable ? 1 : 0,
        stamp, stamp,
      );
    }
  }

  const insertEnum = db.prepare(`
    INSERT INTO schema_enums
      (id, enum_key, version_id, name, db_name, sort_order, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertEnumValue = db.prepare(`
    INSERT INTO schema_enum_values
      (id, value_key, enum_id, name, db_name, sort_order, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const [enumIndex, item] of data.enums.entries()) {
    const newEnumId = randomUUID();
    insertEnum.run(newEnumId, item.enumKey, versionId, item.name, item.dbName ?? null, enumIndex, stamp, stamp);
    for (const value of item.values) {
      insertEnumValue.run(
        randomUUID(), value.valueKey, newEnumId,
        value.name, value.dbName ?? null, value.sortOrder,
        stamp, stamp,
      );
    }
  }
}
