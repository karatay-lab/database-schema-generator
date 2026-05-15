# Project Understanding

## What This Project Is

`database-schema-generator` is a local-first database schema studio built with
Next.js App Router. It lets a user create projects, design database models,
edit fields, define relations and restrictions, generate Prisma/Zod/Drizzle
artifacts, import existing Prisma schemas, run local SQLite query sandboxes, and
prepare migration workflows against live databases.

The application is not just a static schema generator. It has a persistent
workspace under `src/database/`, a dashboard UI, API routes for schema
operations, and a central schema engine that keeps canonical model state and
generated Prisma files synchronized.

## Current Stack

- Next.js 16 App Router with React 19 and TypeScript.
- Tailwind CSS v4 for styling.
- `pnpm` for package management.
- `better-sqlite3` for local app persistence in `src/database/app.db`.
- `@mrleebo/prisma-ast` for parsing and producing Prisma schema structures.
- Prisma CLI for `format`, `validate`, introspection, and `db push` workflows.
- `zod` for generated validation schemas and migration validation.
- `pg` and `better-sqlite3` for migration/query execution against PostgreSQL
  and SQLite.

There is no configured test runner at the moment. The available scripts are:

```bash
pnpm dev
pnpm build
pnpm start
pnpm lint
```

## Application Shape

The actual current route tree uses top-level workflow routes:

- `/` redirects to `/tables` when at least one project exists.
- `/` shows a first-project creation screen when there are no projects.
- Workflow routes live under `src/app/(workflows)/`.
- UI logic lives under `src/app/views/<workflow>/`.
- API routes live under `src/app/api/`.

The primary workflow pages are:

- `Projects`
- `Tables`
- `Schema`
- `Relations`
- `Restrictions`
- `Validation`
- `Exports`
- `Imports`
- `SQL Query`
- `Commentary`
- `Migrations`
- `History`

Some older documentation refers to project-scoped URLs like
`/{projectId}/{workflow}` and to Drizzle-managed app tables. The code currently
uses top-level workflow URLs and creates its app SQLite tables directly through
`better-sqlite3` in `src/lib/db/client.ts`.

## Dashboard Architecture

The shared workflow layout is `src/app/(workflows)/layout.tsx`. It reads
projects from the local store, reads persisted UI state, and mounts:

- `DashboardProvider` from `src/app/views/shared/dashboard-context.tsx`
- `DashboardShell` from `src/app/views/shared/dashboard-shell.tsx`

`DashboardProvider` owns client-side active project state, selected schema
version state, project CRUD calls, and version forking calls.

`DashboardShell` renders the left navigation, active project/session summary,
schema stats, and the header actions. It also exposes a schema test action that
calls `/api/schema-test` and displays Prisma format/validate output.

`ProjectInfoProvider` gives workflow pages a smaller, flatter context:
project id, project name, selected version, all versions, provider, and whether
there is an active project.

## Persistence Model

The local database is `src/database/app.db`. It is opened as a singleton in
`src/lib/db/client.ts`, with WAL mode and foreign keys enabled.

Current SQLite tables are:

- `projects`: project registry and aggregate stats.
- `project_versions`: version names per project.
- `model_stores`: canonical model JSON per project/version.
- `field_templates`: reusable field definitions.
- `fs_paths`: registered generated/imported artifact paths.
- `ui_state`: active project and selected version persistence.
- `migration_workflow_state`: saved migration workflow progress.

Generated or operational files live in:

- `src/database/schemas/{project}/{version}.prisma`
- `src/database/models/{project}/{version}-models.json`
- `src/database/zod/{project}/{version}/{model}.ts`
- `src/database/databases/{project}/{version}.db`
- `src/database/migrations/{project}/...`
- `src/database/schemas/imported/...`

The SQLite `model_stores` table is the important source of truth for schema
models. The JSON files under `src/database/models/` are still part of the
artifact layout but the active store code reads and writes through SQLite.

## Core Schema Engine

`src/lib/schema-store.ts` is the central engine of the application. It is the
largest and most important file in the project.

It manages three schema representations:

- Canonical store: local JSON-like model format with stable UUID keys, logical
  field types, comments, constraints, relations, restrictions, and enums.
