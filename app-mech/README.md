# app-mech

TypeScript + Prisma + SQLite project that mirrors the `app.db` schema used by the database schema generator application.

## Quick start

```bash
pnpm install
pnpm db:push       # create/sync the SQLite file from the Prisma schema
pnpm db:generate   # (re)generate the Prisma client
pnpm dev           # run src/index.ts with hot-reload
```

The SQLite file is created at `prisma/dev.db` (configured via `.env` → `DATABASE_URL`).

---

## Database overview

The database is the backbone of a visual Prisma schema designer. Users create **projects**, design **tables** and **fields** inside versioned schema snapshots, define **relations** and **constraints**, then run a **migration workflow** that connects to a live database, collects a data snapshot, validates it, and pushes the new schema.

The 21 tables below are grouped by concern.

---

## Project registry

### `projects`

The top-level record for each schema design project.

| Column | Type | Purpose |
|--------|------|---------|
| `id` | TEXT PK | UUID prefixed with `project-`, generated on creation |
| `name` | TEXT UNIQUE | Human-readable project name (min 8 chars, must be unique) |
| `provider` | TEXT | Target database engine: `Postgres`, `MySQL`, or `SQLite` |
| `schema_options` | TEXT | JSON blob — Prisma client generator and GraphQL integration settings |
| `health` | TEXT | Lifecycle status: `Draft`, `Active`, etc. |
| `tables` | INT | Denormalized count of tables across all versions (for dashboard display) |
| `fields` | INT | Denormalized total field count |
| `relations` | INT | Denormalized total relation count |
| `restrictions` | INT | Denormalized total constraint count |

### `project_versions`

A project can have multiple named schema versions (e.g. `1.0111`, `1.0112`). Versions are immutable once forked — the fork operation copies the canonical store to a new version name.

| Column | Type | Purpose |
|--------|------|---------|
| `id` | UUID PK | Auto-generated UUID |
| `project_id` | UUID FK → projects | Owning project |
| `name` | TEXT | Version identifier, e.g. `1.0111` |
| `created_at` | TEXT | ISO timestamp of when the version was created or forked |
| `sort_order` | INT | Display order; versions are shown oldest-first |

Unique on `(project_id, name)`.

### `model_stores`

A versioned JSON blob that is the canonical representation of the entire schema for one project/version pair. It is the single source of truth that drives Prisma `.prisma` file generation. The normalized tables (`schema_tables`, `schema_fields`, etc.) are derived from and kept in sync with this store.

| Column | Type | Purpose |
|--------|------|---------|
| `id` | UUID PK | Auto-generated UUID |
| `project_id` | UUID FK → projects | Owning project |
| `version` | TEXT | Matches a `project_versions.name` |
| `content` | TEXT | Full canonical schema as JSON (models, fields, relations, etc.) |
| `updated_at` | TEXT | ISO timestamp of last write |

Unique on `(project_id, version)`.

---

## Schema design — tables and fields

### `schema_tables`

Each row is one database table/model inside a specific project version.

| Column | Type | Purpose |
|--------|------|---------|
| `id` | TEXT PK | UUID assigned at creation |
| `model_key` | TEXT | Internal stable key used by older canonical stores; backfilled from `id` for legacy rows |
| `table_id` | TEXT | Cross-version stable identity for a table — survives forks and renames, used to track "same table across versions" during migration diff |
| `project_id` | TEXT FK → projects | Owning project (for efficient project-scoped queries) |
| `version_id` | UUID FK → project_versions | The specific version this table belongs to |
| `name` | TEXT | The model name, e.g. `User` |
| `db_name` | TEXT? | Optional `@@map(...)` override — the actual database table name |
| `comment` | TEXT | Free-text documentation stored in the schema |
| `sort_order` | INT | Display order within the version |
| `created_at` | TEXT | ISO creation timestamp |
| `updated_at` | TEXT | ISO last-modified timestamp |

