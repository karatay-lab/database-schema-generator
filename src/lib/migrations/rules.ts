import { randomUUID } from "node:crypto";
import type { ProjectVersionGraph, SchemaGraphField } from "@/lib/schema-db/graph";
import { MIGRATION_REFERENCE_FIELD, MIGRATION_REFERENCES_FIELD } from "@/lib/schema-naming";

export type TypeConversionRule = {
  compatible: boolean;
  warning?: string;
};

const compatibleConversions: Record<string, Set<string>> = {
  integer: new Set(["decimal", "float", "string", "text", "bytes"]),
  string: new Set(["text"]),
  float: new Set(["decimal", "integer"]),
};

export function checkTypeConversion(fromType: string, toType: string): TypeConversionRule {
  const from = fromType.toLowerCase();
  const to = toType.toLowerCase();
  if (from === to) return { compatible: true };
  const compatible = compatibleConversions[from]?.has(to) ?? false;
  if (!compatible) return { compatible: false };
  if (from === "float" && to === "integer") {
    return { compatible: true, warning: "Float values will be rounded." };
  }
  return { compatible: true };
}

export function generatedUniqueValue(prefix: string) {
  return `${prefix}-${randomUUID()}`;
}

export type MigrationOrderItem = {
  tableId: string;
  modelName: string;
  dbName: string;
  parentCount: number;
};

export function computeMigrationOrder(graph: ProjectVersionGraph): MigrationOrderItem[] {
  const tableById = new Map(graph.tables.map((table) => [table.id, table]));
  const dependencies = new Map<string, Set<string>>();
  const dependents = new Map<string, Set<string>>();

  for (const table of graph.tables) {
    dependencies.set(table.id, new Set());
    dependents.set(table.id, new Set());
  }

  for (const relation of graph.relations) {
    if (!tableById.has(relation.sourceTableId) || !tableById.has(relation.targetTableId)) {
      continue;
    }

    // The migration bridge writes dependent/related rows first so parent rows can
    // reconnect using the old-reference -> new-id map.
    dependencies.get(relation.targetTableId)?.add(relation.sourceTableId);
    dependents.get(relation.sourceTableId)?.add(relation.targetTableId);
  }

  const parentCountByTable = new Map<string, number>();
  const visit = (tableId: string, seen = new Set<string>()): number => {
    const direct = dependencies.get(tableId) ?? new Set<string>();
    let count = direct.size;
    for (const dep of direct) {
      if (seen.has(dep)) continue;
      seen.add(dep);
      count += visit(dep, seen);
    }
    return count;
  };

  for (const table of graph.tables) {
    parentCountByTable.set(table.id, visit(table.id));
  }

  const inDegree = new Map<string, number>();
  for (const table of graph.tables) {
    inDegree.set(table.id, dependencies.get(table.id)?.size ?? 0);
  }

  const queue = graph.tables
    .filter((table) => (inDegree.get(table.id) ?? 0) === 0)
    .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name))
    .map((table) => table.id);
  const ordered: string[] = [];

  while (queue.length > 0) {
    const tableId = queue.shift()!;
    ordered.push(tableId);
    for (const dependent of dependents.get(tableId) ?? []) {
      const nextDegree = (inDegree.get(dependent) ?? 0) - 1;
      inDegree.set(dependent, nextDegree);
      if (nextDegree === 0) queue.push(dependent);
    }
    queue.sort((left, right) => {
      const leftTable = tableById.get(left);
      const rightTable = tableById.get(right);
      return (leftTable?.sortOrder ?? 0) - (rightTable?.sortOrder ?? 0) || left.localeCompare(right);
    });
  }

  for (const table of graph.tables) {
    if (!ordered.includes(table.id)) ordered.push(table.id);
  }

  return ordered
    .map((tableId) => {
      const table = tableById.get(tableId)!;
      return {
        tableId: table.tableId,
        modelName: table.name,
        dbName: table.dbName ?? table.name,
        parentCount: parentCountByTable.get(table.id) ?? 0,
      };
    })
    .sort((left, right) => right.parentCount - left.parentCount);
}

export function fieldReadName(field: SchemaGraphField) {
  return field.dbName || field.name;
}

export function getRecordReference(record: Record<string, unknown>, index: number) {
  const existing =
    record[MIGRATION_REFERENCE_FIELD] ??
    record.id ??
    record.uuid ??
    record._id ??
    record.ID;
  return existing === null || existing === undefined || existing === ""
    ? `row-${index}`
    : String(existing);
}

export function withMigrationReference(
  record: Record<string, unknown>,
  index: number,
  references: Record<string, unknown> = {},
) {
  return {
    ...record,
    [MIGRATION_REFERENCE_FIELD]: getRecordReference(record, index),
    [MIGRATION_REFERENCES_FIELD]: references,
  };
}
