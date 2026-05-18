# Migration & Schema System Rules

## /schema

### Field Naming Rules

Schema field names and database column names must always be separated.

### Schema Layer

- Prisma uses `schema.prisma`
- Drizzle uses TypeScript/JavaScript
- All schema field names must use `camelCase`

### Database Layer

- All database column names must use `snake_case`
- User input must be normalized using the following logic:

```ts
const onChangeHandler = (text: string): string => {
  text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_')
}
```

### Example

| Input             | Schema Field   | Database Column  |
| ----------------- | -------------- | ---------------- |
| `User Full Name!` | `userFullName` | `user_full_name` |

## `dn_name` must never be displayed in the UI.

## Default `_referance` Field

Every table must automatically include a hidden `_referance` field.

### Rules

- `_referance` is never displayed to the client
- `_referance` is only used during migrations
- `_referance` is used to locate related rows between old and new tables
- `_referance` must be removed from the database after migration completes
- `_referance` must be ignored during final migration writes

---

## Suggestions

## If the active project contains only one version, suggestion logic must not be shown to the client.

## Database Validation Rules

The system must validate and raise warnings/errors for:

- NOT NULL violations
- Invalid data type conversions
- Missing fields caused by renamed fields
- Unique constraint violations
- Invalid relation mappings
  Field matching must always be done using field IDs instead of field names because field names may change between versions.

---

## Type Conversion Suggestion Rules

Only compatible type conversions should be suggested.

### Examples

```txt
Int -> Decimal, Float, String, Text, Byte
String -> Text
Float -> Decimal, Int
```

When converting `Float -> Int`, the client must be warned:

```txt
Float values will be rounded.
```

---

## Null / NOT NULL Rules

If a nullable field is converted to NOT NULL:

- Existing null values must be checked
- The client must provide a default value OR
- The system must auto-generate unique values using:

```txt
${prefix}-${uniqueId}
```

### Example Warning

```txt
Field '${fieldName}' contains null values.
Existing rows will be filled using generated unique values.
```

---

# /relations

## Relation Suggestions

If multiple relations exist, the client should receive the following suggestion:

```txt
There are multiple relations. Do you want to create multi-indexes for faster lookups?
```

### Examples

#### One-to-One

```txt
User.personId -> People.id
```

Query strategy:

```ts
findOne()
```

---

#### One-to-Many

```txt
Image.personId -> Comment.personId
```

Query strategy:

```ts
findMany()
```

## If relations already contain data, migration mapping must preserve those relationships.

# /restrictions

## Indexes

Indexes must always be bound using field IDs instead of field names.

### Reason

```txt
Renaming fields must never break indexes.
```

If a unique index is added:

- Existing values must be checked for duplicates
- Null values must be handled
- Nullable fields may be set to `null`
- Non-nullable fields must receive generated unique values

---

# /hierarchy

Before table creation, tables must be sorted hierarchically based on dependencies.

## Example Dependency Graph

```txt
A -> D -> E -> T  	||	 B -> G -> [H, T] 	||	 C -> U -> I
```

## Parent Count

```ts
{ T: 4, H: 1, I: 1, E: 1, D: 1, G: 1, U: 1}
```

## Migration Order

```txt
[T, H, I, E, D, G, U, A, B, C]
```

## The client must be informed that migrations will execute in this dependency order.

# /migrations

During the data collection phase, if relations exist, `_referance` must store relation mappings.

## Example

```ts
_referances: {
  people: ["6d7c64f9-2b97-446d-82e9-ca446631ac5c", "ce8d1188-3d8b-465a-84a6-66d6c9943f87", "2bc38bd4-5d64-43bc-923e-f33c183186cb"],
  address: "ce8d1188-3d8b-465a-84a6-66d6c9943f87"
}
```

---

## Migration Query Examples

### findOne

```ts
findOne({ _referance: 'ce8d1188-3d8b-465a-84a6-66d6c9943f87' })
```

### findMany

```ts
findMany({ _referance: ['6d7c64f9-2b97-446d-82e9-ca446631ac5c', 'ce8d1188-3d8b-465a-84a6-66d6c9943f87', '2bc38bd4-5d64-43bc-923e-f33c183186cb'] })
```

---

## Migration Logic

- Related/dependent tables must always migrate first
- Old `_referance` values must be mapped to newly created UUIDs
- Parent tables must use these mappings to reconnect relations correctly
- `_referance` is only a temporary migration bridge
- After migration completes successfully, `_referance` must be removed permanently
- Final migrated data must never expose or retain `_referance`

---

# Core Principles

The migration system must be resilient against:

- Field renames
- Schema restructuring
- Relation remapping
- Type conversion issues
- Unique/index conflicts
- Nullability changes

The system must preserve data integrity while remaining fully version-aware and dependency-aware.