- Prisma AST: parsed and produced through `@mrleebo/prisma-ast`.
- UI/API types: `PrismaModel`, `PrismaField`, `PrismaRelation`,
  `PrismaRestriction`, and related response shapes.

The engine can:

- Initialize empty model stores for a project/version.
- Read and write canonical model state.
- Generate Prisma schema files from canonical state plus project prelude.
- Parse existing Prisma files into canonical state.
- Add and update models.
- Add, update, delete, and comment fields.
- Add, update, and delete bidirectional relations.
- Add, update, and delete unique/index restrictions.
- Generate schema stats.
- Generate SQLite-compatible Prisma schemas for the SQL Query sandbox.
- Run Prisma `format` and `validate` against temporary schema files.

The important convention is that schema files should be produced from the
canonical model store and Prisma AST helpers, not hand-built ad hoc.

## Project Management

`src/lib/projects-store.ts` owns project CRUD and version management.

A project has:

- id
- name
- provider: `Postgres`, `MySQL`, or `SQLite`
- Prisma client option
- GraphQL option
- health/status fields
- aggregate schema stats
- versions

Project creation validates provider/options, creates the first version
`1.0111`, writes the initial Prisma schema, initializes an empty model store,
and registers the schema path. Project names must be at least 8 characters and
unique.

Version forking increments the latest version string, copies the canonical
model store, writes a generated Prisma schema, and adds a `project_versions`
row.

Project rename/update rewrites provider/schema prelude information, moves
project artifact directories where needed, and refreshes aggregate stats.

## Workflow Pages

`Projects` is the project control room. It creates, edits, selects, deletes,
and forks project versions.

`Tables` manages model/table records. It creates models with primary key
settings and updates model names and primary key fields.

`Schema` manages fields and field templates. It supports field creation,
editing, deletion, native attributes, defaults, comments, ID fields, uniqueness,
and applying saved templates.

`Relations` manages Prisma-style relation fields plus back-reference fields.
The store tries to keep both sides synchronized and avoid invalid duplicate
relation field names.

`Restrictions` manages model-level unique and index constraints.

`Validation` lets the user inspect fields and generate Zod validators for
selected fields.

`Exports` can return Prisma schema content or generated Drizzle schema code.
Drizzle output is generated by `/api/exports` from the canonical store.

`Imports` lets users upload external `.prisma` files, view imported/project
schema groups, match an imported schema to a new or existing project, and sync
the Prisma content into canonical model state.

`SQL Query` creates a local SQLite database for a selected project/version,
generates starter SQL, executes read and mutation SQL through `better-sqlite3`,
and returns tabular results.

`Commentary` batch-edits Prisma triple-slash style field comments.

`Migrations` is a larger live-database workflow. It can connect to a database,
store encrypted connection records, introspect schemas, collect source rows,
compare model versions by stable UUID keys, generate Zod validators, validate
data in stages, push a target schema, and write migration logs.

`History` shows versions for the active project with per-version schema stats.

## API Surface

The API routes are mostly thin adapters over the store layer:

- `/api/projects`: project CRUD.
- `/api/projects/version`: fork a project version.
- `/api/tables`: model/table list, create, update.
- `/api/schema-fields`: field CRUD.
- `/api/schema-relations`: relation CRUD.
- `/api/schema-restrictions`: unique/index restriction CRUD.
- `/api/field-templates`: reusable field template CRUD.
- `/api/schema-stats`: counts tables, fields, relations, restrictions.
- `/api/schema-test`: Prisma format and validate.
- `/api/schema-validation/generate`: generate Zod files.
- `/api/schema-imports`, `/match`, `/sync`: upload, match, and sync Prisma
  imports.
- `/api/exports`: Prisma and Drizzle export output.
- `/api/sql-query/status`, `/migrate`, `/execute`: local SQLite query sandbox.
- `/api/commentary`: batch field comment updates.
- `/api/history`: version history and stats.
- `/api/ui-state`: active project/version persistence.
- `/api/migration-state`: saved migration workflow state.
- `/api/migrations/*`: connection, collection, comparison, schema check,
  validation, new-schema push, migration run, connection listing/deletion, and
  Zod pair generation.

## Migration Workflow

Migration-related code lives mainly in:

- `src/app/views/migrations/migrations-page.tsx`
- `src/app/views/migrations/model-diff.tsx`
- `src/app/api/migrations/*`
- `src/lib/migration-crypto.ts`
- `src/lib/db/migration-state.ts`

