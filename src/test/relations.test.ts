import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { caller, DEFAULT_SCHEMA_OPTIONS } from "./helpers";

const PROJECT_NAME = "Test Relations Project";
const VERSION = "1.0111";
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
    modelName: "User",
    pkName: "id",
    pkType: "Int",
  });
  await caller.tables.create({
    projectName: PROJECT_NAME,
    version: VERSION,
    modelName: "Post",
    pkName: "id",
    pkType: "Int",
  });
});

afterAll(async () => {
  if (projectId) await caller.projects.delete({ id: projectId });
});

describe("relations.list", () => {
  it("returns empty list on a fresh model", async () => {
    const result = await caller.relations.list({
      projectName: PROJECT_NAME,
      version: VERSION,
      modelName: "User",
    });
    expect(Array.isArray(result!.relations)).toBe(true);
    expect(result!.relations).toHaveLength(0);
  });
});

describe("relations.create", () => {
  it("creates a one-to-many relation between User and Post", async () => {
    const result = await caller.relations.create({
      projectName: PROJECT_NAME,
      version: VERSION,
      modelName: "Post",
      name: "author",
      targetModel: "User",
      backReferenceName: "posts",
      fields: ["authorId"],
      references: ["id"],
      onDelete: "Cascade",
      onUpdate: "",
      nullable: false,
      isArray: false,
      backReferenceIsArray: true,
    });
    expect(result).toBeDefined();
  });
});

describe("relations.list after create", () => {
  it("Post model has the author relation", async () => {
    const result = await caller.relations.list({
      projectName: PROJECT_NAME,
      version: VERSION,
      modelName: "Post",
    });
    expect(result!.relations.some((r) => r.name === "author")).toBe(true);
  });
});

describe("relations.delete", () => {
  it("removes the relation", async () => {
    const before = await caller.relations.list({
      projectName: PROJECT_NAME,
      version: VERSION,
      modelName: "Post",
    });
    const target = before!.relations.find((r) => r.name === "author");
    expect(target).toBeDefined();

    await caller.relations.delete({
      projectName: PROJECT_NAME,
      version: VERSION,
      modelName: "Post",
      relationKey: target!.key,
    });

    const after = await caller.relations.list({
      projectName: PROJECT_NAME,
      version: VERSION,
      modelName: "Post",
    });
    expect(after!.relations.find((r) => r.name === "author")).toBeUndefined();
  });
});
