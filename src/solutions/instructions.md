# Solution Instructions — Version Diff Resolution

This document defines every possible change the version-diff engine can detect, the resolution strategy for each, which changes require explicit user approval before migration, and the `schema_warnings` table schema that gates the migration workflow.

---

## 1. Resolution Strategies

Each detected change is assigned one of five resolution strategies. The strategy drives the UI severity, the approval requirement, and the migration behaviour.

| Strategy | Meaning | Approval required | Migration behaviour |
|---|---|---|---|
| `safe` | No data is lost or altered. The DB engine handles the change natively. | No | Proceed without intervention. |
| `precision_loss` | Data is preserved but may lose fidelity (truncated decimals, int overflow risk). | Yes | Migration runs; client must acknowledge data may differ. |
| `lossy_convert` | Conversion is possible but rows that don't fit the target type will fail or produce null. | Yes | Migration runs with a CAST; non-conforming rows set to NULL or default. |
| `data_deleted` | No automatic conversion path exists. The column or table will be dropped and recreated empty. | Yes | DROP + ADD column; all existing values in the column are lost. |
| `backfill_required` | A required column (no default) was added, or a default was removed from a required field. Existing rows have no value for it. | Yes | Migration halts unless client provides a backfill value or adds a temporary default. |

---

## 2. Type Conversion Matrix

Rows = **from** type. Columns = **to** type. Each cell is the resolution strategy.
`—` means the type is the same (no change).

| From \ To | String | Int | BigInt | Float | Decimal | Boolean | DateTime | Uuid | Json | Bytes |
|---|---|---|---|---|---|---|---|---|---|---|
| **String** | — | `lossy_convert`¹ | `lossy_convert`¹ | `lossy_convert`¹ | `lossy_convert`¹ | `lossy_convert`² | `lossy_convert`³ | `lossy_convert`⁴ | `lossy_convert`⁵ | `data_deleted` |
| **Int** | `safe` | — | `safe` | `precision_loss`⁶ | `safe` | `lossy_convert`⁷ | `lossy_convert`⁸ | `data_deleted` | `safe` | `data_deleted` |
| **BigInt** | `safe` | `precision_loss`⁹ | — | `precision_loss`⁶ | `safe` | `data_deleted` | `lossy_convert`⁸ | `data_deleted` | `lossy_convert`¹⁰ | `data_deleted` |
| **Float** | `safe` | `precision_loss`¹¹ | `precision_loss`¹¹ | — | `precision_loss`¹² | `data_deleted` | `data_deleted` | `data_deleted` | `safe` | `data_deleted` |
| **Decimal** | `safe` | `precision_loss`¹¹ | `precision_loss`¹¹ | `precision_loss`¹² | — | `data_deleted` | `data_deleted` | `data_deleted` | `safe` | `data_deleted` |
| **Boolean** | `safe` | `safe` | `safe` | `safe` | `safe` | — | `data_deleted` | `data_deleted` | `safe` | `data_deleted` |
| **DateTime** | `safe` | `precision_loss`¹³ | `safe`¹⁴ | `precision_loss`¹³ | `safe`¹⁴ | `data_deleted` | — | `data_deleted` | `safe` | `data_deleted` |
| **Uuid** | `safe` | `data_deleted` | `data_deleted` | `data_deleted` | `data_deleted` | `data_deleted` | `data_deleted` | — | `safe` | `lossy_convert`¹⁵ |
| **Json** | `safe` | `lossy_convert`¹⁶ | `lossy_convert`¹⁶ | `lossy_convert`¹⁶ | `lossy_convert`¹⁶ | `lossy_convert`¹⁶ | `data_deleted` | `data_deleted` | — | `data_deleted` |
| **Bytes** | `lossy_convert`¹⁷ | `data_deleted` | `data_deleted` | `data_deleted` | `data_deleted` | `data_deleted` | `data_deleted` | `data_deleted` | `data_deleted` | — |

### Footnotes

