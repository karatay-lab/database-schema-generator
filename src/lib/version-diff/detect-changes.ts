import "server-only";
import { db } from "@/lib/db/client";
import { readProjectVersionGraph } from "@/lib/schema-db/graph";
import type { ProjectVersionGraph, SchemaGraphField, SchemaGraphTable } from "@/lib/schema-db/graph";

export type ChangeSeverity = "breaking" | "warning" | "info";

export type CascadeHint = {
  tableId: string;
  tableName: string;
  fieldId: string;
  fieldName: string;
};

export type FieldDiff = {
  fieldId: string;
  fieldKey: string;
  fieldName: string;
  changeKind:
    | "added"
    | "removed"
    | "renamed"
    | "type_changed"
    | "pk_type_changed"
    | "nullability_changed"
    | "default_changed"
    | "multiple";
  severity: ChangeSeverity;
  from: string;
  to: string;
  message: string;
  cascade: CascadeHint[];
  isPk: boolean;
};

export type TableDiff = {
  tableId: string;
  tableKey: string;
  tableName: string;
  fromName: string;
  changeKind: "added" | "removed" | "renamed" | "changed";
  severity: ChangeSeverity;
  message: string;
  fieldDiffs: FieldDiff[];
};

export type EnumDiff = {
  enumId: string;
  enumName: string;
  changeKind: "added" | "removed" | "values_changed";
  severity: ChangeSeverity;
  message: string;
  addedValues: string[];
  removedValues: string[];
};

export type RelationDiff = {
  relationId: string;
  changeKind: "added" | "removed";
  severity: ChangeSeverity;
  message: string;
  // For removed: the table and field names as they were in the previous version
  sourceTableName: string;
  targetTableName: string;
  fieldName: string;
};

export type RestrictionDiff = {
  constraintKey: string;           // stable semantic key: "TableName:UNIQUE:field1,field2"
  changeKind: "unique_added" | "unique_removed" | "index_added" | "index_removed";
  severity: ChangeSeverity;
  tableName: string;
  fields: string[];                // field names covered by the constraint
  dbName: string | null;           // constraint db name if set
  message: string;
};

export type VersionDiff = {
  fromVersion: string;
  toVersion: string;
  tableDiffs: TableDiff[];
  enumDiffs: EnumDiff[];
  relationDiffs: RelationDiff[];
  restrictionDiffs: RestrictionDiff[];
  hasBreaking: boolean;
  hasWarnings: boolean;
};

export function getPreviousVersion(projectName: string, version: string): string | null {
  const projectRow = db
    .prepare("SELECT id FROM projects WHERE name = ?")
    .get(projectName) as { id: string } | undefined;
  if (!projectRow) return null;
  const rows = db
    .prepare("SELECT name FROM project_versions WHERE project_id = ? ORDER BY sort_order")
    .all(projectRow.id) as { name: string }[];
  const idx = rows.findIndex((r) => r.name === version);
  if (idx <= 0) return null;
  return rows[idx - 1]!.name;
}

// Normalize field type to a display string — treats string+Uuid native type as "Uuid".
function effectiveType(field: SchemaGraphField): string {
  if (field.logicalType === "string" && field.nativeType?.name === "Uuid") return "uuid";
  return field.logicalType;
}

function toDisplayType(logical: string): string {
  const map: Record<string, string> = {
    bigint: "BigInt",
    boolean: "Boolean",
    bytes: "Bytes",
    decimal: "Decimal",
    float: "Float",
    integer: "Int",
    json: "Json",
    string: "String",
    timestamp: "DateTime",
    uuid: "Uuid",
  };
  return map[logical] ?? logical;
}

function getPkFieldId(graph: ProjectVersionGraph, tableRowId: string): string | null {
  const constraint = graph.constraints.find(
    (c) => c.tableId === tableRowId && c.type === "PK" && c.fieldIds.length > 0,
  );
  return constraint?.fieldIds[0] ?? null;
}

