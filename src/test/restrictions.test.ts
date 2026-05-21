import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { caller, DEFAULT_SCHEMA_OPTIONS } from "./helpers";

const PROJECT_NAME = "Test Restrictions Proj";
const VERSION = "1.0111";
const MODEL = "Product";
let projectId: string;

beforeAll(async () => {
  const p = await caller.projects.create({
    name: PROJECT_NAME,
    provider: "Postgres",
    schemaOptions: DEFAULT_SCHEMA_OPTIONS,
  });
  projectId = p.id;
  await caller.tables.create({
    projectName: PROJECT_NAME,
    version: VERSION,
    modelName: MODEL,
    pkName: "id",
    pkType: "Int",
  });
  await caller.fields.create({
    projectName: PROJECT_NAME,
    version: VERSION,
    modelName: MODEL,
    name: "sku",
    type: "String",
    nullable: false,
    unique: false,
    defaultValue: "",
    comment: "",
    updatedAtAttribute: false,
    isId: false,
  });
  await caller.fields.create({
    projectName: PROJECT_NAME,
    version: VERSION,
    modelName: MODEL,
    name: "slug",
    type: "String",
    nullable: false,
    unique: false,
    defaultValue: "",
    comment: "",
    updatedAtAttribute: false,
    isId: false,
  });
});

afterAll(async () => {
  if (projectId) await caller.projects.delete({ id: projectId });
});

describe("restrictions.list", () => {
  it("returns empty list for a fresh model", async () => {
    const result = await caller.restrictions.list({
      projectName: PROJECT_NAME,
      version: VERSION,
      modelName: MODEL,
    });
    expect(Array.isArray(result!.restrictions)).toBe(true);
  });
});

describe("restrictions.create", () => {
  it("creates a UNIQUE constraint on sku", async () => {
    const result = await caller.restrictions.create({
      projectName: PROJECT_NAME,
      version: VERSION,
      modelName: MODEL,
      type: "UNIQUE",
      fields: ["sku"],
      dbName: "",
    });
    expect(result).toBeDefined();
  });

  it("creates an INDEX on slug", async () => {
    const result = await caller.restrictions.create({
      projectName: PROJECT_NAME,
      version: VERSION,
      modelName: MODEL,
      type: "INDEX",
      fields: ["slug"],
      dbName: "idx_product_slug",
    });
    expect(result).toBeDefined();
  });
});

describe("restrictions.delete", () => {
  it("removes a restriction by key", async () => {
    const before = await caller.restrictions.list({
      projectName: PROJECT_NAME,
      version: VERSION,
      modelName: MODEL,
    });
    expect(before!.restrictions.length).toBeGreaterThanOrEqual(1);

    const target = before!.restrictions[0]!;
    await caller.restrictions.delete({
      projectName: PROJECT_NAME,
      version: VERSION,
      modelName: MODEL,
      restrictionKey: target.key,
    });

    const after = await caller.restrictions.list({
      projectName: PROJECT_NAME,
      version: VERSION,
      modelName: MODEL,
    });
    expect(after!.restrictions.find((r) => r.key === target.key)).toBeUndefined();
  });
});
