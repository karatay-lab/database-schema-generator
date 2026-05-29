import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { caller, DEFAULT_SCHEMA_OPTIONS } from "./helpers";

const PROJECT_NAME = "Test Fields Project";
const VERSION = "1.0111";
const MODEL = "User";
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
});

afterAll(async () => {
  if (projectId) await caller.projects.delete({ id: projectId });
});

describe("fields.list", () => {
  it("returns only the pk field on a fresh model", async () => {
    const result = await caller.fields.list({
      projectName: PROJECT_NAME,
      version: VERSION,
      modelName: MODEL,
    });
    expect(result).toBeDefined();
    expect(result!.fields.length).toBeGreaterThanOrEqual(1);
    expect(result!.fields.some((f) => f.name === "id")).toBe(true);
  });
});

describe("fields.create", () => {
  it("adds a String field", async () => {
    const result = await caller.fields.create({
      projectName: PROJECT_NAME,
      version: VERSION,
      modelName: MODEL,
      name: "email",
      type: "String",
      nullable: false,
      unique: true,
      defaultValue: "",
      comment: "",
      updatedAtAttribute: false,
      isId: false,
    });
    expect(result).toBeDefined();
  });

  it("adds a nullable DateTime field", async () => {
    const result = await caller.fields.create({
      projectName: PROJECT_NAME,
      version: VERSION,
      modelName: MODEL,
      name: "deletedAt",
      type: "DateTime",
      nullable: true,
      unique: false,
      defaultValue: "",
      comment: "",
      updatedAtAttribute: false,
      isId: false,
    });
    expect(result).toBeDefined();
  });

  it("adds a Boolean field with default", async () => {
    const result = await caller.fields.create({
      projectName: PROJECT_NAME,
      version: VERSION,
      modelName: MODEL,
      name: "isActive",
      type: "Boolean",
      nullable: false,
      unique: false,
      defaultValue: "true",
      comment: "",
      updatedAtAttribute: false,
      isId: false,
    });
    expect(result).toBeDefined();
  });
});

describe("fields.update", () => {
  it("updates a field name and nullability", async () => {
    const listResult = await caller.fields.list({
      projectName: PROJECT_NAME,
      version: VERSION,
      modelName: MODEL,
    });
    const emailField = listResult!.fields.find((f) => f.name === "email");
    expect(emailField).toBeDefined();

    const result = await caller.fields.update({
      projectName: PROJECT_NAME,
      version: VERSION,
      modelName: MODEL,
      fieldKey: emailField!.key,
      name: "email",
      type: "String",
      nullable: true,
      unique: false,
      defaultValue: "",
      comment: "user email",
      updatedAtAttribute: false,
      isId: false,
    });
    expect(result).toBeDefined();
  });
});

describe("fields.delete", () => {
  it("removes a field by key", async () => {
    const listResult = await caller.fields.list({
      projectName: PROJECT_NAME,
      version: VERSION,
      modelName: MODEL,
    });
    const target = listResult!.fields.find((f) => f.name === "deletedAt");
    expect(target).toBeDefined();

    await caller.fields.delete({
      projectName: PROJECT_NAME,
      version: VERSION,
      modelName: MODEL,
      fieldKey: target!.key,
    });

    const updated = await caller.fields.list({
      projectName: PROJECT_NAME,
      version: VERSION,
      modelName: MODEL,
    });
    expect(updated!.fields.find((f) => f.name === "deletedAt")).toBeUndefined();
  });
});
