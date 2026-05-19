# Changelog

All notable changes to Schema Studio are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versions follow [Semantic Versioning](https://semver.org/).

---

## [Unreleased]

---

## [0.2.0] — 2026-05-19

### Added
- **Relations workflow overhaul** — Create Relation modal redesigned with inline FK column creation; no more round-trip to the Schema page
- Back-reference name auto-derived as `{sourceModel}{RelationPascal}` (e.g. `usersPerson` on `people`)
- Target table replaced with searchable, paginated card grid in the modal
- FK conflict detection against all scalar fields and existing relation FKs with distinct error messages
- Back-reference name conflict detection across relations to the same target
- Relation card health indicator: amber border + `FK missing` badge when a FK column no longer exists on the table
- `SetNull` cascade option disabled when FK is Required; cleared automatically on switch to Required
- On Delete / On Update redesigned as 4-option card rows; `No Action` pre-selected as explicit default
- `?table=` URL param persistence on relations, schema, restrictions, and commentary pages
- `WorkflowSkeleton` Suspense fallback (shadcn Skeleton + animate-pulse) on all four pages
- Scroll-to-card when closing the edit modal

### Changed
- Relation field name normalised to camelCase on blur; back-reference derived silently (no manual input)
- `safeRelationPage` computed inline to eliminate one-render flash on tab switch

### Removed
- Redundant relation count badge in the card list header (counts already shown in tabs)
- Ambiguous `Default` option from On Delete / On Update — replaced by explicit `No Action`

---

## [0.1.0] — 2026-05-18

### Added
- Initial release
- Projects, Tables, Schema (field templates + Zod generation), Relations, Restrictions, Validation, Imports, Migrations workflows
- REST API migrated to tRPC v11 + TanStack Query v5
- shadcn/ui component library integrated (Sidebar, Button, Badge, Dialog, Form, Table, Skeleton, Sonner, and more)
- Hierarchy workflow with dependency graph and model ordering rules
- SQLite storage via `better-sqlite3` + Drizzle ORM
- Prisma schema AST generation via `@mrleebo/prisma-ast`
- AES-256-GCM encryption for stored database connection credentials
- Multi-provider support: PostgreSQL, MySQL, SQLite

[Unreleased]: https://github.com/karatay-lab/database-schema-generator/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/karatay-lab/database-schema-generator/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/karatay-lab/database-schema-generator/releases/tag/v0.1.0
