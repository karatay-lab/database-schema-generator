export type ImportMode = "version" | "project";

export type VersionStats = {
  name: string;
  tableCount: number;
  fieldCount: number;
  relationCount: number;
  enumCount: number;
};

export type ParsedPreview = {
  type: "version" | "project";
  exportedAt: string;
  sourceProjectName: string;
  provider: string;
  versionCount: number;
  versions: VersionStats[];
};
