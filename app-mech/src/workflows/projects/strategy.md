# Projects Workflow — Strategy

## Overview

The projects workflow is the entry point for the entire app. Every other workflow
is scoped to `(projectId, version)`. This file maps out what functions to build,
what side effects each one owns, and which parts need mocking so the workflow can
be exercised in isolation.

This layer is **database-only**. We no longer generate Prisma schema files, Zod
validators, or write any artifacts to disk. There is no `schemas/`, `zod/`, or
`migrations/` directory involvement at this layer. All state lives in SQLite.

---

## Operations

### 1. `listProjects`

Read all project rows, join their `project_versions`, and return a flat list
sorted by insertion order.

**Reads:** `projects` + `project_versions`  
**Side effects:** none  
**Returns:** `Project[]` — id, name, provider, schemaOptions, health, counts, versions

---

### 2. `createProject`

Atomic creation of a project and its initial state. All writes happen inside a
single Prisma transaction. No disk I/O.

**Writes (inside one transaction):**
1. Insert `projects` row — id prefixed `project-<uuid>`, health `Draft`, all counts zero
2. Insert `project_versions` row for the default version (`1.0111`, sort_order `0`)
3. Insert `model_stores` row — empty canonical schema JSON for that version

**No side effects.** No `.prisma` file is generated. No `fs_paths` entry is recorded.

**Validations (before writing):**
- `name.trim().length >= 8`
- `name` must be unique (case-insensitive)
- `provider` must be one of `Postgres | MySQL | SQLite`
- `schemaOptions.client` must be a known Prisma client value
- `schemaOptions.graphql` must be a known GraphQL option value

**Returns:** the created `Project` with its first version attached

---

### 3. `updateProject`

Update metadata on an existing project. No disk operations. Stats are
re-aggregated by querying the database directly.

**Writes:**
1. Update `projects` row — `name`, `provider`, `schema_options`
2. If `provider` changed: iterate every `model_stores.content` JSON blob for this
   project and apply provider-specific field rules:
   - **PostgreSQL:** `@id` fields get `@default(uuid())` or `@default(cuid())` rules;
     timestamp fields get `@default(now())`; serial/autoincrement becomes `uuid()`
   - The `provider` string inside each JSON blob is updated to the new value
3. Re-aggregate stats by counting rows in `schema_tables`, `schema_fields`,
   `schema_relations`, and `schema_constraints` across all versions, then write the
   totals back to the `projects` row (`tables`, `fields`, `relations`, `restrictions`)

**No disk operations.** No directory rename. No `fs_paths` update.

**Validations:**
- Project with `id` must exist
- New `name.trim().length >= 8`
- New `name` must not collide with another project (exclude self)
- `provider`, `client`, `graphql` same enum checks as create

**Returns:** updated full `Project[]` list

---

### 4. `deleteProject`

Delete the project row. SQLite CASCADE constraints automatically delete all child
rows across every dependent table. No special cleanup code needed, no disk I/O.

**What CASCADE removes automatically:**
- `project_versions`
- `model_stores`
- `schema_tables`
- `schema_fields`
- `schema_constraints`
- `schema_constraint_fields`
- `schema_relations`
- `schema_relation_fields`
- `schema_relation_sides`
- `schema_enums`
- `schema_enum_values`
- `migration_connections`
- `migration_snapshots`
- `migration_sessions`
- `migration_workflow_state`
- `schema_artifacts`
- `fs_paths`

**No disk side effects.** The single `prisma.project.delete({ where: { id } })`
call is the entire implementation.

**Validations:** none — if the id does not exist, Prisma throws and the caller
decides whether to swallow it.

**Returns:** updated `Project[]` list after deletion

---

### 5. `forkProjectVersion`

Copy the latest version of a project into a new version with an incremented
version name, then copy all normalized schema rows into the new version.
This is the most critical operation in the workflow.

**Version naming:**
- `incrementVersion("1.0111") → "1.0112"` (minor segment, zero-padded to same width)
- `incrementVersion("1.0009") → "1.0010"` (carries zero padding)

**Schema consideration — major/minor integer fields:**  
The current `project_versions.name` is a TEXT column storing e.g. `"1.0111"`.
We should add `major INT` and `minor INT` columns to `project_versions` so that
incrementing is a pure integer operation and sorting is unambiguous. The display
string `name` is then derived as `${major}.${minor.toString().padStart(4, "0")}`.
This must be reflected in both the Prisma schema and handler before implementing
`forkProjectVersion`.

**Cross-version field identity (matching rules):**  
Each schema entity carries a stable cross-version ID alongside its row `id`:
- `schema_tables.table_id` — stable across versions
- `schema_fields.field_id` — stable across versions
- `schema_relations.relation_id` — stable across versions
- `schema_constraints.restriction_id` — stable across versions

When forking, new rows are created with fresh `id` UUIDs but the **same stable
IDs** are carried over. This is what lets the migration diff (`compare` step) know
that a table in version A is the same logical table as one in version B even after
a rename.

**Writes (in order):**
1. Insert `project_versions` row — new version name, next `sort_order`
2. Copy `model_stores.content` JSON into a new `model_stores` row; update the
   `projectVersion` key inside the JSON to the new version name
