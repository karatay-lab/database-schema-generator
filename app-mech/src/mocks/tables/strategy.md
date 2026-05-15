# Mock Tables — Strategy

## Objective

Simulate the full database creation action for 3 mock projects — writing realistic
`schema_tables` + `schema_fields` rows that cover every logical field type, with
correct provider-specific native types and defaults for Postgres (Shopfront Manager,
Content Hub Pro) and MySQL (Analytics Engine).

---

## Schema addition required

`schema_fields` currently has no `isId` column. Without it we cannot mark the PK
field at the row level. The strategy requires adding it to the Prisma schema before
implementing the mocks:

```prisma
// schema.prisma — SchemaField model
isId Boolean @default(false) @map("is_id")
```

After adding, run `prisma db push` to apply. The `schema_fields` Zod schema and
handler must be updated to include `isId` as well.

---

## Folder structure

One file per table. The version folder name `v1` maps to version `1.0111`.

```
src/mocks/tables/
  strategy.md
  shopfront-manager/
    v1/
      product.ts
      category.ts
      customer.ts
      address.ts
      cart.ts
      cart-item.ts
      order.ts
      order-item.ts
      payment.ts
      review.ts
      index.ts        ← exports all 10 as an ordered array
  analytics-engine/
    v1/
      user.ts
      session.ts
      event.ts
      property.ts
      funnel.ts
      funnel-step.ts
      data-source.ts
      dashboard.ts
      widget.ts
      report.ts
      index.ts
  content-hub-pro/
    v1/
      author.ts
      post.ts
      revision.ts
      category.ts
      tag.ts
      media.ts
      comment.ts
      page.ts
      menu.ts
      menu-item.ts
      index.ts
  index.ts            ← maps project name → tables array
```

---

## MockTableDef and MockFieldDef shapes

```typescript
// No projectId / versionId — resolved at simulate time.
export type MockTableDef = {
  name: string;        // PascalCase Prisma model name
  dbName: string;      // snake_case @@map value
  comment: string;     // one-line doc annotation
  sortOrder: number;   // 0-based within the version
  fields: MockFieldDef[];
};

export type MockFieldDef = {
  name: string;            // camelCase field name
  dbName?: string;         // @map override when name already matches db convention
  logicalType: LogicalType;
  nativeType?: string;     // Prisma @db.X attribute string, provider-specific
  nullable: boolean;
  isArray: boolean;
  isId: boolean;           // marks the primary key field (requires schema addition)
  defaultKind: DefaultKind;
  defaultValue: string;    // used when defaultKind === "literal"
  defaultPostgres?: string; // SQL expression for Postgres @default(dbgenerated(...))
  defaultMysql?: string;   // SQL expression for MySQL @default(dbgenerated(...))
  comment: string;
  isUpdatedAt: boolean;
  sortOrder: number;
};

type LogicalType =
  | "string"
  | "integer"
  | "float"
  | "decimal"
  | "boolean"
  | "timestamp"
  | "json";

type DefaultKind =
  | "none"
  | "literal"
  | "uuid"       // Prisma @default(uuid()) — app-level, works on all providers
  | "function"   // DB-native expression stored in defaultPostgres / defaultMysql
  | "now"        // @default(now())
  | "autoincrement";
```

---

## Provider default rules

### Primary key — UUID

Both providers use `String @id` with UUID. The generation strategy differs:

| | Postgres | MySQL |
|---|---|---|
| `logicalType` | `string` | `string` |
| `nativeType` | `@db.Uuid` | `@db.Char(36)` |
| `isId` | `true` | `true` |
| `defaultKind` | `"function"` | `"uuid"` |
| `defaultPostgres` | `gen_random_uuid()` | — |
| `defaultMysql` | — | — |

**Postgres** uses `@default(dbgenerated("gen_random_uuid()"))` — database-native,
no application roundtrip. Available in PostgreSQL 13+ natively; no extension needed.

**MySQL** uses Prisma's `@default(uuid())` — UUID generated at application layer before
INSERT. MySQL 8 has `UUID()` but Prisma does not map `uuid()` to a `DEFAULT` expression
on MySQL; the value is injected in the INSERT statement instead.

---

### Timestamps