1. Only strings that parse as a valid number survive. Non-numeric rows → NULL (or migration fails if field is required).
2. Only "true", "false", "1", "0" (case-insensitive) survive. All other strings → NULL.
3. Only ISO 8601 strings survive. Invalid date strings → NULL.
4. Only RFC 4122 UUID-format strings survive. Non-UUID strings → NULL.
5. Only strings containing valid JSON survive. All others → NULL.
6. Float/Decimal cannot represent integers > 2⁵³ exactly. Values above this threshold lose precision.
7. Only 0 and 1 are valid; all other integers produce an error or undefined result depending on the DB driver.
8. Interpreted as a Unix timestamp (seconds or ms — ambiguous per driver). No reliable inverse conversion; treat as lossy.
9. Int is 32-bit; BigInt values outside −2³¹…2³¹−1 overflow silently or raise an error.
10. JSON spec does not support BigInt. Values are stringified to a numeric literal, which may lose precision in JavaScript-based runtimes.
11. The decimal fractional part is truncated. 3.14 becomes 3.
12. Floating-point representation errors may alter stored Decimal values (e.g. 0.1 becomes 0.10000000000000001).
13. Unix timestamp in seconds overflows a 32-bit Int after 2038. Float loses millisecond precision.
14. Unix timestamp in milliseconds fits in BigInt and Decimal without loss.
15. UUID stored as 16 raw bytes. Reversible, but the bytes are opaque to string comparisons.
16. Only JSON values that are of the target scalar type survive. A JSON `"hello"` → Int is NULL.
17. Bytes are base64-encoded into a String. The string is longer and opaque — not a human-readable value.

---

## 2a. PK-specific Conversion Allowlist

PK type changes cascade to every FK field in the project. The allowed conversions for a PK are more conservative because the FK fields must also be migrated in sync.

| From PK | Safe to migrate | Precision-loss (warn) | Not possible (data deleted) |
|---|---|---|---|
| `Int` | `BigInt`, `String`, `Decimal` | `Float` | `Uuid`, `Boolean`, `DateTime`, `Bytes`, `Json` |
| `BigInt` | `String`, `Decimal` | `Int` (overflow), `Float` | `Uuid`, `Boolean`, `DateTime`, `Bytes`, `Json` |
| `Uuid` | `String` | — | `Int`, `BigInt`, `Float`, `Decimal`, `Boolean`, `DateTime`, `Bytes`, `Json` |
| `String` | `Uuid`¹, `Json` | — | `Int`, `BigInt`, `Float`, `Decimal`, `Boolean`, `DateTime`, `Bytes` |

1. String → Uuid only if all existing values are valid UUID format. Otherwise `lossy_convert` (non-UUID rows → NULL or rejected).

When a PK change is `data_deleted`, **every FK field pointing to that table is also `data_deleted`** — the warning must list all cascade targets (already provided in `FieldDiff.cascade[]`).

---

## 3. Change Catalog

Every `changeKind` the diff engine emits, with the resolution strategy, approval requirement, and UI warning message template.

### 3.1 Table-level Changes (`TableDiff`)

#### `added` — new table
- **Strategy:** `safe`
- **Approval:** No
- **Message:** `Table "{name}" was added.`
- **Notes:** New empty table; no existing data affected.

#### `removed` — table deleted
- **Strategy:** `data_deleted`
- **Approval:** Yes — red breaking badge
- **Message:** `Table "{name}" was removed. All data in this table will be permanently deleted when migrating.`
- **Notes:** DROP TABLE. Approval message must show the row count if available from the snapshot.

#### `renamed` — table renamed, PK unchanged
- **Strategy:** `safe`
- **Approval:** No
- **Message:** `Table renamed from "{fromName}" to "{toName}". Data is preserved.`
- **Notes:** Prisma emits a `@@map` update. No data movement.

#### `changed` (PK field rename only)
- **Strategy:** `safe`
- **Approval:** No
- **Message:** `PK field renamed from "{from}" to "{to}". Data is preserved.`
- **Notes:** Column rename via ALTER TABLE … RENAME COLUMN.