function compareFields(
  fromGraph: ProjectVersionGraph,
  toGraph: ProjectVersionGraph,
  fromTable: SchemaGraphTable,
  toTable: SchemaGraphTable,
  cascadeByStableTableId: Map<string, CascadeHint[]>,
): FieldDiff[] {
  const diffs: FieldDiff[] = [];

  const fromFields = fromGraph.fields.filter((f) => f.tableId === fromTable.id);
  const toFields = toGraph.fields.filter((f) => f.tableId === toTable.id);

  const fromFieldMap = new Map(fromFields.map((f) => [f.fieldId, f]));
  const toFieldMap = new Map(toFields.map((f) => [f.fieldId, f]));

  // Identify the PK fields so we can detect PK type changes with cascade.
  const fromPkFieldId = getPkFieldId(fromGraph, fromTable.id);
  const toPkFieldId = getPkFieldId(toGraph, toTable.id);
  const fromPkField = fromPkFieldId ? fromGraph.fields.find((f) => f.id === fromPkFieldId) : null;
  const toPkField = toPkFieldId ? toGraph.fields.find((f) => f.id === toPkFieldId) : null;

  const pkTypeChanged =
    fromPkField &&
    toPkField &&
    effectiveType(fromPkField) !== effectiveType(toPkField);

  const pkStableFieldId = fromPkField?.fieldId ?? null;

  const allFieldIds = new Set([...fromFieldMap.keys(), ...toFieldMap.keys()]);

  for (const stableFieldId of allFieldIds) {
    const fromField = fromFieldMap.get(stableFieldId);
    const toField = toFieldMap.get(stableFieldId);

    if (!fromField && toField) {
      const isRequired = !toField.nullable && toField.defaultKind === "none";
      diffs.push({
        fieldId: stableFieldId,
        fieldKey: toField.fieldKey,
        fieldName: toField.name,
        changeKind: "added",
        severity: isRequired ? "warning" : "info",
        from: "",
        to: toDisplayType(effectiveType(toField)),
        message: isRequired
          ? `Required field "${toField.name}" added with no default — existing rows will need backfill.`
          : `Field "${toField.name}" added.`,
        cascade: [],
        isPk: false,
      });
      continue;
    }

    if (fromField && !toField) {
      diffs.push({
        fieldId: stableFieldId,
        fieldKey: fromField.fieldKey,
        fieldName: fromField.name,
        changeKind: "removed",
        severity: "warning",
        from: toDisplayType(effectiveType(fromField)),
        to: "",
        message: `Field "${fromField.name}" was removed.`,
        cascade: [],
        isPk: stableFieldId === pkStableFieldId,
      });
      continue;
    }

    if (!fromField || !toField) continue;

    const changes: string[] = [];
    let severity: ChangeSeverity = "info";
    let cascade: CascadeHint[] = [];
    let changeKind: FieldDiff["changeKind"] = "multiple";

    const fromType = effectiveType(fromField);
    const toType = effectiveType(toField);

    if (fromType !== toType) {
      const isPk = pkTypeChanged && stableFieldId === pkStableFieldId;
      if (isPk) {
        changeKind = "pk_type_changed";
        severity = "breaking";
        cascade = cascadeByStableTableId.get(toTable.tableId) ?? [];
      } else {
        changeKind = "type_changed";
        severity = "warning";
      }
      changes.push(`Type changed from ${toDisplayType(fromType)} to ${toDisplayType(toType)}`);
    }

    if (fromField.name !== toField.name) {
      if (changes.length === 0) changeKind = "renamed";
      changes.push(`Renamed from "${fromField.name}" to "${toField.name}"`);
    }

    if (fromField.nullable !== toField.nullable) {
      if (changes.length === 0) changeKind = "nullability_changed";
      if (!fromField.nullable && toField.nullable) {
        changes.push(`Made optional`);
      } else {
        if (severity === "info") severity = "warning";
        changes.push(`Made required`);
      }
    }

    if (
      fromField.defaultKind !== "none" &&
      toField.defaultKind === "none" &&
      !toField.nullable
    ) {
      if (changes.length === 0) changeKind = "default_changed";
      if (severity === "info") severity = "warning";
      changes.push(`Default removed from required field`);
    }

    if (changes.length === 0) continue;
    if (changes.length > 1) changeKind = "multiple";

    diffs.push({
      fieldId: stableFieldId,
      fieldKey: toField.fieldKey,
      fieldName: toField.name,
      changeKind,
      severity,
      from: toDisplayType(fromType),
      to: toDisplayType(toType),
      message: changes.join("; "),
      cascade,
      isPk: stableFieldId === pkStableFieldId,
    });
  }

  return diffs;
}

