# Test Scenarios — Progress Tracker

## Scenario Runners (`pnpm seed:workflows <folder>`)

| Folder | Domain | Provider | Status |
|---|---|---|---|
| `blog-platform` | Blog Platform | Postgres | ✅ Complete — v1 + v2 built and seeded |
| `saas-platform` | SaaS Project Management | Postgres | ✅ Complete — v1 + v2 built, seed-db.ts ready |
| `shop-mysql` | E-Commerce Shop | MySQL | ✅ Complete — v1 + v2 built and seeded |
| `diff-exhaustive` | ? | SQLite | ⬜ Not started |

---

## Unit Tests (`pnpm test`)

| File | Coverage | Status |
|---|---|---|
| `projects.test.ts` | create, list, fork, delete, duplicate/short name rejection | ✅ Done |
| `tables.test.ts` | create, list, update, delete | ✅ Done |
| `fields.test.ts` | create, list, update, delete | ✅ Done |
| `relations.test.ts` | create, list, delete | ✅ Done |
| `restrictions.test.ts` | UNIQUE + INDEX create, list | ✅ Done |
| `enums.test.ts` | create enum, add values, list | ✅ Done |
| `exports.test.ts` | Prisma + Drizzle + pickle exports | ✅ Done |
| `imports.test.ts` | version pickle + project pickle import | ✅ Done |
| `migrations.test.ts` | listConnections, deleteConnection | ⬜ Not started |

---

## Where we left off

**Last completed:** `shop-mysql` (MySQL E-Commerce) v1 + v2 fully built.

**Next up — pick one:**

1. **`diff-exhaustive` (SQLite)** — A new domain on SQLite provider.

2. **`migrations.test.ts`** — Vitest unit tests for the two tRPC migrations procedures:
   `migrations.listConnections` and `migrations.deleteConnection`. Lightweight — no
   real DB connection needed.

3. **Seed `saas-platform` into a real Postgres DB and run the migration** — Deploy
   v1 schema via Migrations UI, run `pnpm seed:db saas-platform <url>`, then
   exercise the full v1→v2 migration pipeline to confirm the Fix Modal fires on the
   6 expected null rows (2 × User.score, 4 × Comment.rating).

---

## Seed commands

```bash
# Build schemas (run with app running on :3000)
pnpm seed:workflows blog-platform
pnpm seed:workflows saas-platform
pnpm seed:workflows shop-mysql

# Seed mock data into a real DB (schema must be deployed first)
pnpm seed:db blog-platform  postgresql://user:pass@host/db
pnpm seed:db saas-platform postgresql://user:pass@host/db
pnpm seed:db shop-mysql  mysql://user:pass@host:3306/db
```

## Expected migration errors (saas-platform v1 → v2)

| Model | Field | Rows | Error |
|---|---|---|---|
| `User` | `score` | 2 (Bob Smith, Dave Lee) | `null` → required Int |
| `Comment` | `rating` | 4 (comments 1, 3, 5, 7) | `null` → required Int |

Upgrade warnings (non-blocking): `Task.priority`, `Project.status`, `User.role`, `Organization.plan` — all String→enum casts.