Unique on `(version_id, name)`.

### `schema_fields`

Each row is one column/field on a `schema_tables` row.

| Column | Type | Purpose |
|--------|------|---------|
| `id` | TEXT PK | UUID assigned at creation |
| `field_key` | TEXT | Internal stable key for older stores; backfilled from `id` |
| `field_id` | TEXT | Cross-version stable identity for a field — used to match fields across versions during migration diff |
| `table_id` | TEXT FK → schema_tables | The table this field belongs to |
| `name` | TEXT | Field name, e.g. `email` |
| `db_name` | TEXT? | Optional `@map(...)` override — the actual column name |
| `logical_type` | TEXT | Storage-agnostic type: `string`, `integer`, `boolean`, `timestamp`, etc. |
| `native_type` | TEXT? | Prisma native type attribute, e.g. `@db.VarChar(255)` |
| `nullable` | BOOL | Whether the field can be `NULL` |
| `is_array` | BOOL | Whether the field is a list type |
| `default_kind` | TEXT | How the default is specified: `none`, `literal`, `function`, `autoincrement`, `cuid`, `uuid`, etc. |
| `default_value` | TEXT | The default value string when `default_kind` is `literal` |
| `default_postgres` | TEXT? | Provider-specific default override for PostgreSQL |
| `default_mysql` | TEXT? | Provider-specific default override for MySQL |
| `default_sqlite` | TEXT? | Provider-specific default override for SQLite |
| `comment` | TEXT | Free-text documentation on the field |
| `is_updated_at` | BOOL | Whether Prisma should apply the `@updatedAt` attribute |
| `sort_order` | INT | Display order within the table |
| `created_at` | TEXT | ISO creation timestamp |
| `updated_at` | TEXT | ISO last-modified timestamp |

Unique on `(table_id, name)`.

---

## Schema design — constraints

### `schema_constraints`

A UNIQUE or INDEX constraint on a table. A constraint can span multiple fields (composite), which is why the fields live in the join table below.

| Column | Type | Purpose |
|--------|------|---------|
| `id` | TEXT PK | UUID assigned at creation |
| `restriction_id` | TEXT | Cross-version stable identity for this constraint |
| `table_id` | TEXT FK → schema_tables | The table the constraint belongs to |
| `type` | TEXT | Constraint kind: `UNIQUE` or `INDEX` |
| `name` | TEXT? | Optional user-defined constraint name, used as `@@unique([..], name: "...")` |
| `db_name` | TEXT? | Optional database-level name override |
| `created_at` | TEXT | ISO creation timestamp |
| `updated_at` | TEXT | ISO last-modified timestamp |

### `schema_constraint_fields`

Join table that maps a constraint to the ordered list of fields it covers.

| Column | Type | Purpose |
|--------|------|---------|
| `constraint_id` | TEXT FK → schema_constraints | The owning constraint |
| `field_id` | TEXT FK → schema_fields | A field included in this constraint |
| `sort_order` | INT | Field position within the composite constraint |

Composite PK on `(constraint_id, field_id)`.

---

## Schema design — relations

### `schema_relations`

A relationship between two tables within a version. Covers all Prisma relation types (one-to-many, many-to-one, one-to-one, many-to-many).

| Column | Type | Purpose |
|--------|------|---------|
| `id` | TEXT PK | UUID assigned at creation |
| `relation_id` | TEXT | Cross-version stable identity for this relation |
| `version_id` | UUID FK → project_versions | The version this relation belongs to |
| `name` | TEXT | Relation name used in `@relation(name: "...")` |
| `source_table_id` | TEXT FK → schema_tables | The table that holds the foreign key column(s) |
| `target_table_id` | TEXT FK → schema_tables | The table being referenced |
| `cardinality` | TEXT | `many-to-one`, `one-to-many`, `one-to-one`, or `many-to-many` |
| `on_delete` | TEXT | Referential action on delete: `Cascade`, `SetNull`, `Restrict`, etc. |
| `on_update` | TEXT | Referential action on update |
| `created_at` | TEXT | ISO creation timestamp |
| `updated_at` | TEXT | ISO last-modified timestamp |

