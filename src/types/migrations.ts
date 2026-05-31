export type MigrationPhase = "connection" | "pull" | "model-diff" | "collect" | "validate" | "migrate";
export type PhaseState = "idle" | "loading" | "success" | "error";

/** Stored in connections.json — no password */
export type ConnectionRecord = {
  uuid: string;
  name: string;
  provider: string;
  host: string;
  port: string;
  database: string;
  createdAt: string;
  lastUsedAt: string;
};

/** Stored in {uuid}/connection.json — includes password */
export type StoredConnection = ConnectionRecord & {
  user: string;
  password: string;
};

export type ValidationIssue = {
  model: string;
  field: string;
  issue: string;
  suggestion: string;
  severity: "error" | "warning";
};

export type ConnectionsResponse = {
  success: boolean;
  connections?: ConnectionRecord[];
  error?: string;
};

export type ConnectResponse = {
  success: boolean;
  uuid?: string;
  tables?: string[];
  introspectedSchema?: string;
  error?: string;
};

export type TestConnectionResponse = {
  success: boolean;
  tables?: string[];
  tableCounts?: { name: string; count: number }[];
  error?: string;
};

export type PullResponse = {
  success: boolean;
  hash?: string;
  storedPath?: string;
  tables?: string[];
  error?: string;
};

export type SchemaCheckResult = {
  version: string;
  valid: boolean;
  errors: string[];
};

export type SchemaCheckResponse = {
  success: boolean;
  sync?: SchemaCheckResult;
  target?: SchemaCheckResult;
  bothValid?: boolean;
  error?: string;
};

export type CollectResponse = {
  success: boolean;
  dataPath?: string;
  snapshotId?: string;
  timestamp?: string;
  tables?: { name: string; count: number }[];
  totalRecords?: number;
  isEmpty?: boolean;
  tableMismatches?: { schemaTable: string; resolvedTable: string | null }[];
  migrationOrder?: { tableId: string; modelName: string; dbName: string; parentCount: number }[];
  collectError?: string;
  error?: string;
};

export type ValidateResponse = {
  success: boolean;
  stage1Issues?: ValidationIssue[];
  stage2Issues?: ValidationIssue[];
  passed?: boolean;
  error?: string;
};

export type InvalidRow = {
  table: string;
  rowIndex: number;
  field: string;
  value: unknown;
  error: string;
};

export type RunResponse = {
  success: boolean;
  needsFix?: boolean;
  stage1Issues?: ValidationIssue[];
  stage2Issues?: ValidationIssue[];
  invalidRows?: InvalidRow[];
  tables?: { name: string; created: number; updated: number; errors: number }[];
  migrationOrder?: { tableId: string; modelName: string; dbName: string; parentCount: number }[];
  logPath?: string;
  newVersion?: string;
  error?: string;
};

// ─── model comparison types ───────────────────────────────────────────────────

export type FieldMatchResult = {
  key: string;
  fromName: string;
  toName: string;
  fromType: string;
  toType: string;
  fromNullable: boolean;
  toNullable: boolean;
  fromDefault: string;
  toDefault: string;
  fromComment: string;
  toComment: string;
  nameChanged: boolean;
  typeChanged: boolean;
  nullabilityChanged: boolean;
  defaultChanged: boolean;
  commentChanged: boolean;
  isRelation: boolean;
};

export type ModelMatchResult = {
  key: string;
  fromName: string;
  toName: string;
  nameChanged: boolean;
  hasChanges: boolean;
  matchedFields: FieldMatchResult[];
  addedFields: { key: string; name: string; type: string; nullable: boolean }[];
  removedFields: { key: string; name: string; type: string; nullable: boolean }[];
};

export type ModelComparisonResult = {
  fromVersion: string;
  toVersion: string;
  matchedModels: ModelMatchResult[];
  addedModels: { key: string; name: string }[];
  removedModels: { key: string; name: string }[];
  totalFieldChanges: number;
};

export type CompareResponse = {
  success: boolean;
  comparison?: ModelComparisonResult;
  error?: string;
};

export type ZodPairResponse = {
  success: boolean;
  generatedFrom: number;
  generatedTo: number;
  errors: string[];
};

export type PushNewResponse = {
  success: boolean;
  logPath?: string;
  newVersion?: string;
  error?: string;
};

export type ColumnIssue = {
  table: string;
  missingColumns: string[];
};

export type CheckSyncResponse = {
  success: boolean;
  compatible?: boolean;
  missingTables?: string[];
  extraTables?: string[];
  columnIssues?: ColumnIssue[];
  error?: string;
};

export type MigrationPlan = "new" | "version";

export type MigrationOrderItem = { modelName: string; parentCount?: number };

export type MigrateProgressEvent = {
  name: string;
  created: number;
  updated: number;
  errors: number;
};

export type MigrationSession = {
  id: string;
  projectId: string;
  projectName: string;
  connectionId: string;
  fromVersion: string;
  toVersion: string;
  collectTimestamp: string | null;
  collectTableCount: number | null;
  collectRowCount: number | null;
  collectTables: { name: string; count: number }[] | null;
  runStatus: string | null;
  runLogPath: string | null;
  updatedAt: string;
};
