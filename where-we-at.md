# Where We Left Off

**Date:** 2026-05-29  
**Branch:** `feature/tracking-workflow` — pushed to GitHub

---

## What got done this session

### Tracking workflow (complete)
- Resolver tabs: status-coloured backgrounds (green/red/amber via inline style), 72px height, URL sync (`?resolve=schema`)
- Per-tab warning counts + status sub-line in two-line tab layout
- Resolution Strategies legend always on top, filtered per entity kind
- `StrategyBadge` in Resolve column: Unique Prefix+UUID / Static Default / Type Cast / Remapped / Data Dropped / Acknowledged
- `ResolveModal` (portal to body — avoids `<div>` inside `<tbody>` hydration error): field info badges (nullable/unique), prefix input for unique String fields, "Resolve it for me" auto-approve
- `ApproveCell`: ✓/✗ circles, centered; ✗ only shown when approved (no redundant text)
- Row bg: `bg-rose-50/60` pending, `bg-emerald-50/60` approved
- All Changes tab: full-width button-group filters (Kind/Change/Entity)
- `defaultsRequiredCount`: gates Schema Check when non-nullable backfill_required/lossy_convert fields lack `replacementValue`

### Migration pipeline (complete)
- Validate route: `trulyLossyFields` now uses `checkTypeConversion(fromValue, toValue)` — correctly strips incompatible conversions (String→Float) while letting compatible ones (String→Enum) carry v1 data through
- Run route: solutions dispatcher wires Tracking decisions. Unique String prefix fields get `${prefix}-${uuid}` per row. MySQL datetime: ISO→`YYYY-MM-DD HH:MM:SS` before payload serialization.
- check-sync + collect: MySQL `information_schema` uppercase fix (`TABLE_NAME`/`COLUMN_NAME`)
- Preflight modal: 4× wider, Crucial/Warning tabs with strategy descriptions, pagination
- Connection String modal: pre-populates from active connection, ORM picker, copy icon

### solutions/ module (new)
`from-string.ts`, `from-number.ts`, `from-datetime.ts`, `from-enum.ts`, `backfill.ts`, `index.ts`:
- Per-type-pair converter functions switching on `FieldDecision`
- `warningToDecision()` bridges `SchemaWarning` → `FieldDecision`
- `resolveFieldMigration()` dispatcher

### schema_warnings (extended)
- `targetNullable` + `targetUnique` joined from v2 schema at query time
- `getTypeResolution`: String→Enum now returns `lossy_convert` not `data_deleted`

---

## Current state

All 14 workflows are fully implemented (no placeholders).

**Known gaps / not started:**
1. **Restrictions tracking** — Restrictions tab in Tracking shows "not yet implemented" placeholder. No approval-gate tracking for UNIQUE/INDEX constraint changes.
2. **TableDiffDetailModal** (`lucky-orbiting-rabbit.md` plan) — click badge on Tables workflow → modal showing field-level diff. Not started.
3. **Fourth-workflows ToDo** — `docs/version3/ToDo.md` has remaining items for the Diff Exhaustive Test scenario.
4. **Enum value removed without replacement on non-nullable field** — orphaned string values hit DB enum constraint at INSERT time. Gate does not currently block this case.

---

## Key files changed this session

| Area | Files |
|------|-------|
| Tracking UI | `tracking-page.tsx`, `warnings-panel.tsx` |
| Migration API | `validate/route.ts`, `run/route.ts`, `check-sync/route.ts`, `collect/route.ts` |
| New API | `connections/url/route.ts` |
| Solutions | `solutions/` (6 new files) |
| Store | `schema-warnings-store.ts` |
| Matrix | `solutions/type-conversion-matrix.ts` |
| Inline pages | `schema-page.tsx`, `enums-page.tsx`, `relations-page.tsx` |
| Seed | `fourth-workflows/seed-db.ts`, `mocks/fourth-workflows/` |
| Docs | `docs/version3/changes.md` |