Unique on `(version_id, name)`.

### `schema_relation_fields`

Maps the specific field pairs that form the relation's join condition (`fields: [...]` / `references: [...]` in Prisma).

| Column | Type | Purpose |
|--------|------|---------|
| `relation_id` | TEXT FK → schema_relations | The owning relation |
| `source_field_id` | TEXT FK → schema_fields | The foreign key field on the source table |
| `target_field_id` | TEXT FK → schema_fields | The referenced field on the target table (usually the PK) |
| `sort_order` | INT | Position within a composite FK |

Composite PK on `(relation_id, source_field_id, target_field_id)`.

### `schema_relation_sides`

Describes how each side of a relation presents itself on the model — the virtual Prisma relation field that does not correspond to a real column.

| Column | Type | Purpose |
|--------|------|---------|
| `id` | TEXT PK | UUID assigned at creation |
| `relation_id` | TEXT FK → schema_relations | The owning relation |
| `table_id` | TEXT FK → schema_tables | Which table's model carries this side |
| `field_name` | TEXT | The virtual field name on that model, e.g. `posts` or `author` |
| `is_owner` | BOOL | `true` if this side holds the FK columns (the `@relation(fields: ...)` side) |
| `is_list` | BOOL | Whether the field is a list (`Post[]` vs `Post`) |
| `nullable` | BOOL | Whether the relation field is optional |
| `created_at` | TEXT | ISO creation timestamp |
| `updated_at` | TEXT | ISO last-modified timestamp |

Unique on `(relation_id, table_id, is_owner)` — each relation has exactly one owner side and one back-reference side.

---

## Schema design — enums

### `schema_enums`

An enum type defined within a project version.

| Column | Type | Purpose |
|--------|------|---------|
| `id` | TEXT PK | UUID assigned at creation |
| `version_id` | UUID FK → project_versions | The version this enum belongs to |
| `name` | TEXT | Enum name, e.g. `Role` |
| `db_name` | TEXT? | Optional `@@map(...)` database name |
| `sort_order` | INT | Display order |
| `created_at` | TEXT | ISO creation timestamp |
| `updated_at` | TEXT | ISO last-modified timestamp |

Unique on `(version_id, name)`.

### `schema_enum_values`

Individual members of a `schema_enums` row.

| Column | Type | Purpose |
|--------|------|---------|
| `id` | TEXT PK | UUID assigned at creation |
| `enum_id` | TEXT FK → schema_enums | The owning enum |
| `name` | TEXT | The enum value name, e.g. `ADMIN` |
| `db_name` | TEXT? | Optional `@map(...)` database name |
| `sort_order` | INT | Display order |
| `created_at` | TEXT | ISO creation timestamp |
| `updated_at` | TEXT | ISO last-modified timestamp |

Unique on `(enum_id, name)`.

---

## Field templates

### `field_templates`

Reusable field presets that users can define once and apply when adding fields to any table. Examples: an `id` field pre-configured as `@id @default(cuid())`, or a `createdAt` field with `@default(now())`.

| Column | Type | Purpose |
|--------|------|---------|
| `id` | TEXT PK | UUID assigned at creation |
| `name` | TEXT UNIQUE | Template label shown in the UI |
| `type` | TEXT | Logical field type this template produces |
| `nullable` | BOOL | Default nullability setting |
| `unique_field` | BOOL | Whether to add `@unique` |
| `default_value` | TEXT | Pre-filled default value string |
| `comment` | TEXT | Pre-filled comment |
| `native_attribute` | TEXT? | Pre-filled native type attribute |
| `updated_at_attribute` | BOOL | Whether to pre-apply `@updatedAt` |
| `is_id` | BOOL | Whether to pre-apply `@id` |
| `created_at` | TEXT | ISO creation timestamp |
| `updated_at` | TEXT | ISO last-modified timestamp |

