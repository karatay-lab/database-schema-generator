export type GenerateRequest = {
  projectName: string;
  version: string;
  modelName: string;
  modelKey: string;
  selectedFields: string[];
};

export type GenerateResponse = {
  code?: string;
  filePath?: string;
  schemaCount?: number;
  enumCount?: number;
  warnings?: string[];
  error?: string;
};