| | Postgres | MySQL |
|---|---|---|
| `logicalType` | `timestamp` | `timestamp` |
| `nativeType` (createdAt) | `@db.Timestamptz(6)` | `@db.DateTime(0)` |
| `nativeType` (updatedAt) | `@db.Timestamptz(6)` | `@db.DateTime(0)` |
| `defaultKind` (createdAt) | `"now"` | `"now"` |
| `isUpdatedAt` (updatedAt) | `true` | `true` |

Postgres `Timestamptz` stores timezone-aware timestamps.
MySQL `DateTime(0)` is timezone-naive; precision 0 means no sub-second component.

---

### Boolean

| | Postgres | MySQL |
|---|---|---|
| `logicalType` | `boolean` | `boolean` |
| `nativeType` | — (native) | `@db.TinyInt(1)` |
| `defaultKind` | `"literal"` | `"literal"` |
| `defaultValue` | `"true"` / `"false"` | `"true"` / `"false"` |

MySQL has no native boolean type; Prisma maps `Boolean` to `TinyInt(1)`.

---

### Decimal / money

| | Postgres | MySQL |
|---|---|---|
| `logicalType` | `decimal` | `decimal` |
| `nativeType` | `@db.Decimal(10, 2)` | `@db.Decimal(10, 2)` |
| `defaultKind` | `"literal"` / `"none"` | `"literal"` / `"none"` |

---

### JSON

| | Postgres | MySQL |
|---|---|---|
| `logicalType` | `json` | `json` |
| `nativeType` | `@db.JsonB` | `@db.Json` |

Postgres prefers `JsonB` (binary JSON) for indexing and performance.
MySQL 8 has a native `JSON` type.

---

### String variants

| Variant | `nativeType` | When to use |
|---|---|---|
| Short label | `@db.VarChar(100)` | Name, slug, code |
| Standard text | `@db.VarChar(255)` | Email, URL, title |
| Long text | `@db.Text` | Description, body, notes |
| Fixed code | `@db.Char(2)` / `@db.Char(36)` | ISO codes, MySQL UUID |

---

### Foreign key fields

FK fields are plain `string` with the same native type as the referenced PK.
No special `defaultKind`. `nullable` depends on the relation cardinality.

---

## Field type coverage plan

Each table exercises a distinct mix of types. The full coverage across all 30 tables:

| Type | Tables that use it |
|---|---|
| `string` / VarChar | every table (name, slug, status fields) |
| `string` / Text | Product.description, Post.body, Comment.body, Report.query |
| `string` / Char | Address.country, all MySQL UUID PKs |
| `integer` | Product.stockQuantity, Category.sortOrder, Widget.sortOrder |
| `decimal` | Product.price, Payment.amount, OrderItem.unitPrice |
| `float` | Widget.value (metric display), FunnelStep.conversionRate |
| `boolean` | isActive, isVerified, isDefault, isPublished |
| `timestamp` / createdAt | every table |
| `timestamp` / updatedAt | every table |
| `json` | Product.metadata, Event.payload, Report.config, Widget.config |
| FK string | CartItem→Cart, OrderItem→Order, Comment→Post, etc. |

---

## Table sets

### Shopfront Manager — Postgres

| sortOrder | Name | dbName | Key field types |
|---|---|---|---|
| 0 | Product | products | uuid pk, varchar, text, decimal, int, bool, jsonb, timestamptz |
| 1 | Category | categories | uuid pk, varchar, text, uuid fk (self), int, timestamptz |
| 2 | Customer | customers | uuid pk, varchar(unique), varchar, bool, jsonb, timestamptz |
| 3 | Address | addresses | uuid pk, uuid fk, varchar, char(2), bool, timestamptz |
| 4 | Cart | carts | uuid pk, uuid fk, varchar(status), timestamptz |
| 5 | CartItem | cart_items | uuid pk, uuid fk×2, int, decimal, timestamptz |
| 6 | Order | orders | uuid pk, uuid fk, varchar(status), decimal, jsonb, timestamptz |
| 7 | OrderItem | order_items | uuid pk, uuid fk×2, int, decimal, timestamptz |
| 8 | Payment | payments | uuid pk, uuid fk, varchar, decimal, varchar(provider), jsonb, timestamptz |
| 9 | Review | reviews | uuid pk, uuid fk×2, int(rating), text, bool(approved), timestamptz |

---

### Analytics Engine — MySQL

