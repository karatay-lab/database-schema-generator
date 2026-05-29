import { describe, it, expect, afterAll } from "vitest";
import { caller, DEFAULT_SCHEMA_OPTIONS } from "./helpers";

const SOURCE_PROJECT = "Import Source Alpha";
const VERSION = "1.0111";

let sourceProjectId: string;
let importedVersionProjectId: string;
let importedProjectProjectId: string;

const setupSourceProject = async () => {
  if (sourceProjectId) return;
  const p = await caller.projects.create({
    name: SOURCE_PROJECT,
    provider: "Postgres",
    schemaOptions: DEFAULT_SCHEMA_OPTIONS,
  });
  sourceProjectId = p.id;
  await caller.tables.create({
    projectName: SOURCE_PROJECT,
    version: VERSION,
    modelName: "Order",
    pkName: "id",
    pkType: "Int",
  });
  await caller.fields.create({
    projectName: SOURCE_PROJECT,
    version: VERSION,
    modelName: "Order",
    name: "total",
    type: "Float",
    nullable: false,
    unique: false,
    defaultValue: "",
    comment: "",
    updatedAtAttribute: false,
    isId: false,
  });
};

afterAll(async () => {
  const ids = [sourceProjectId, importedVersionProjectId, importedProjectProjectId].filter(Boolean);
  for (const id of ids) {
    try { await caller.projects.delete({ id }); } catch { /* best-effort cleanup */ }
  }
});

describe("imports — version pickle round-trip", () => {
  it("exports a version pickle and re-imports it as a new project", async () => {
    await setupSourceProject();

    const exported = await caller.exports.generate({
      projectName: SOURCE_PROJECT,
      version: VERSION,
      type: "pickle-version",
    });
    expect(exported?.code).toBeDefined();

    const result = await caller.imports.importVersion({
      content: exported!.code!,
      projectName: "Imported Version Beta",
    });

    expect(result?.projectId).toBeDefined();
    importedVersionProjectId = result!.projectId;
    expect(result?.versionName).toBeDefined();
    expect(result?.stats.tableCount).toBeGreaterThanOrEqual(1);
    expect(result?.stats.fieldCount).toBeGreaterThanOrEqual(1);
  });

  it("imported project appears in project list", async () => {
    const projects = await caller.projects.list();
    expect(projects.some((p) => p.id === importedVersionProjectId)).toBe(true);
  });

  it("imported project tables are queryable", async () => {
    const projects = await caller.projects.list();
    const imported = projects.find((p) => p.id === importedVersionProjectId);
    expect(imported).toBeDefined();

    const versionName = imported!.versions[0]?.name;
    expect(versionName).toBeDefined();

    const schema = await caller.tables.list({
      projectName: imported!.name,
      version: versionName!,
    });
    expect(schema?.some((m) => m.name === "Order")).toBe(true);
  });
});

describe("imports — project pickle round-trip", () => {
  it("exports a project pickle and re-imports it as a new project", async () => {
    await setupSourceProject();

    const exported = await caller.exports.generate({
      projectName: SOURCE_PROJECT,
      version: VERSION,
      type: "pickle-project",
    });
    expect(exported?.code).toBeDefined();

    const result = await caller.imports.importProject({
      content: exported!.code!,
      projectName: "Imported Project Gamma",
    });

    expect(result?.projectId).toBeDefined();
    importedProjectProjectId = result!.projectId;
    expect(result?.versionCount).toBeGreaterThanOrEqual(1);
  });
});

describe("imports.parse", () => {
  it("parses a version pickle without importing", async () => {
    await setupSourceProject();

    const exported = await caller.exports.generate({
      projectName: SOURCE_PROJECT,
      version: VERSION,
      type: "pickle-version",
    });

    const summary = await caller.imports.parse({ content: exported!.code! });
    expect(summary?.type).toBe("version");
    expect(summary?.sourceProjectName).toBe(SOURCE_PROJECT);
    expect(summary?.versionCount).toBe(1);
  });

  it("rejects invalid JSON", async () => {
    await expect(
      caller.imports.parse({ content: "not json at all" }),
    ).rejects.toThrow();
  });

  it("rejects wrong pickle version", async () => {
    const bad = JSON.stringify({ pickleVersion: 99, type: "version", project: {}, version: {} });
    await expect(
      caller.imports.parse({ content: bad }),
    ).rejects.toThrow();
  });
});
