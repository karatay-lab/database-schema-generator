import superjson from "superjson";

const BASE = "http://localhost:3000/api/trpc";

export const PROJECT_NAME = "Project Mock To Test";
export const VERSION = "1.0111";
export const PROVIDER = "Postgres" as const;
export const SCHEMA_OPTIONS = { client: "prisma-client-js", graphql: "None" } as const;

async function call<T>(procedure: string, type: "query" | "mutation", input?: unknown): Promise<T> {
  const serialized = superjson.serialize(input ?? {});

  const url = type === "query"
    ? `${BASE}/${procedure}?batch=1&input=${encodeURIComponent(JSON.stringify({ "0": serialized }))}`
    : `${BASE}/${procedure}?batch=1`;

  const res = await fetch(url, {
    method: type === "query" ? "GET" : "POST",
    headers: { "Content-Type": "application/json" },
    ...(type === "mutation" ? { body: JSON.stringify({ "0": serialized }) } : {}),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`tRPC ${procedure} HTTP ${res.status}: ${text}`);
  }

  const raw = await res.json() as [{ result?: { data?: unknown }; error?: unknown }];
  const item = raw[0];
  if (item?.error) throw new Error(`tRPC error on ${procedure}: ${JSON.stringify(item.error)}`);
  return superjson.deserialize(item?.result?.data as ReturnType<typeof superjson.serialize>) as T;
}

// ─── typed helpers ────────────────────────────────────────────────────────────

import type { Project } from "@/app/views/shared/dashboard-data";

type SchemaOptions = { client: string; graphql: string };
type Provider = "Postgres" | "MySQL" | "SQLite";
type PkType = "String" | "Int" | "BigInt" | "DateTime" | "Uuid";

type TableRow = { key: string; name: string; pkName: string; pkType: string };
type FieldRow  = { key: string; name: string; type: string; nullable: boolean; unique: boolean; defaultValue: string };
type RelRow    = { key: string; name: string };
type RestRow   = { key: string; type: string; fields: string[] };
type EnumValue = { valueId: string; name: string };
type EnumRow   = { name: string; values: EnumValue[] };

type FieldInput = {
  projectName: string; version: string; modelName: string;
  name: string; type: string; nullable?: boolean; unique?: boolean;
  defaultValue?: string; comment?: string; updatedAtAttribute?: boolean; isId?: boolean;
};

export const api = {
  projects: {
    list: () =>
      call<Project[]>("projects.list", "query"),
    create: (input: { name: string; provider: Provider; schemaOptions: SchemaOptions }) =>
      call<Project>("projects.create", "mutation", input),
    delete: (input: { id: string }) =>
      call<Project[]>("projects.delete", "mutation", input),
    forkVersion: (input: { projectId: string }) =>
      call<{ newVersion: string }>("projects.forkVersion", "mutation", input),
  },
  tables: {
    list: (input: { projectName: string; version: string }) =>
      call<TableRow[]>("tables.list", "query", input),
    create: (input: { projectName: string; version: string; modelName: string; pkName: string; pkType: PkType }) =>
      call<unknown>("tables.create", "mutation", input),
    update: (input: { projectName: string; version: string; oldModelName?: string; modelKey?: string; newModelName: string; pkName: string; pkType: PkType }) =>
      call<unknown>("tables.update", "mutation", input),
    delete: (input: { projectName: string; version: string; modelName?: string; modelKey?: string }) =>
      call<unknown>("tables.delete", "mutation", input),
  },
  fields: {
    list: (input: { projectName: string; version: string; modelName: string }) =>
      call<{ fields: FieldRow[] }>("fields.list", "query", input),
    create: (input: FieldInput) =>
      call<unknown>("fields.create", "mutation", input),
    update: (input: FieldInput & { oldFieldName?: string; fieldKey?: string }) =>
      call<unknown>("fields.update", "mutation", input),
    delete: (input: { projectName: string; version: string; modelName: string; fieldName?: string; fieldKey?: string }) =>
      call<unknown>("fields.delete", "mutation", input),
  },
  relations: {
    list: (input: { projectName: string; version: string; modelName: string }) =>
      call<{ relations: RelRow[] }>("relations.list", "query", input),
    create: (input: {
      projectName: string; version: string; modelName: string;
      name: string; targetModel: string; backReferenceName: string;
      fields: string[]; references: string[]; onDelete: string; onUpdate: string;
      nullable: boolean; isArray: boolean; backReferenceIsArray: boolean;
    }) => call<unknown>("relations.create", "mutation", input),
    delete: (input: { projectName: string; version: string; modelName: string; relationKey: string }) =>
      call<unknown>("relations.delete", "mutation", input),
  },
  restrictions: {
    list: (input: { projectName: string; version: string; modelName: string }) =>
      call<{ restrictions: RestRow[] }>("restrictions.list", "query", input),
    create: (input: {
      projectName: string; version: string; modelName: string;
      type: "UNIQUE" | "INDEX"; fields: string[]; dbName: string;
    }) => call<unknown>("restrictions.create", "mutation", input),
  },
  enums: {
    list: (input: { projectName: string; version: string }) =>
      call<EnumRow[]>("enums.list", "query", input),
    create: (input: { projectName: string; version: string; name: string }) =>
      call<unknown>("enums.create", "mutation", input),
    addValue: (input: { projectName: string; version: string; enumName: string; value: string }) =>
      call<unknown>("enums.addValue", "mutation", input),
  },
};
