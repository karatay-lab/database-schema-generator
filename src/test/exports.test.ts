import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { caller, DEFAULT_SCHEMA_OPTIONS } from "./helpers";

const PROJECT_NAME = "Test Exports Project";
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
  await caller.fields.create({
    projectName: PROJECT_NAME,
    version: VERSION,
    modelName: "User",
    name: "email",
    type: "String",
    nullable: false,
    unique: true,
    defaultValue: "",
    comment: "",
    updatedAtAttribute: false,
    isId: false,
  });
});

afterAll(async () => {
  if (projectId) await caller.projects.delete({ id: projectId });
});

describe("exports.generate — prisma", () => {
  it("generates a valid Prisma schema string", async () => {
    const result = await caller.exports.generate({
      projectName: PROJECT_NAME,
      version: VERSION,
      type: "prisma",
    });
    expect(result?.code).toBeDefined();
    expect(result?.code).toContain("model User");
    expect(result?.code).toContain("email");
    expect(result?.fileName).toMatch(/\.prisma$/);
  });
});

describe("exports.generate — drizzle", () => {
  it("generates a valid Drizzle TypeScript schema string", async () => {
    const result = await caller.exports.generate({
      projectName: PROJECT_NAME,
      version: VERSION,
      type: "drizzle",
    });
    expect(result?.code).toBeDefined();
    expect(result?.code).toContain("user");
    expect(result?.fileName).toMatch(/\.ts$/);
    expect(result?.tableCount).toBeGreaterThanOrEqual(1);
  });
});

describe("exports.generate — pickle-version", () => {
  it("generates a version pickle JSON", async () => {
    const result = await caller.exports.generate({
      projectName: PROJECT_NAME,
      version: VERSION,
      type: "pickle-version",
    });
    expect(result?.code).toBeDefined();
    const parsed = JSON.parse(result!.code!);
    expect(parsed.pickleVersion).toBe(1);
    expect(parsed.type).toBe("version");
    expect(parsed.project.name).toBe(PROJECT_NAME);
    expect(parsed.version.tables.length).toBeGreaterThanOrEqual(1);
  });
});

describe("exports.generate — pickle-project", () => {
  it("generates a project pickle JSON with all versions", async () => {
    const result = await caller.exports.generate({
      projectName: PROJECT_NAME,
      version: VERSION,
      type: "pickle-project",
    });
    expect(result?.code).toBeDefined();
    const parsed = JSON.parse(result!.code!);
    expect(parsed.pickleVersion).toBe(1);
    expect(parsed.type).toBe("project");
    expect(Array.isArray(parsed.versions)).toBe(true);
    expect(parsed.versions.length).toBeGreaterThanOrEqual(1);
  });
});

describe("exports.list", () => {
  it("returns an array for the project (may be empty since pickles aren't logged)", async () => {
    const history = await caller.exports.list({ projectName: PROJECT_NAME });
    expect(Array.isArray(history)).toBe(true);
  });
});

describe("exports.markDownloaded + reset", () => {
  it("marks an export as downloaded and it appears in history", async () => {
    const gen = await caller.exports.generate({
      projectName: PROJECT_NAME,
      version: VERSION,
      type: "prisma",
    });
    const exportId = (gen as { id?: string } | undefined)?.id;
    expect(exportId).toBeDefined();

    await caller.exports.markDownloaded({ id: exportId! });

    const history = await caller.exports.list({ projectName: PROJECT_NAME });
    expect(history.some((r) => r.id === exportId)).toBe(true);
  });

  it("reset clears download history", async () => {
    await caller.exports.reset({ projectName: PROJECT_NAME });
    const history = await caller.exports.list({ projectName: PROJECT_NAME });
    expect(history).toHaveLength(0);
  });
});
