import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { caller, DEFAULT_SCHEMA_OPTIONS } from "./helpers";

const PROJECT_NAME = "Test Enums Project";
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

describe("enums.list", () => {
  it("returns empty list for a fresh project", async () => {
    const enums = await caller.enums.list({ projectName: PROJECT_NAME, version: VERSION });
    expect(enums).toEqual([]);
  });
});

describe("enums.create", () => {
  it("creates an enum", async () => {
    const enums = await caller.enums.create({
      projectName: PROJECT_NAME,
      version: VERSION,
      name: "Role",
    });
    expect(enums?.find((e) => e.name === "Role")).toBeDefined();
  });

  it("rejects duplicate enum name", async () => {
    await expect(
      caller.enums.create({ projectName: PROJECT_NAME, version: VERSION, name: "Role" }),
    ).rejects.toThrow();
  });
});

describe("enums.addValue", () => {
  it("adds values to an enum", async () => {
    const enums = await caller.enums.list({ projectName: PROJECT_NAME, version: VERSION });
    const roleEnum = enums!.find((e) => e.name === "Role");
    expect(roleEnum).toBeDefined();

    await caller.enums.addValue({
      projectName: PROJECT_NAME,
      version: VERSION,
      enumName: "Role",
      value: "ADMIN",
    });
    await caller.enums.addValue({
      projectName: PROJECT_NAME,
      version: VERSION,
      enumName: "Role",
      value: "USER",
    });

    const updated = await caller.enums.list({ projectName: PROJECT_NAME, version: VERSION });
    const role = updated!.find((e) => e.name === "Role");
    expect(role?.values.map((v) => v.name)).toContain("ADMIN");
    expect(role?.values.map((v) => v.name)).toContain("USER");
  });
});

describe("enums.rename", () => {
  it("renames an enum", async () => {
    const enums = await caller.enums.rename({
      projectName: PROJECT_NAME,
      version: VERSION,
      oldName: "Role",
      newName: "UserRole",
    });
    expect(enums?.find((e) => e.name === "UserRole")).toBeDefined();
    expect(enums?.find((e) => e.name === "Role")).toBeUndefined();
  });
});

describe("enums.deleteValue", () => {
  it("removes a value from an enum", async () => {
    const enums = await caller.enums.list({ projectName: PROJECT_NAME, version: VERSION });
    const role = enums!.find((e) => e.name === "UserRole");
    const adminValue = role?.values.find((v) => v.name === "ADMIN");
    expect(adminValue).toBeDefined();

    await caller.enums.deleteValue({
      projectName: PROJECT_NAME,
      version: VERSION,
      enumName: "UserRole",
      valueId: adminValue!.valueId,
    });

    const updated = await caller.enums.list({ projectName: PROJECT_NAME, version: VERSION });
    const updatedRole = updated!.find((e) => e.name === "UserRole");
    expect(updatedRole?.values.map((v) => v.name)).not.toContain("ADMIN");
  });
});

describe("enums.delete", () => {
  it("removes the enum", async () => {
    const enums = await caller.enums.delete({
      projectName: PROJECT_NAME,
      version: VERSION,
      name: "UserRole",
    });
    expect(enums?.find((e) => e.name === "UserRole")).toBeUndefined();
  });
});
