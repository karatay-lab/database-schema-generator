# Integration Plan: app-mech → src (Next.js) with tRPC + shadcn/ui

## What changes and why

The current src project uses raw `fetch()` to hand-rolled Next.js API routes with manual JSON parsing and type guards. The `dashboard-context.tsx` is a monolithic client store doing everything. We're replacing this with:

- **tRPC v11** — end-to-end type safety, auto query keys, batching, no manual JSON
- **TanStack Query v5** — caching, invalidation, optimistic updates, `useSuspenseQuery`
- **shadcn/ui** — owned component primitives (Dialog, Form, Sidebar, DataTable, etc.)
- **app-mech as data layer** — app-mech's Prisma-based workflow functions replace the current `src/lib/*-store.ts` files

---

## Phase 1 — Install + Configure (no behavior change)

### 1.1 Install packages
```bash
pnpm add @trpc/server @trpc/client @trpc/tanstack-react-query @tanstack/react-query @hookform/resolvers react-hook-form superjson
pnpm add -D server-only client-only
```

### 1.2 Install shadcn/ui
```bash
pnpm dlx shadcn@latest init   # sets up components.json, globals.css theme, cn utility
pnpm dlx shadcn@latest add button dialog form select tabs sheet table sidebar sonner badge input textarea separator scroll-area tooltip
```

### 1.3 tRPC infrastructure files (4 files)

| File | Role |
|------|------|
| `src/trpc/init.ts` | `initTRPC`, `createTRPCContext`, exports `baseProcedure`, `createCallerFactory` |
| `src/trpc/query-client.ts` | `makeQueryClient` factory (staleTime, dehydrate pending) |
| `src/trpc/server.tsx` | `getQueryClient`, `trpc` server proxy, `HydrateClient`, `prefetch` |
| `src/trpc/client.tsx` | `TRPCReactProvider`, `useTRPC`, `useTRPCClient` |

### 1.4 HTTP handler
`src/app/api/trpc/[trpc]/route.ts` — `fetchRequestHandler` (edge-compatible)

### 1.5 Layout wrapping
`src/app/layout.tsx` wraps children with `<TRPCReactProvider>`

---

## Phase 2 — tRPC Routers (one per workflow, wrapping app-mech)

app-mech's workflow functions become the tRPC procedure implementations. The existing `src/lib/*-store.ts` files get **deprecated** in favour of importing directly from `app-mech/src/workflows/`.

| Router | app-mech source | Key procedures |
|--------|----------------|----------------|
| `projects` | `app-mech/src/workflows/projects/workflow.ts` | `list`, `create`, `update`, `delete`, `forkVersion` |
| `tables` | `app-mech/src/workflows/tables/` | `list`, `create`, `update`, `delete`, `reorder` |
| `fields` | `app-mech/src/workflows/fields/` | `list`, `create`, `update`, `delete` |
| `relations` | `app-mech/src/workflows/relations/` | `list`, `create`, `update`, `delete` |
| `restrictions` | `app-mech/src/workflows/restrictions/` | `list`, `create`, `update`, `delete` |
| `exports` | `app-mech/src/workflows/exports/` | `renderPrisma`, `renderDrizzle` |
| `migrations` | `app-mech/src/workflows/migrations/` | `collect`, `validate`, `run`, `getStatus` |
| `schema` | `app-mech/src/workflows/schema/` | `test`, `validate`, `generateZod` |
| `imports` | `app-mech/src/workflows/imports/` | `upload`, `match`, `sync` |
| `fieldTemplates` | `app-mech/src/workflows/fields/` | `list`, `create`, `update`, `delete` |

All routers combine into `src/trpc/routers/_app.ts` → `AppRouter` type exported.

---

## Phase 3 — Replace dashboard-context + views

The `DashboardProvider` currently does manual `fetch()` and holds global state. It becomes:
- **Server component layout** → prefetches project list via `trpc.projects.list.queryOptions()`
- **Client components** → call `useTRPC()` + `useQuery` / `useMutation` + `queryClient.invalidateQueries`
- `dashboard-context.tsx` is **slimmed** to only UI state (activeProjectId, selectedVersion) — no more API calls in context

Each view (`tables-page.tsx`, `schema-page.tsx`, etc.) gets its data via `useSuspenseQuery` in a client component wrapped by `<Suspense>` in the parent server route.

---

## Phase 4 — shadcn/ui component adoption

Replace the current custom UI starting with high-value targets:
- **Sidebar** → `shadcn Sidebar` with `SidebarProvider` + `collapsible="icon"`
- **Dialogs/modals** → `shadcn Dialog` + `Sheet` (for create/edit forms)
- **Forms** → `shadcn Form` + `react-hook-form` + `zodResolver` (eliminates manual validation boilerplate)
- **Tables** → `shadcn DataTable` built on TanStack Table v8
- **Notifications** → `sonner` (replaces any custom toast)
- **Select/Tabs** → `shadcn Select` + `shadcn Tabs`

---

## Phase 5 — Database unification

Currently there are two SQLite databases:
- `src/database/app.db` — the main project's Drizzle/better-sqlite3 db
- `app-mech/prisma/dev.db` — app-mech's Prisma db

**Decision**: Migrate the main project's data into the app-mech Prisma schema. The app-mech schema is more complete (has migration tracking, pipeline models, fs_paths, artifacts). The main project's data gets migrated via a one-time script.

After migration, `src/lib/db/` and `src/lib/*-store.ts` are deleted. All data access goes through app-mech's Prisma client.

---

## Implementation order

```
Phase 1  →  Phase 2 (routers)  →  Phase 3 (one view at a time)  →  Phase 4 (component-by-component)  →  Phase 5
```

Phase 3 can proceed view-by-view: the old REST routes and new tRPC routes coexist until each view is migrated. Once all views are on tRPC, the old `/api/*` routes get deleted.
