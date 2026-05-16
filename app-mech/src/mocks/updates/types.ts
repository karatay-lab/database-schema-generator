export type TableRenameDef = {
  from: string;
  to: string;
  dbName?: string;
};

export type FieldRenameDef = {
  table: string; // v1 table name (before any table renames in this delta)
  from: string;
  to: string;
};

export type FieldTypeChangeDef = {
  table: string;  // v1 table name (before any table renames in this delta)
  field: string;  // v1 field name (before any field renames in this delta)
  logicalType: string;
  nativeType?: string | null;
};

export type ProjectV2Delta = {
  tableRenames: TableRenameDef[];
  fieldRenames: FieldRenameDef[];
  fieldTypeChanges: FieldTypeChangeDef[];
  removedRelations: string[];    // relation names to delete
  removedRestrictions: string[]; // constraint names to delete
};