| sortOrder | Name | dbName | Key field types |
|---|---|---|---|
| 0 | User | users | char(36) pk uuid, varchar, tinyint, datetime |
| 1 | Session | sessions | char(36) pk uuid, char(36) fk, varchar(device), datetime, int |
| 2 | Event | events | char(36) pk uuid, char(36) fk×2, varchar, json, datetime |
| 3 | Property | properties | char(36) pk uuid, char(36) fk, varchar(key), varchar(value), datetime |
| 4 | Funnel | funnels | char(36) pk uuid, char(36) fk, varchar, text, tinyint, datetime |
| 5 | FunnelStep | funnel_steps | char(36) pk uuid, char(36) fk, int(order), varchar, float, datetime |
| 6 | DataSource | data_sources | char(36) pk uuid, varchar(type), json(config), tinyint, datetime |
| 7 | Dashboard | dashboards | char(36) pk uuid, char(36) fk, varchar, varchar(layout), tinyint, datetime |
| 8 | Widget | widgets | char(36) pk uuid, char(36) fk, varchar(type), json(config), int, datetime |
| 9 | Report | reports | char(36) pk uuid, char(36) fk, varchar, text(query), json(config), varchar(status), datetime |

---

### Content Hub Pro — Postgres

| sortOrder | Name | dbName | Key field types |
|---|---|---|---|
| 0 | Author | authors | uuid pk, varchar, varchar(bio), text, varchar(avatarUrl), bool, timestamptz |
| 1 | Post | posts | uuid pk, uuid fk, varchar, varchar(slug unique), text, varchar(status), jsonb, timestamptz |
| 2 | Revision | revisions | uuid pk, uuid fk×2, text(content snapshot), int(version), timestamptz |
| 3 | Category | categories | uuid pk, uuid fk(self), varchar, varchar(slug), text, int, timestamptz |
| 4 | Tag | tags | uuid pk, varchar, varchar(slug unique), timestamptz |
| 5 | Media | media | uuid pk, uuid fk, varchar(type), varchar(url), varchar(mimeType), int(size), jsonb, timestamptz |
| 6 | Comment | comments | uuid pk, uuid fk×2, text, bool(approved), timestamptz |
| 7 | Page | pages | uuid pk, uuid fk, varchar, varchar(slug unique), text, varchar(status), bool(showInNav), timestamptz |
| 8 | Menu | menus | uuid pk, varchar, varchar(location), bool(isActive), timestamptz |
| 9 | MenuItem | menu_items | uuid pk, uuid fk×2 (menu+parent), varchar(label), varchar(url), int(sort), timestamptz |

---

## Simulate function

Lives at `src/workflows/tables/simulate.ts`. Pattern mirrors the project simulate:

1. Call `simulateMockProjects()` to get the 3 live projects with their IDs
2. For each project, find `versionId` = `project.versions[0].id` (the `1.0111` row)
3. For each `MockTableDef` in the matching set:
   a. `prisma.schemaTable.findFirst({ where: { versionId, name } })`
   b. If found → skip table, collect existing row
   c. If not found → `prisma.$transaction` creating the table row then each field row
4. Return the map: `{ shopfrontManager: TableRow[], analyticsEngine: TableRow[], contentHubPro: TableRow[] }`

The transaction for each table creates:
- One `schema_tables` row
- N `schema_fields` rows (one per `MockFieldDef`)

`tableId` and `fieldId` are generated with `crypto.randomUUID()` as stable cross-version
identity values. `modelKey` and `fieldKey` are set to match the generated `id` values
(backfill convention from the main app).

---

## Open questions before implementation

1. **isId migration** — confirmed: add `isId Boolean @default(false)` to `SchemaField`
   and push the schema before writing mock files?

2. **FK fields** — mock FK fields (e.g. `CartItem.cartId`) reference the *name* of the
   target table/field in the mock, not a live UUID. The simulate function generates the
   actual `fieldId` UUID, which means FK relations in `schema_relations` must be wired
   in a separate simulate step (after all tables + fields exist). Agreed?

3. **Self-relations** — Category (both projects) and MenuItem have a `parentId` FK
   pointing to the same table. Simulating this requires the table's own row ID, which
   is only known after creation. OK to leave `parentId` as a plain nullable string
   field without wiring the relation in this step?
