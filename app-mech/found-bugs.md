# Found Bugs

---

## BUG-001 — Prisma provider not normalized in renderer

**File:** `src/workflows/exports/prisma-renderer.ts`  
**Status:** Fixed

**Description:**  
The exported `.prisma` schema had `provider = "Postgres"` and `provider = "MySQL"` (capitalized as stored in the DB). Prisma CLI 6.x only accepts lowercase provider names (`"postgresql"`, `"mysql"`, `"sqlite"`), causing a `P1012` validation error on `prisma db push`.

**Error:**
```
Error: Datasource provider not known: "Postgres".
```

**Fix:**  
Added `normalizeProvider()` in `prisma-renderer.ts` that lowercases and maps known variants (`"Postgres"` → `"postgresql"`, `"MySQL"` → `"mysql"`, etc.) before writing the `datasource` block.

---

## BUG-002 — `@db.TinyInt(1)` rejected by Prisma MySQL

**File:** `src/workflows/exports/prisma-renderer.ts`  
**Status:** Fixed

**Description:**  
MySQL's `TinyInt` native type in Prisma takes 0 arguments. The stored native type value `@db.TinyInt(1)` (MySQL's historical display-width notation) was passed through verbatim, causing a `P1012` validation error.

**Error:**
```
error: Function "TinyInt" takes 0 arguments, but received 1.
```

**Fix:**  
Added `ZERO_ARG_NATIVE_TYPES` set in `prisma-renderer.ts` listing all Prisma native types that take no arguments. `nativeAttribute()` skips args for types in that set.

---

## BUG-003 — Self-referential relation renders only one side

**File:** `src/workflows/exports/prisma-renderer.ts`  
**Status:** Fixed

**Description:**  
Self-referential relations (e.g. `Category → Category` for parent/children) require both the owner side and the back-reference side to be present in the same model block. The renderer used `Array.find()` to locate the relation side for the current table, which returned only the first match. For self-relations both sides share the same `tableId`, so the `children` back-reference was never emitted.

**Error:**
```
error: The relation field `parent` on model `Category` is missing an opposite relation field on the model `Category`.
```

**Fix:**  
Changed `relation.sides.find(...)` to `relation.sides.filter(...)` and iterate all matching sides, so both `parent` and `children` are rendered for self-relations.

---

## BUG-004 — `@default(uuid())` dropped when `defaultValue` is empty

**File:** `src/workflows/exports/prisma-renderer.ts`  
**Status:** Fixed

**Description:**  
`defaultAttribute()` had an early-return guard `if (!value) return ""` that fired before checking `defaultKind`. For MySQL UUID PKs, `defaultKind = "uuid"` but `defaultValue = ""` and `defaultMysql` is unset — so the guard silently dropped the default, leaving `id String @id @db.Char(36)` with no `@default(uuid())`.

**Fix:**  
Moved value-independent kinds (`autoincrement`, `cuid`, `now`, `uuid`) above the `!value` guard so they always emit their default regardless of whether a stored value string exists.

---

## BUG-005 — Provider not normalized in `fieldLine` call; DB-level defaults dropped for PostgreSQL PKs

**File:** `src/workflows/exports/prisma-renderer.ts`  
**Status:** Fixed

**Description:**  
Two related issues:

1. `renderPrismaSchemaFromGraph` passed `graph.project.provider` (raw value, e.g. `"Postgres"`) directly to `fieldLine`. Inside `defaultAttribute`, the provider check `=== "postgresql"` never matched, so `providerValue` was always `null`. This caused `defaultPostgres: "gen_random_uuid()"` to be silently ignored — PostgreSQL PKs were rendered with no `@default` at all.

2. `defaultKind: "dbgenerated"` emitted `@default((UUID()))` instead of the required `@default(dbgenerated("(UUID())"))` — the `dbgenerated()` wrapper was missing, producing invalid Prisma syntax.

**Fix:**  
- Normalize provider once at the top of `renderPrismaSchemaFromGraph` and pass the normalized string through.  
- Unified `"dbgenerated"` and `"function"` kinds to both emit `@default(dbgenerated("..."))`.  
- Changed field simulate from skip-if-exists to update-if-exists so mock definition changes propagate to the DB on re-run.

---

## BUG-006 — MySQL `dbgenerated("(UUID())")` accepted by Prisma but ID not returned after INSERT

**File:** `src/mocks/tables/_helpers.ts`  
**Status:** Fixed

**Description:**  
After fixing BUG-005, the MySQL PK used `defaultKind: "dbgenerated"` with `defaultMysql: "(UUID())"`, rendering `@default(dbgenerated("(UUID())"))`. MySQL 8.0 accepts expression defaults and the schema pushes successfully — but Prisma does **not** return the DB-generated UUID back to the client after INSERT. This is a known open Prisma issue (prisma/prisma #12055, #21350, #7010). Any `create()` call that omits `id` would return `null` for the primary key.

**Root cause:**  
Prisma's MySQL connector does not read back `LAST_INSERT_ID()` for string PKs with expression defaults — only for integer autoincrement columns.

**Fix:**  
Reverted MySQL PK to `defaultKind: "uuid"` (Prisma client-side generation). Prisma generates the UUID in the application layer before the INSERT, so the ID is always available to the caller. This is the recommended pattern for `CHAR(36)` UUIDs on MySQL.

For true DB-level UUID generation on MySQL, the correct approach is `BINARY(16)` with `DEFAULT (UUID_TO_BIN(UUID(), 1))` — but this changes the column type and requires application-layer conversion. Documented in `docs/db-defaults-reference.md`.