#### `changed` (PK type changed — safe path)
- **Strategy:** `precision_loss` or `safe` per matrix above
- **Approval:** Yes if `precision_loss`; No if `safe`
- **Message (precision_loss):** `PK type changed from {from} to {to}. Values will be preserved but may lose precision. All FK fields pointing to this table ({count}) will also be migrated.`
- **Message (safe):** `PK type changed from {from} to {to}. Data is preserved. All FK fields pointing to this table ({count}) will also be migrated.`

#### `changed` (PK type changed — impossible path)
- **Strategy:** `data_deleted`
- **Approval:** Yes — red breaking badge
- **Message:** `PK type changed from {from} to {to}. This conversion is not possible. All existing values in column "{pkField}" will be deleted. All FK fields in {count} tables pointing to this table will also be deleted.`

---

### 3.2 Field-level Changes (`FieldDiff`)

#### `added` — optional field or field with default
- **Strategy:** `safe`
- **Approval:** No
- **Message:** `Field "{name}" added (optional / has default). No existing rows affected.`

#### `added` — required field, no default
- **Strategy:** `backfill_required`
- **Approval:** Yes — amber warning badge
- **Message:** `Required field "{name}" added with no default. Existing rows in "{tableName}" have no value for this column — you must provide a backfill value or make it optional before migrating.`

#### `removed` — field deleted
- **Strategy:** `data_deleted`
- **Approval:** Yes — amber warning badge
- **Message:** `Field "{name}" was removed from "{tableName}". All values in this column will be permanently deleted when migrating.`

#### `renamed` — name only, type unchanged
- **Strategy:** `safe`
- **Approval:** No
- **Message:** `Field renamed from "{from}" to "{to}". Data is preserved.`

#### `type_changed` — non-PK field type change
- **Strategy:** per matrix (§2)
- **Approval:** Yes if `precision_loss`, `lossy_convert`, or `data_deleted`; No if `safe`
- **Message (precision_loss):** `Field "{name}" type changed from {from} to {to}. Values will be preserved but may lose precision (e.g. decimal part truncated).`
- **Message (lossy_convert):** `Field "{name}" type changed from {from} to {to}. Only values that conform to {to} format will survive. Non-conforming rows will be set to NULL{orDefault}.`
- **Message (data_deleted):** `Field "{name}" type changed from {from} to {to}. No automatic conversion exists — all existing values in this column will be deleted.`
- **Message (safe):** `Field "{name}" type changed from {from} to {to}. Data is preserved.`

#### `pk_type_changed` — PK field type change
- **Strategy:** per PK allowlist (§2a)
- **Approval:** Yes unless `safe`
- **Message:** same as `type_changed` above plus `— {count} FK field(s) in other tables are also affected.`

#### `nullability_changed` — required → optional
- **Strategy:** `safe`
- **Approval:** No
- **Message:** `Field "{name}" made optional. Existing rows are unaffected.`

#### `nullability_changed` — optional → required
- **Strategy:** `backfill_required` (if any NULL rows could exist) / `safe` (if the field has a default or the table is brand new)
- **Approval:** Yes if `backfill_required`
- **Message (backfill_required):** `Field "{name}" made required. Existing rows that currently have NULL for this field will be rejected — provide a backfill value or a default before migrating.`
- **Message (safe):** `Field "{name}" made required. No nulls exist.`

#### `default_changed` — default removed from required field
- **Strategy:** `backfill_required`
- **Approval:** Yes — amber warning badge
- **Message:** `Default removed from required field "{name}". New inserts that omit this field will fail — make sure all application code provides an explicit value before migrating.`

#### `multiple` — several changes at once
- Severity and strategy are the **worst** of each individual change (type, nullability, default, rename).
- Approval: Yes if any sub-change requires it.
- **Message:** comma-joined list of sub-change messages.

---

### 3.3 Enum Changes (`EnumDiff`)

#### `added` — new enum
- **Strategy:** `safe`
- **Approval:** No
- **Message:** `Enum "{name}" was added.`

#### `removed` — entire enum deleted
- **Strategy:** `data_deleted`
- **Approval:** Yes — red breaking badge
- **Message:** `Enum "{name}" was removed. Any field that uses this enum type will fail schema validation. All rows using these values will be deleted.`
- **Notes:** Must list all fields in all tables that reference this enum.

