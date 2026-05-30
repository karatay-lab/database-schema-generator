# Fourth Workflows — Diff Exhaustive Test

**Project:** `Diff Exhaustive Test`  
**Provider:** Postgres  
**Purpose:** Exercise every version-diff warning path across all four workflows (Enums, Tables, Schema, Relations).

---

## V1 Baseline

### Enums
| Enum | Values |
|------|--------|
| `OrderStatus` | PENDING, PROCESSING, SHIPPED, DELIVERED, CANCELLED |
| `UserRole` | GUEST, MEMBER, ADMIN |
| `Priority` | LOW, MEDIUM, HIGH |
| `TicketType` | BUG, FEATURE, TASK |

### Tables
| Table | PK |
|-------|----|
| `Customer` | `id Int` |
| `LegacyLog` | `id Int` |
| `Coupon` | `id Int` |
| `Product` | `id Int` |
| `Invoice` | `id Int` |

### Customer fields
| Field | Type | Notes |
|-------|------|-------|
| `name` | String | required |
| `email` | String | required, unique |
| `notes` | String? | optional |
| `score` | Int | required, default 0 |
| `tier` | String | required |
| `legacyCode` | String? | optional |
| `bonus` | Int | required |

### Relations
| Source | Name | Target | FK |
|--------|------|--------|----|
| LegacyLog | customer | Customer | customerId |
| Invoice | customer | Customer | customerId |
| Coupon | customer | Customer | customerId (nullable) |
| Product | customer | Customer | customerId (nullable) |

---

## V2 Mutations

### Enums workflow — all diff paths

| Change | `changeKind` | Severity | Expected badge |
|--------|-------------|----------|----------------|
| `OrderStatus`: remove CANCELLED | `values_changed` | breaking | red "1 removed" |
| `OrderStatus`: add REFUNDED | `values_changed` | breaking (combined) | red "1 removed, 1 added" |
| `UserRole`: add SUPERADMIN | `values_changed` | warning | amber "1 added" |
| `Priority`: remove LOW + MEDIUM | `values_changed` | breaking | red "2 removed" |
| `TicketType`: delete entire enum | `removed` | breaking | red banner |
| `SupportTier` (new) | `added` | info | sky "new" |

### Tables workflow — all diff paths

| Change | `changeKind` | Severity | Expected badge |
|--------|-------------|----------|----------------|
| `LegacyLog` deleted | `removed` | breaking | red "removed" |
| `Coupon` → `Discount` (pure rename) | `renamed` | warning | amber "renamed" |
| `Product.id` → `Product.uid` (Int unchanged) | `changed` | info | sky "1 changed" |
| `Invoice.id` Int → Uuid | `changed` | breaking | red "1 breaking" |
| `NewTable` added | `added` | info | sky "added" |

### Schema workflow (Customer) — all field diff changeKinds

| Change | `changeKind` | Severity | Expected UI |
|--------|-------------|----------|-------------|
| `name` → `fullName` + String → Float | `multiple` | warning | amber border |
| `notes` → `description` | `renamed` | warning | amber border |
| `score` default removed (stays required) | `default_changed` | warning | amber border |
| `tier` String → Int | `type_changed` | warning | amber border |
| `legacyCode` deleted | `removed` | warning | ghost card + Restore |
| `bonus` required → optional | `nullability_changed` | info | sky border |
| `rating` Int required added (no default) | `added` | warning | amber border |

### Relations workflow — all diff paths

| Change | Expected UI |
|--------|-------------|
| `LegacyLog` deleted (cascades its relation) | Red banner on Customer relations: "1 relation removed since v1.xxxx" |
| `Invoice.customer` → Customer | No diff badge — relation survives unchanged; `customerId Int` matches `Customer.id Int` |
| `Discount.customer` (was `Coupon`) | No diff badge — table rename carries the relation cleanly |
| `NewTable.customer` → Customer (new in v2) | Sky border + sky "new" badge on NewTable relations tab |

> **Note:** FK type mismatch (FkTypeDetailModal) is already exercised by second-workflows, where Int FKs point to Uuid PKs after the PK upgrade. In this scenario Customer.id remains Int so no mismatch fires.

---

## Run

```bash
pnpm seed:workflows fourth-workflows        # both v1 and v2
pnpm seed:workflows fourth-workflows v1     # v1 only
pnpm seed:workflows fourth-workflows v2     # v2 only (re-runnable)
```
