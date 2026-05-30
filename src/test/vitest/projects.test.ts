import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { caller, DEFAULT_SCHEMA_OPTIONS } from "./helpers";

const PROJECT_NAME = "Test Projects Alpha";
let projectId: string;

beforeAll(async () => {
  const project = await caller.projects.create({
    name: PROJECT_NAME,
    provider: "Postgres",
    schemaOptions: DEFAULT_SCHEMA_OPTIONS,
  });
  projectId = project.id;
});

afterAll(async () => {
  if (projectId) await caller.projects.delete({ id: projectId });
});

describe("projects.list", () => {
  it("returns the created project", async () => {
    const projects = await caller.projects.list();
    const found = projects.find((p) => p.id === projectId);
    expect(found).toBeDefined();
    expect(found?.name).toBe(PROJECT_NAME);
  });
});

describe("projects.create", () => {
  it("rejects a name shorter than 8 characters", async () => {
    await expect(
      caller.projects.create({
        name: "Short",
        provider: "Postgres",
        schemaOptions: DEFAULT_SCHEMA_OPTIONS,
      }),
    ).rejects.toThrow();
  });

  it("rejects duplicate names", async () => {
    await expect(
      caller.projects.create({
        name: PROJECT_NAME,
        provider: "Postgres",
        schemaOptions: DEFAULT_SCHEMA_OPTIONS,
      }),
    ).rejects.toThrow();
  });

  it("creates with each provider", async () => {
    const ids: string[] = [];
    for (const provider of ["MySQL", "SQLite"] as const) {
      const p = await caller.projects.create({
        name: `Provider Test ${provider}`,
        provider,
        schemaOptions: DEFAULT_SCHEMA_OPTIONS,
      });
      expect(p.provider).toBe(provider);
      ids.push(p.id);
    }
    for (const id of ids) await caller.projects.delete({ id });
  });
});

describe("projects.update", () => {
  it("renames the project", async () => {
    const updated = await caller.projects.update({
      id: projectId,
      name: "Test Projects Renamed",
      provider: "Postgres",
      schemaOptions: DEFAULT_SCHEMA_OPTIONS,
    });
    const renamed = updated.find((p) => p.id === projectId);
    expect(renamed?.name).toBe("Test Projects Renamed");
    // rename back so afterAll cleanup works
    await caller.projects.update({
      id: projectId,
      name: PROJECT_NAME,
      provider: "Postgres",
      schemaOptions: DEFAULT_SCHEMA_OPTIONS,
    });
  });
});

describe("projects.forkVersion", () => {
  it("creates a new version on the project", async () => {
    const result = await caller.projects.forkVersion({ projectId });
    const projects = await caller.projects.list();
    const p = projects.find((x) => x.id === projectId);
    expect(p?.versions.length).toBeGreaterThanOrEqual(2);
    expect(result.newVersion).toBeDefined();
  });
});
