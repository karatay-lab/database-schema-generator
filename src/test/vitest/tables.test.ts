import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { caller, DEFAULT_SCHEMA_OPTIONS } from "./helpers";

const PROJECT_NAME = "Test Tables Project";
const VERSION = "1.0111";
let projectId: string;

beforeAll(async () => {
  const p = await caller.projects.create({
    name: PROJECT_NAME,
    provider: "Postgres",
    schemaOptions: DEFAULT_SCHEMA_OPTIONS,
  });
  projectId = p.id;
});

afterAll(async () => {
  if (projectId) await caller.projects.delete({ id: projectId });
});

describe("tables.list", () => {
  it("returns empty schema for a fresh project", async () => {
    const schema = await caller.tables.list({ projectName: PROJECT_NAME, version: VERSION });
    expect(Array.isArray(schema)).toBe(true);
    expect(schema).toHaveLength(0);
  });
});

describe("tables.create", () => {
  it("creates a table with default id pk", async () => {
    const schema = await caller.tables.create({
      projectName: PROJECT_NAME,
      version: VERSION,
      modelName: "User",
      pkName: "id",
      pkType: "Int",
    });
    const model = schema?.find((m) => m.name === "User");
    expect(model).toBeDefined();
    expect(model?.pkName).toBe("id");
  });

  it("rejects invalid model name (starts with digit)", async () => {
    await expect(
      caller.tables.create({
        projectName: PROJECT_NAME,
        version: VERSION,
        modelName: "1Invalid",
        pkName: "id",
        pkType: "Int",
      }),
    ).rejects.toThrow();
  });

  it("rejects duplicate model name", async () => {
    await expect(
      caller.tables.create({
        projectName: PROJECT_NAME,
        version: VERSION,
        modelName: "User",
        pkName: "id",
        pkType: "Int",
      }),
    ).rejects.toThrow();
  });

  it("creates a second table with UUID pk", async () => {
    const schema = await caller.tables.create({
      projectName: PROJECT_NAME,
      version: VERSION,
      modelName: "Post",
      pkName: "id",
      pkType: "String",
    });
    expect(schema?.find((m) => m.name === "Post")).toBeDefined();
  });
});

describe("tables.update", () => {
  it("renames a table", async () => {
    const schema = await caller.tables.update({
      projectName: PROJECT_NAME,
      version: VERSION,
      oldModelName: "Post",
      newModelName: "Article",
      pkName: "id",
      pkType: "String",
    });
    expect(schema?.find((m) => m.name === "Article")).toBeDefined();
    expect(schema?.find((m) => m.name === "Post")).toBeUndefined();
  });
});

describe("tables.delete", () => {
  it("removes a table", async () => {
    const schema = await caller.tables.delete({
      projectName: PROJECT_NAME,
      version: VERSION,
      modelName: "Article",
    });
    expect(schema?.find((m) => m.name === "Article")).toBeUndefined();
  });
});