#### `values_changed` — values added only
- **Strategy:** `safe`
- **Approval:** No
- **Message:** `Enum "{name}" gained {n} new value(s): {values}. Existing rows are unaffected.`

#### `values_changed` — values removed
- **Strategy:** `data_deleted` (rows storing the removed value cannot be migrated as-is)
- **Approval:** Yes — red breaking badge
- **Message:** `Enum "{name}" lost {n} value(s): {values}. Existing rows that hold any of these values will be rejected or set to NULL on migration. Decide how to handle them before proceeding.`
- **Options shown to user:** set to NULL / set to a remaining value / abort

#### `values_changed` — values both added and removed
- **Strategy:** `data_deleted` (the removed values govern)
- **Approval:** Yes — red breaking badge
- **Message:** combined: removed-values message first, then added-values note.

---

### 3.4 Relation Changes (`RelationDiff`)

#### `added` — new relation
- **Strategy:** `safe`
- **Approval:** No
- **Message:** `Relation "{fieldName}" ({sourceTable} → {targetTable}) was added.`
- **Notes:** A new FK column is added to the source table. It is nullable by default, so no backfill is needed unless the field was explicitly set to required.

#### `removed` — relation deleted
- **Strategy:** `safe` (the FK column and its data are removed, but no other table data is lost)
- **Approval:** Yes — amber warning badge
- **Message:** `Relation "{fieldName}" ({sourceTable} → {targetTable}) was removed. The FK column "{fkField}" and its values will be dropped on migration.`
- **Notes:** The target table is unaffected. Only the FK column on the source table is dropped.

#### FK type mismatch (detected from PK type change, shown on the Relations workflow)
- **Strategy:** `data_deleted` (the FK column stores the old type; it does not automatically sync)
- **Approval:** Yes — red breaking badge
- **Message:** `FK field "{fkField}" on "{sourceTable}" still has type {fromType} but "{targetTable}" PK is now {toType}. The FK field must be updated to match. Until fixed, FK values are mismatched and the constraint is broken.`
- **Notes:** This is a *consequence* of a PK type change, not an independent relation change. The approval for the PK type change implicitly covers this, but the Relations workflow surfaces it separately so the user understands what to fix.

---

### 3.5 Restriction Changes (UNIQUE / INDEX)

Restrictions are not yet tracked by the diff engine. When added, the change kinds will be:

#### `unique_added` — UNIQUE constraint added to an existing field
- **Strategy:** `lossy_convert` (migration fails if existing rows have duplicate values)
- **Approval:** Yes — amber warning badge
- **Message:** `Unique constraint added to field "{name}" on "{tableName}". Migration will fail if duplicate values currently exist in this column — deduplicate data before proceeding.`

#### `unique_removed` — UNIQUE constraint removed
- **Strategy:** `safe`
- **Approval:** No
- **Message:** `Unique constraint removed from field "{name}". Duplicate values are now allowed.`

#### `composite_unique_added` — multi-field UNIQUE added
- **Strategy:** `lossy_convert`
- **Approval:** Yes — amber warning badge
- **Message:** `Composite unique constraint added on ({fields}) in "{tableName}". Migration will fail if duplicate row combinations currently exist.`

#### `composite_unique_removed`
- **Strategy:** `safe`
- **Approval:** No

#### `index_added` / `index_removed`
- **Strategy:** `safe` for both
- **Approval:** No
- **Notes:** Index changes never affect stored data.

---

## 4. `schema_warnings` Table

One row per approvable warning per version transition. Written when the diff is first viewed; marked approved when the user clicks "I understand / Approve". The migration workflow checks that no unapproved rows exist for the transition before allowing the run.

### Drizzle schema (add to `src/lib/db/schema.ts`)