3. Copy all `schema_tables` rows for the source version, assigning fresh `id`
   values but preserving `table_id`, field values, and setting `version_id` to
   the new version's id
4. For each copied table, copy its `schema_fields` rows — fresh `id`, same `field_id`
5. Copy `schema_constraints` rows — fresh `id`, same `restriction_id`
6. Copy `schema_constraint_fields` rows — re-mapped to new constraint/field ids
7. Copy `schema_relations` rows — fresh `id`, same `relation_id`, re-mapped table ids
8. Copy `schema_relation_fields` rows — re-mapped to new relation/field ids
9. Copy `schema_relation_sides` rows — re-mapped to new relation/table ids
10. Copy `schema_enums` rows — fresh `id`, re-mapped version id
11. Copy `schema_enum_values` rows — re-mapped to new enum ids

All of the above runs inside a single Prisma transaction.

**Validations:**
- Project must exist
- Project must have at least one version to fork from
- The computed new version name must not already exist on that project

**Returns:** `{ projects: Project[]; project: Project; newVersion: string }`

---

## Files to create

```
src/workflows/projects/
  strategy.md          ← this file
  types.ts             ← Project, SchemaOptions, ProjectVersion, ProjectWithVersions types
  constants.ts         ← providers, prismaClients, graphqlOptions, defaultSchemaOptions, DEFAULT_VERSION
  helpers.ts           ← incrementVersion, normalizeSchemaOptions, applyProviderRules (pure, no imports)
  workflow.ts          ← listProjects, createProject, updateProject, deleteProject, forkProjectVersion
  mocks.ts             ← fixture builders: makeProject, makeVersion, makeModelStore
  workflow.test.ts     ← integration tests against a real Prisma in-memory db
```

---

## What to mock vs. what to use real

Since there are **no disk operations at this layer**, there is nothing to mock.
All tests run against a real Prisma client pointed at `:memory:` SQLite and
migrated with `prisma migrate` or `db push` at test setup time.

| Concern | Approach |
|---|---|
| SQLite reads/writes | **Real** — in-memory Prisma client, schema pushed before each suite |
| `model_stores` content JSON | **Real** — insert via handler, assert content directly |
| Provider rule propagation in JSON | **Real** — run `updateProject`, query `model_stores`, parse and assert |
| Version increment math | **Unit-tested in `helpers.test.ts`** — pure function, no db |
| Cross-version row copy in fork | **Real** — run `forkProjectVersion`, query all schema tables, assert counts and stable IDs match |

No `deps` injection pattern is needed because there is no I/O boundary to cross.

---

## Test scenarios

### `listProjects`
- Returns `[]` when no projects exist
- Returns projects in insertion order with versions joined and sorted by `sort_order`

### `createProject`
- Happy path: inserts project + version + model store, returns the new project with `versions[0].name === "1.0111"`
- Rejects name shorter than 8 chars
- Rejects duplicate name (case-insensitive)
- Rejects unknown provider
- Rejects unknown client
- Rejects unknown graphql option
- No `fs_paths` entry is created

### `updateProject`
- Happy path: updates name, provider, schemaOptions; returns full project list
- Provider change propagates into every `model_stores.content` JSON blob for all versions
- PostgreSQL rules are applied when switching to `Postgres` provider
- Rejects unknown project id
- Rejects name < 8 chars
- Rejects name collision with another project
- Stats (`tables`, `fields`, `relations`, `restrictions`) are recounted from DB rows after update

### `deleteProject`
- Happy path: project row deleted, all child rows gone via CASCADE, returns remaining list
- Deleting a non-existent id: caller receives the Prisma error (not swallowed at this layer)

### `forkProjectVersion`
- Happy path: new version inserted, `model_stores` row cloned with updated `projectVersion` key,
  all `schema_tables` / `schema_fields` / etc. copied with fresh ids but same stable cross-version ids
- Increments version string correctly (`1.0111 → 1.0112`, `1.0009 → 1.0010`)
- Table count in forked version matches source version
- Field count per table matches source version
- `table_id` values in forked tables match those in source tables
- `field_id` values in forked fields match those in source fields
- Throws when project not found
- Throws when project has no versions
- Throws when computed new version already exists

---

## Function signatures

```typescript
// workflow.ts

export async function listProjects(): Promise<Project[]>

export async function createProject(
  input: CreateProjectInput,
): Promise<Project>

export async function updateProject(
  id: string,
  input: UpdateProjectInput,
): Promise<Project[]>

export async function deleteProject(
  id: string,
): Promise<Project[]>

export async function forkProjectVersion(
  projectId: string,
): Promise<{ projects: Project[]; project: Project; newVersion: string }>
```

Input types come from `../../actions/1-projects/schemas.ts` (Zod, already written)
and `../../actions/2-project-versions/schemas.ts`.

---

## Dependency graph

```
workflow.ts
  └── prisma              (../../lib/prisma)
  └── 1-projects/handler  (listProjects, getProject, createProject, updateProject, deleteProject)
  └── 2-project-versions/handler
  └── 3-model-stores/handler
  └── helpers.ts          (pure functions — incrementVersion, normalizeSchemaOptions, applyProviderRules)
  └── constants.ts        (no imports)
```

No circular dependencies. No I/O outside of Prisma.