---

## File system tracking

### `fs_paths`

A registry of every on-disk artifact the app has written, indexed by project so files can be found, listed, and relocated when a project is renamed.

File types tracked: `prisma_schema`, `zod_file`, `imported_schema`, `connection_file`, `snapshot_dir`, `migration_log`.

| Column | Type | Purpose |
|--------|------|---------|
| `id` | UUID PK | Auto-generated UUID |
| `project_id` | UUID? FK → projects | Owning project (`NULL` for orphaned imports) |
| `connection_id` | TEXT? | Migration connection UUID this file belongs to, if applicable |
| `version` | TEXT? | Schema version the file was generated for |
| `file_type` | TEXT | Category of the artifact (see types above) |
| `label` | TEXT? | Optional sub-label for distinguishing multiple files of the same type |
| `fs_path` | TEXT UNIQUE | Relative path from project root |
| `created_at` | TEXT | ISO creation timestamp |

---

## UI persistence

### `ui_state`

A simple key-value store for persisting UI state across page reloads. Currently stores two keys:

- `active_project_id` — which project was last selected
- `active_versions_map` — JSON object mapping each project ID to the version the user last viewed

| Column | Type | Purpose |
|--------|------|---------|
| `key` | TEXT PK | State key identifier |
| `value` | TEXT | Serialized value (string or JSON) |
| `updated_at` | TEXT | ISO last-updated timestamp |

---

## Schema artifacts

### `schema_artifacts`

Tracks generated output files (Prisma schema files, Zod validator files) with metadata for integrity checking, cleanup scheduling, and security.

| Column | Type | Purpose |
|--------|------|---------|
| `id` | TEXT PK | UUID assigned at creation |
| `project_id` | TEXT FK → projects | Owning project |
| `version_id` | UUID? FK → project_versions | Specific version this artifact was generated for |
| `type` | TEXT | Artifact category: `prisma_schema`, `zod_file`, etc. |
| `fs_path` | TEXT | Path to the file on disk |
| `content_hash` | TEXT? | SHA hash of file contents for change detection |
| `compressed` | BOOL | Whether the file is stored compressed |
| `encrypted` | BOOL | Whether the file is stored encrypted |
| `temporary` | BOOL | Whether the file should be deleted after use |
| `expires_at` | TEXT? | ISO timestamp after which a temporary artifact may be cleaned up |
| `created_at` | TEXT | ISO creation timestamp |

---

## Migration workflow

The migration workflow is a multi-step pipeline: configure a connection → collect a live data snapshot → compare schema versions → validate data against the target schema → run the push. The four tables below track each stage.

### `migration_connections`

Stores credentials for connecting to a live database. All sensitive fields are encrypted at rest with AES-256-GCM using a per-row randomly generated `secret`. Only the ciphertext is stored.

| Column | Type | Purpose |
|--------|------|---------|
| `id` | TEXT PK | UUID assigned at creation |
| `project_id` | TEXT FK → projects | The project this connection belongs to |
| `name_enc` | TEXT | Encrypted display name for the connection |
| `provider_enc` | TEXT | Encrypted provider string (`postgresql`, `mysql`, etc.) |
| `host_enc` | TEXT | Encrypted database host |
| `port_enc` | TEXT | Encrypted port number |
| `database_enc` | TEXT | Encrypted database name |
| `user_enc` | TEXT | Encrypted database username |
| `password_enc` | TEXT | Encrypted database password |
| `secret` | TEXT | Per-row AES key used to encrypt/decrypt the fields above |
| `created_at` | TEXT | ISO creation timestamp |
| `last_used_at` | TEXT | ISO timestamp of the most recent connection use |

### `migration_snapshots`

A point-in-time data snapshot collected from a live database via the "Collect" step of the migration workflow. Contains metadata about which tables were found and how many rows each had — the actual row data is written to disk and tracked via `fs_paths`.