The workflow supports two broad paths:

- New migration: connect to an empty target and push the selected schema.
- Version migration: connect, compare source/target model versions, generate
  validators, collect source data, validate rows, reset/push target schema, and
  upsert migrated rows.

Connection secrets are encrypted with AES-256-GCM before storage. Collected
data, connection files, and migration logs are written under
`src/database/migrations/{project}/`.

## Important Conventions

- Keep route files thin and put page logic in `src/app/views/<workflow>/`.
- Use `useProjectInfo()` inside workflow pages when only active project data is
  needed.
- Preserve stable model and field UUID keys because migration comparison relies
  on them to detect renames and changed fields.
- Do not auto-populate mock projects when stores are empty.
- Use Prisma AST helpers for Prisma schema transformation.
- Keep generated artifacts under `src/database/` grouped by project slug and
  version.
- Update `docs/mapping.md` when documentation/source files are created or
  updated, following the repository's mapping contract.

## Current Gaps And Notes

- No automated test runner is configured.
- The README still describes the project as documentation-first, but the app is
  now substantially implemented.
- Some planning docs are older than the current implementation.
- `CLAUDE.md` mentions Drizzle app-table definitions and project-scoped routes;
  the current code uses direct `better-sqlite3` table creation and top-level
  workflow routes.
- The local `src/database/` folder contains generated and operational state,
  including SQLite databases and migration snapshots, so it is part source,
  part runtime workspace.

# About this project

Okey, I have used and test the logic we need to totally change structure to something else.
Prisma schema must NOT be created immediately any table is created.
It must be generated from model that resides in app.db
When table name or field name changes if any relation is built on it prisma confuses names also unable to display relations
I have encountered with issues like this so I am changing logic completley
Give me a solid plan to update all project:
We already have a app.db structure which produces content json,
Here is a example for you to start with:
/home/berkay-server/repos/projects/database-schema-generator/example.json
This is how we store but we need a solid database structure to build not a json
{
"key": "f458227b-e1d1-4f23-bcd1-e13a2cf396bc",
"name": "uuid",
"type": "integer",
"nullable": false,
"default": "autoincrement()",
"comment": "",
"constraints": [
{
"type": "PK"
}
],
"array": false
},

## First Objective

default values changes due to database type like postgres, mysql, sqlite all defaults are different so we need to
first do a research for pk defaults for each database what rules they have for default input and
what kind of commentary rules they have

## Second Objective

I dont want user to modify schemas directly on filesystem
So we will build a solid database schema for app.db that wont be using json storage but do
Have solid database structuce
tables -> projectID
fields -> tableID
relations -> fieldID & tableID

So that instead having a complicated example.json
Reasoning: table / field names can change
lets say I have did a one-2-one relation from user table to people table
then I have decided to change user table name to profile
Beacuse that exiting content field in app.db is storing it as a json here is what happens

{
"key": "25ff491e-5291-443d-9226-57d5fe01d3bd",
"name": "people",  
 "type": "people", /// table name here stored staticly not bind throu a uuid
"nullable": true,
"default": "",
"comment": "",
"constraints": [],
"array": false,
"relation": {
"name": "users_people_rl",
"fields": [
"people_one_id" /// field name here stored staticly not bind throu a uuid
],
"references": [
"uuid"
],
"onDelete": "Cascade",
"onUpdate": ""
}
}
but if we do this on an SQL table with joined relation I can populate schema.prisma
by simply reading related projectID tables in database and create it immediately

## Third Objective

Becuase that migrations are done through prisma if anything fails or done wrong at schema.prisma in /database/schemas folder
whole migrations gets stuck and because that user wont able to directly modify/fix schemas
migration fails

So we need to create validators, migration all fails.

What I want is simply dont use prisma to do any actions on table creation, field and relation creation
but use prisma.schema and drizzle as an export result like we did in workflow /exports

Beacuse that we will have all project-version info at database level we will be just producing schemas from db.

ProjectID-VersionID will be a super key to store any file we need to store at /home/berkay-server/repos/projects/database-schema-generator/src/database
we can just use those folders to create ProjectID-VersionID-timestamp file temporarly after actions they can be removed or encrypted compressed

Give me a solid plan to change everything.
