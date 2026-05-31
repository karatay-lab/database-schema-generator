export type ExportResponse = {
  id?: string;
  code?: string;
  fileName?: string;
  tableCount?: number;
  enumCount?: number;
  error?: string;
};

export type ExportDialogState = {
  exportId: string;
  code: string;
  fileName: string;
  lang: "ts" | "prisma";
  tableCount: number;
  enumCount: number;
};