```typescript
export const schemaWarnings = sqliteTable("schema_warnings", {
  id:           text("id").primaryKey(),                 // randomUUID()
  projectId:    text("project_id").notNull(),
  fromVersion:  text("from_version").notNull(),
  toVersion:    text("to_version").notNull(),

  // Entity that changed
  entityKind:   text("entity_kind").notNull(),           // "table" | "field" | "enum" | "relation" | "restriction"
  entityId:     text("entity_id").notNull(),             // stable ID (tableId, fieldId, enumKey, relationId)
  entityName:   text("entity_name").notNull(),           // human-readable e.g. "Customer.email"

  // Change details
  changeKind:   text("change_kind").notNull(),           // matches FieldDiff.changeKind / TableDiff.changeKind etc.
  resolution:   text("resolution").notNull(),            // "safe" | "precision_loss" | "lossy_convert" | "data_deleted" | "backfill_required"
  fromValue:    text("from_value"),                      // type or value before change (nullable for added/removed)
  toValue:      text("to_value"),                        // type or value after change  (nullable for added/removed)
  message:      text("message").notNull(),               // full human-readable warning message

  // Approval
  approvedAt:   text("approved_at"),                     // ISO timestamp, NULL = pending
  createdAt:    text("created_at").notNull(),            // ISO timestamp
});
```

### Composite unique constraint

```typescript
// Prevents duplicate rows if diff is computed multiple times.
// Add to table definition:
},
(t) => ({
  uniq: uniqueIndex("schema_warnings_entity_uniq").on(
    t.projectId, t.fromVersion, t.toVersion, t.entityKind, t.entityId, t.changeKind
  ),
})
```

### What gets a row

Only changes with `approval: Yes` in the catalog above generate a `schema_warnings` row. Informational (`safe`, no-approval) changes are shown in the diff UI but never block migration.

---

## 5. Approval Flow

```
User visits any workflow (Enums / Tables / Schema / Relations)
       │
       ▼
Diff is computed (detectVersionChanges)
       │
       ├─ For each approvable diff (resolution ≠ "safe"):
       │     • Upsert a schema_warnings row (INSERT OR IGNORE so re-visits are idempotent)
       │     • Show warning in the UI with an "I understand" button
       │
       ▼
User clicks "I understand" on a warning
       │
       ├─ PATCH /api/schema-warnings/:id  → sets approved_at = NOW()
       └─ Warning disappears from the workflow UI (filtered out on next render)

Migration workflow ("Run" button)
       │
       ├─ Pre-flight check:
       │     SELECT COUNT(*) FROM schema_warnings
       │     WHERE project_id = ? AND from_version = ? AND to_version = ?
       │     AND approved_at IS NULL
       │
       ├─ Count > 0 → button disabled, tooltip: "N warning(s) still require approval"
       └─ Count = 0 → button enabled, migration proceeds
```

---

## 6. Migration Gate Rule

```
canMigrate(projectId, fromVersion, toVersion) = true
  iff
    schema_warnings
      WHERE project_id    = projectId
        AND from_version  = fromVersion
        AND to_version    = toVersion
        AND approved_at   IS NULL
      COUNT = 0
```

No other validation runs in the migration workflow. All data-safety decisions have been made in the diff workflows via the approval step. The migration worker trusts that approved resolutions are correct and executes accordingly.

---

## 7. Resolution Mapping Helper (implementation reference)

When building the warning writer, use this lookup to assign `resolution` from a `FieldDiff`:

```typescript
function fieldResolution(changeKind: FieldDiff["changeKind"], from: string, to: string): string {
  if (changeKind === "added") return /* isRequired */ "backfill_required" ?? "safe";
  if (changeKind === "removed") return "data_deleted";
  if (changeKind === "renamed") return "safe";
  if (changeKind === "nullability_changed") return /* nullable→required && no default */ "backfill_required" ?? "safe";
  if (changeKind === "default_changed") return "backfill_required";
  if (changeKind === "type_changed" || changeKind === "pk_type_changed") {
    return TYPE_CONVERSION_MATRIX[from]?.[to] ?? "data_deleted";
  }
  if (changeKind === "multiple") return /* worst of sub-changes */ "...";
  return "safe";
}
```

The `TYPE_CONVERSION_MATRIX` is a 10×10 object that encodes §2 above. It lives in `src/solutions/type-conversion-matrix.ts` (to be created when implementing the warning writer).
