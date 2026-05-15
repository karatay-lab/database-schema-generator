export type DbStatus = {
  initialized: boolean;
  relPath: string;
};

export type MigrateStep = {
  name: "validate" | "push";
  output: string;
  success: boolean;
};

export type MigrateResult = {
  success: boolean;
  stage?: "validate" | "push";
  steps?: MigrateStep[];
  relPath: string;
  schemaRelPath: string;
  backupRelPath?: string | null;
  error?: string;
};

export type QueryResult =
  | { kind: "rows"; columns: string[]; rows: Record<string, unknown>[]; rowCount: number; truncated?: boolean; duration: number }
  | { kind: "mutation"; affectedRows: number; lastInsertRowid: string | null; duration: number }
  | { kind: "exec"; duration: number }
  | { kind: "error"; error: string };
