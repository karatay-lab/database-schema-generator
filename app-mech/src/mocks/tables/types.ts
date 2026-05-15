export type LogicalType =
  | "string"
  | "integer"
  | "float"
  | "decimal"
  | "boolean"
  | "timestamp"
  | "json";

export type DefaultKind =
  | "none"
  | "literal"
  | "uuid"
  | "function"
  | "now"
  | "autoincrement";

export type MockFieldDef = {
  name: string;
  dbName?: string;
  logicalType: LogicalType;
  nativeType?: string;
  nullable: boolean;
  isArray: boolean;
  isId: boolean;
  defaultKind: DefaultKind;
  defaultValue: string;
  defaultPostgres?: string;
  defaultMysql?: string;
  comment: string;
  isUpdatedAt: boolean;
  sortOrder: number;
};

export type MockTableDef = {
  name: string;
  dbName: string;
  comment: string;
  sortOrder: number;
  fields: MockFieldDef[];
};