export function detectVersionChanges(
  projectName: string,
  fromVersion: string,
  toVersion: string,
): VersionDiff {
  const fromGraph = readProjectVersionGraph(projectName, fromVersion);
  const toGraph = readProjectVersionGraph(projectName, toVersion);

  // Build FK cascade map: stable tableId → CascadeHints (FK fields that reference it in toGraph).
  // For PK type changes on table T, this tells us which FK fields in other tables reference T.
  const toTableByRowId = new Map(toGraph.tables.map((t) => [t.id, t]));
  const toFieldByRowId = new Map(toGraph.fields.map((f) => [f.id, f]));
  const toPkEffectiveTypeByStableId = new Map<string, string>();

  for (const table of toGraph.tables) {
    const pkFieldId = getPkFieldId(toGraph, table.id);
    const pkField = pkFieldId ? toGraph.fields.find((f) => f.id === pkFieldId) : null;
    if (pkField) toPkEffectiveTypeByStableId.set(table.tableId, effectiveType(pkField));
  }

  const cascadeByStableTableId = new Map<string, CascadeHint[]>();
  for (const relation of toGraph.relations) {
    const targetTable = toTableByRowId.get(relation.targetTableId);
    if (!targetTable) continue;
    const sourceTable = toTableByRowId.get(relation.sourceTableId);
    if (!sourceTable) continue;
    const targetPkType = toPkEffectiveTypeByStableId.get(targetTable.tableId);
    if (!targetPkType) continue;

    for (const pair of relation.fieldPairs) {
      const sourceField = toFieldByRowId.get(pair.sourceFieldId);
      if (!sourceField) continue;
      // Only flag as cascade if the FK type doesn't match the target PK type.
      if (effectiveType(sourceField) === targetPkType) continue;
      const existing = cascadeByStableTableId.get(targetTable.tableId) ?? [];
      existing.push({
        tableId: sourceTable.tableId,
        tableName: sourceTable.name,
        fieldId: sourceField.fieldId,
        fieldName: sourceField.name,
      });
      cascadeByStableTableId.set(targetTable.tableId, existing);
    }
  }

  // Compare tables
  const fromTableMap = new Map(fromGraph.tables.map((t) => [t.tableId, t]));
  const toTableMap = new Map(toGraph.tables.map((t) => [t.tableId, t]));
  const allTableIds = new Set([...fromTableMap.keys(), ...toTableMap.keys()]);

  const tableDiffs: TableDiff[] = [];

  for (const stableTableId of allTableIds) {
    const fromTable = fromTableMap.get(stableTableId);
    const toTable = toTableMap.get(stableTableId);

    if (!fromTable && toTable) {
      tableDiffs.push({
        tableId: stableTableId,
        tableKey: toTable.modelKey,
        tableName: toTable.name,
        fromName: "",
        changeKind: "added",
        severity: "info",
        message: `Table "${toTable.name}" was added.`,
        fieldDiffs: [],
      });
      continue;
    }

    if (fromTable && !toTable) {
      tableDiffs.push({
        tableId: stableTableId,
        tableKey: fromTable.modelKey,
        tableName: fromTable.name,
        fromName: fromTable.name,
        changeKind: "removed",
        severity: "breaking",
        message: `Table "${fromTable.name}" was removed.`,
        fieldDiffs: [],
      });
      continue;
    }

    if (!fromTable || !toTable) continue;

    const fieldDiffs = compareFields(
      fromGraph, toGraph, fromTable, toTable, cascadeByStableTableId,
    );
    const renamed = fromTable.name !== toTable.name;

    if (fieldDiffs.length === 0 && !renamed) continue;

    const hasBreaking = fieldDiffs.some((d) => d.severity === "breaking");
    const hasWarning = fieldDiffs.some((d) => d.severity === "warning");
    const tableSeverity: ChangeSeverity = hasBreaking
      ? "breaking"
      : hasWarning
        ? "warning"
        : "info";

    const changeKind: TableDiff["changeKind"] =
      renamed && fieldDiffs.length === 0 ? "renamed" : "changed";
    const message = renamed
      ? `Table renamed from "${fromTable.name}" to "${toTable.name}".`
      : `Table "${toTable.name}" has field changes.`;

    tableDiffs.push({
      tableId: stableTableId,
      tableKey: toTable.modelKey,
      tableName: toTable.name,
      fromName: fromTable.name,
      changeKind,
      severity: tableSeverity,
      message,
      fieldDiffs,
    });
  }

  // Compare enums
  const fromEnumMap = new Map(fromGraph.enums.map((e) => [e.enumKey, e]));
  const toEnumMap = new Map(toGraph.enums.map((e) => [e.enumKey, e]));
  const allEnumKeys = new Set([...fromEnumMap.keys(), ...toEnumMap.keys()]);

  const enumDiffs: EnumDiff[] = [];

  for (const enumKey of allEnumKeys) {
    const fromEnum = fromEnumMap.get(enumKey);
    const toEnum = toEnumMap.get(enumKey);

    if (!fromEnum && toEnum) {
      enumDiffs.push({
        enumId: enumKey,
        enumName: toEnum.name,
        changeKind: "added",
        severity: "info",
        message: `Enum "${toEnum.name}" was added.`,
        addedValues: toEnum.values.map((v) => v.name),
        removedValues: [],
      });
      continue;
    }

    if (fromEnum && !toEnum) {
      enumDiffs.push({
        enumId: enumKey,
        enumName: fromEnum.name,
        changeKind: "removed",
        severity: "breaking",
        message: `Enum "${fromEnum.name}" was removed.`,
        addedValues: [],
        removedValues: fromEnum.values.map((v) => v.name),
      });
      continue;
    }

    if (!fromEnum || !toEnum) continue;

    const fromValueKeys = new Set(fromEnum.values.map((v) => v.valueKey));
    const toValueKeys = new Set(toEnum.values.map((v) => v.valueKey));
    const addedValues = toEnum.values
      .filter((v) => !fromValueKeys.has(v.valueKey))
      .map((v) => v.name);
    const removedValues = fromEnum.values
      .filter((v) => !toValueKeys.has(v.valueKey))
      .map((v) => v.name);

    if (addedValues.length === 0 && removedValues.length === 0) continue;

    enumDiffs.push({
      enumId: enumKey,
      enumName: toEnum.name,
      changeKind: "values_changed",
      severity: removedValues.length > 0 ? "breaking" : "warning",
      message:
        removedValues.length > 0
          ? `Enum "${toEnum.name}" has removed values: ${removedValues.join(", ")}.`
          : `Enum "${toEnum.name}" has new values: ${addedValues.join(", ")}.`,
      addedValues,
      removedValues,
    });
  }

  // Compare relations by stable relationId
  const fromRelationMap = new Map(fromGraph.relations.map((r) => [r.relationId, r]));
  const toRelationMap = new Map(toGraph.relations.map((r) => [r.relationId, r]));
  const allRelationIds = new Set([...fromRelationMap.keys(), ...toRelationMap.keys()]);

  const relationDiffs: RelationDiff[] = [];

  for (const stableRelationId of allRelationIds) {
    const fromRel = fromRelationMap.get(stableRelationId);
    const toRel = toRelationMap.get(stableRelationId);

    if (!fromRel && toRel) {
      const sourceTable = toTableByRowId.get(toRel.sourceTableId);
      const targetTable = toTableByRowId.get(toRel.targetTableId);
      const ownerSide = toRel.sides.find((s) => s.isOwner);
      relationDiffs.push({
        relationId: stableRelationId,
        changeKind: "added",
        severity: "info",
        message: `Relation "${ownerSide?.fieldName ?? toRel.name}" was added.`,
        sourceTableName: sourceTable?.name ?? "",
        targetTableName: targetTable?.name ?? "",
        fieldName: ownerSide?.fieldName ?? "",
      });
      continue;
    }

    if (fromRel && !toRel) {
      const fromTableByRowId = new Map(fromGraph.tables.map((t) => [t.id, t]));
      const sourceTable = fromTableByRowId.get(fromRel.sourceTableId);
      const targetTable = fromTableByRowId.get(fromRel.targetTableId);
      const ownerSide = fromRel.sides.find((s) => s.isOwner);
      relationDiffs.push({
        relationId: stableRelationId,
        changeKind: "removed",
        severity: "warning",
        message: `Relation "${ownerSide?.fieldName ?? fromRel.name}" (${sourceTable?.name ?? "?"} → ${targetTable?.name ?? "?"}) was removed.`,
        sourceTableName: sourceTable?.name ?? "",
        targetTableName: targetTable?.name ?? "",
        fieldName: ownerSide?.fieldName ?? "",
      });
    }
  }

  const hasBreaking =
    tableDiffs.some((d) => d.severity === "breaking") ||
    enumDiffs.some((d) => d.severity === "breaking");
  const hasWarnings =
    tableDiffs.some((d) => d.severity === "warning") ||
    enumDiffs.some((d) => d.severity === "warning") ||
    relationDiffs.some((d) => d.severity === "warning");

  // ── Compare UNIQUE / INDEX constraints ────────────────────────────────────
  // Constraints have no stable UUID, so we identify them by semantic key:
  // "TableName:TYPE:field1,field2" (fields sorted by name for stability).
  const fromFieldByRowIdForConstraints = new Map(fromGraph.fields.map((f) => [f.id, f]));
  const toFieldByRowIdForConstraints = new Map(toGraph.fields.map((f) => [f.id, f]));

  function constraintSemanticKey(
    tableName: string,
    type: string,
    fieldIds: string[],
    fieldById: Map<string, { name: string }>,
  ): string {
    const names = fieldIds.map((id) => fieldById.get(id)?.name ?? id).sort();
    return `${tableName}:${type}:${names.join(",")}`;
  }

  // Build key → constraint for from and to graphs (UNIQUE + INDEX only, skip PK)
  const fromConstraintMap = new Map<string, { tableName: string; fields: string[]; dbName: string | null }>();
  for (const fromTable of fromGraph.tables) {
    const toMatchTable = [...toGraph.tables].find((t) => (t.tableId ?? t.modelKey) === (fromTable.tableId ?? fromTable.modelKey));
    const displayName = toMatchTable?.name ?? fromTable.name;
    for (const c of fromGraph.constraints) {
      if (c.tableId !== fromTable.id) continue;
      if (c.type !== "UNIQUE" && c.type !== "INDEX") continue;
      const key = constraintSemanticKey(displayName, c.type, c.fieldIds, fromFieldByRowIdForConstraints);
      const fieldNames = c.fieldIds.map((id) => fromFieldByRowIdForConstraints.get(id)?.name ?? id).sort();
      fromConstraintMap.set(key, { tableName: displayName, fields: fieldNames, dbName: c.dbName ?? null });
    }
  }

  const toConstraintMap = new Map<string, { tableName: string; fields: string[]; dbName: string | null; type: string }>();
  for (const toTable of toGraph.tables) {
    for (const c of toGraph.constraints) {
      if (c.tableId !== toTable.id) continue;
      if (c.type !== "UNIQUE" && c.type !== "INDEX") continue;
      const key = constraintSemanticKey(toTable.name, c.type, c.fieldIds, toFieldByRowIdForConstraints);
      const fieldNames = c.fieldIds.map((id) => toFieldByRowIdForConstraints.get(id)?.name ?? id).sort();
      toConstraintMap.set(key, { tableName: toTable.name, fields: fieldNames, dbName: c.dbName ?? null, type: c.type });
    }
  }

  const restrictionDiffs: RestrictionDiff[] = [];

  // Added constraints
  for (const [key, info] of toConstraintMap) {
    if (fromConstraintMap.has(key)) continue;
    const isUnique = info.type === "UNIQUE";
    const fieldList = info.fields.join(", ");
    const changeKind = isUnique ? "unique_added" : "index_added";
    restrictionDiffs.push({
      constraintKey: key,
      changeKind,
      severity: isUnique ? "warning" : "info",
      tableName: info.tableName,
      fields: info.fields,
      dbName: info.dbName,
      message: isUnique
        ? `UNIQUE constraint added on (${fieldList}) in "${info.tableName}". Migration fails if duplicate values exist — deduplicate before proceeding.`
        : `INDEX added on (${fieldList}) in "${info.tableName}". No data impact.`,
    });
  }

  // Removed constraints
  for (const [key, info] of fromConstraintMap) {
    if (toConstraintMap.has(key)) continue;
    const fromType = key.split(":")[1] ?? "UNIQUE";
    const isUnique = fromType === "UNIQUE";
    const fieldList = info.fields.join(", ");
    restrictionDiffs.push({
      constraintKey: key,
      changeKind: isUnique ? "unique_removed" : "index_removed",
      severity: "info",
      tableName: info.tableName,
      fields: info.fields,
      dbName: info.dbName,
      message: isUnique
        ? `UNIQUE constraint removed from (${fieldList}) in "${info.tableName}". Duplicate values are now allowed.`
        : `INDEX removed from (${fieldList}) in "${info.tableName}". No data impact.`,
    });
  }

  const hasWarningsFinal = hasWarnings || restrictionDiffs.some((d) => d.severity === "warning");

  return { fromVersion, toVersion, tableDiffs, enumDiffs, relationDiffs, restrictionDiffs, hasBreaking, hasWarnings: hasWarningsFinal };
}