| Column | Type | Purpose |
|--------|------|---------|
| `id` | TEXT PK | UUID assigned at snapshot time |
| `project_id` | TEXT FK → projects | Owning project |
| `connection_id` | TEXT | The connection used to collect the snapshot |
| `from_version` | TEXT | The source schema version being migrated from |
| `to_version` | TEXT | The target schema version being migrated to |
| `folder_path` | TEXT UNIQUE | Absolute path to the directory where row data JSON files are stored |
| `table_count` | INT | Number of tables found in the live database |
| `row_count` | INT | Total rows collected across all tables |
| `tables_json` | TEXT | JSON array of `{ name, count }` objects — per-table row counts |
| `collected_at` | TEXT | ISO timestamp when the snapshot was taken |

### `migration_workflow_state`

One row per project tracking where that project currently is in the migration workflow. Acts as a state machine — each step (Zod generation, schema check, data validation, run) is recorded here so the UI can resume from the correct step after a page reload.

| Column | Type | Purpose |
|--------|------|---------|
| `project_id` | TEXT PK FK → projects | One row per project |
| `connection_id` | TEXT? | The selected migration connection UUID |
| `sync_version` | TEXT? | The "from" schema version (the current live DB schema) |
| `target_version` | TEXT? | The "to" schema version (the desired new schema) |
| `data_timestamp` | TEXT? | ISO timestamp of the data snapshot being used for validation |
| `snapshot_id` | TEXT? FK → migration_snapshots | The active snapshot record |
| `zod_generated` | BOOL | Whether Zod validators have been generated for the target version |
| `schema_check_passed` | BOOL | Whether the pre-flight schema compatibility check passed |
| `validation_passed` | BOOL | Whether data validation against the target schema passed |
| `run_log_path` | TEXT? | Path to the JSON log file written after the last migration run |
| `updated_at` | TEXT | ISO timestamp of the last state change |

### `migration_sessions`

A complete audit log of every migration execution attempt. One row per unique `(project, from_version, to_version, connection)` combination, updated in place as the workflow progresses.

| Column | Type | Purpose |
|--------|------|---------|
| `id` | TEXT PK | UUID assigned at session creation |
| `project_id` | TEXT FK → projects | Owning project |
| `connection_id` | TEXT | The connection used |
| `from_version` | TEXT | Source schema version |
| `to_version` | TEXT | Target schema version |
| `snapshot_id` | TEXT? FK → migration_snapshots | Snapshot used during this session |
| `collect_timestamp` | TEXT? | When the data collection step completed |
| `collect_table_count` | INT? | Number of tables collected |
| `collect_row_count` | INT? | Total rows collected |
| `collect_tables_json` | TEXT? | JSON array of per-table `{ name, count }` from the collect step |
| `run_status` | TEXT? | Final run outcome: `success`, `error`, etc. |
| `run_log_path` | TEXT? | Path to the run log JSON file on disk |
| `run_tables_json` | TEXT? | JSON array of per-table `{ name, created, updated, errors }` from the run step |
| `run_error` | TEXT? | Error message if the run failed |
| `created_at` | TEXT | ISO creation timestamp |
| `updated_at` | TEXT | ISO last-modified timestamp |

Unique on `(project_id, from_version, to_version, connection_id)`.

---

## Schema imports

### `schema_imports`

A log of externally uploaded `.prisma` files that were ingested into the application via the Imports workflow. Records are created when a file is matched to a project and synced.

| Column | Type | Purpose |
|--------|------|---------|
| `id` | UUID PK | Auto-generated UUID |
| `project_id` | UUID? FK → projects | Project the file was matched to (`NULL` if unmatched) |
| `version` | TEXT? | Schema version the import was synced into |
| `source_file` | TEXT | Original filename or path of the imported `.prisma` file |
| `imported_at` | TEXT | ISO timestamp of when the import was processed |
