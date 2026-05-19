# Schema Studio — Database Schema Generator

A visual, workflow-driven schema management tool built on top of Prisma. Design your database models, relations, restrictions, and field templates through an intuitive UI — no manual `.prisma` file editing required.

[![License: MIT](https://img.shields.io/badge/License-MIT-violet.svg)](./LICENSE)
[![Open Collective](https://img.shields.io/opencollective/all/karatay-lab?label=sponsors)](https://opencollective.com/karatay-lab)

---

## Features

- **Projects & versions** — manage multiple schema projects, each with independent version history
- **Tables & fields** — create and edit Prisma models and scalar fields with type, default, nullable, and unique constraints
- **Relations** — inline FK column creation with automatic back-reference derivation, conflict detection, and health indicators
- **Restrictions** — define multi-column `@@unique` and `@@index` constraints visually
- **Commentary** — add `/// docstring` annotations to schema fields for GraphQL schema generation
- **Imports** — upload external `.prisma` files and sync them into projects
- **Migrations** — collect live database snapshots, compare versions, validate rows, and push migrations with credential encryption
- **Field templates** — reusable field presets applied across any project
- **Schema validation** — run `prisma format` + `prisma validate` inline with ANSI output rendering
- **Zod generation** — generate typed Zod validators from your schema

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 App Router, React 19 |
| Styling | Tailwind CSS v4, shadcn/ui |
| API | tRPC v11 + TanStack Query v5 |
| Storage | SQLite via `better-sqlite3` + Drizzle ORM |
| Schema | `@mrleebo/prisma-ast`, Prisma CLI (dev) |
| Validation | Zod v4 |
| Icons | Tabler Icons |
| Package manager | pnpm |

## Prerequisites

- Node.js ≥ 20
- pnpm ≥ 9
- Prisma CLI (`pnpm add -g prisma`)

## Setup

```bash
# 1. Clone
git clone https://github.com/karatay-lab/database-schema-generator.git
cd database-schema-generator

# 2. Install dependencies
pnpm install

# 3. Configure environment
cp .env.example .env
# Edit .env — only needed if you use the Migrations workflow

# 4. Push the SQLite schema
pnpm db:push

# 5. Start the dev server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

See [`.env.example`](./.env.example) for all available variables.

| Variable | Required | Description |
|---|---|---|
| `POSTGRES_URL` | No | PostgreSQL connection string for the Migrations workflow |
| `MYSQL_URL` | No | MySQL connection string for the Migrations workflow |

## Project Structure

```
src/
  app/
    (workflows)/      # Route pages — one import + one render each
    views/            # All page UI and logic
      shared/         # DashboardShell, context, WorkflowSkeleton
  trpc/               # tRPC routers and client setup
  lib/
    schema-store.ts   # Core schema engine (models, fields, relations, restrictions)
    schema-db/        # Normalized graph types
    schema-renderers/ # Prisma and Drizzle schema renderers
    migrations/       # Migration rules engine
  database/
    app.db            # SQLite — projects, versions, model stores, field templates
    schemas/          # Generated .prisma files per project/version
    zod/              # Generated Zod validators
```

## Scripts

```bash
pnpm dev          # Start dev server (Turbopack)
pnpm build        # Production build
pnpm lint         # ESLint check
pnpm db:push      # Push Drizzle schema to SQLite
pnpm db:studio    # Open Drizzle Studio
```

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for commit conventions, branch strategy, and PR guidelines.

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for version history.

## Sponsorship

Schema Studio is sponsored via [Open Collective](https://opencollective.com/karatay-lab). If this project saves you time, consider supporting its development.

## License

[MIT](./LICENSE) © 2026 Berkay Karatay / karatay-lab
