# AGENTS.md

Implementation guidance for coding agents working in this repository.

## First Moves

- Run `git status --short` before editing. Preserve user changes and do not revert files you did not touch.
- Read this file, `README.md`, `where-we-at.md`, and `docs/mapping.md` before broad changes.
- Prefer small, working slices. After changes, run the narrowest useful verification, then `pnpm build` when routing, data loading, or shared UI changes.
- When a manually written source or documentation file is created or updated, update `docs/mapping.md` with its purpose, imports, exports, related files, artifact type, and written-by value.

## Current Stack

- Next.js 16 App Router with `src/app`, React 19, TypeScript, Tailwind CSS v4.
- tRPC v11 with `@trpc/tanstack-react-query` and TanStack Query v5.
- shadcn/ui source components in `src/components/ui`, configured by `components.json`.
- Local app data uses SQLite via `better-sqlite3`; Prisma is used for schema generation and validation, not as the runtime ORM for app state.

## Next.js App Router Rules

- Keep route files thin. Files under `src/app/(workflows)/*/page.tsx` should import the matching view and render it.
- Put workflow UI and client logic in `src/app/views/<workflow>/`. Put reusable cross-workflow dashboard code in `src/app/views/shared/`.
- Use route groups such as `(workflows)` for organization without changing URLs. Current workflow URLs are `/projects`, `/tables`, `/schema`, `/relations`, `/restrictions`, `/validation`, `/exports`, `/imports`, `/sql-query`, `/commentary`, `/migrations`, `/history`, `/hierarchy`, `/enums`, and `/tracking`.
- Prefer Server Components by default. Add `"use client"` only for state, effects, event handlers, browser APIs, or TanStack Query hooks.
- Keep server-only database and filesystem code in `src/lib/**` or route handlers. Do not import server-only modules into Client Components.
- Existing REST route handlers in `src/app/api/**` are still valid for heavy migration/native-driver/file operations. For ordinary app CRUD, prefer tRPC.

## tRPC Rules

- Initialize tRPC once in `src/trpc/init.ts`. Add feature routers under `src/trpc/routers/` and merge them in `src/trpc/routers/_app.ts`.
- Export `AppRouter` as a type and use `import type` from client code so server code is not pulled into the client bundle.
- Use Zod inputs on procedures. Convert expected domain failures to `TRPCError` with useful messages.
- Client Components should use:
  - `const trpc = useTRPC()`
  - `useQuery(trpc.feature.procedure.queryOptions(input, options))`
  - `useMutation(trpc.feature.procedure.mutationOptions(options))`
- Invalidate with TanStack Query APIs, using tRPC helpers such as `trpc.feature.list.queryFilter(input)` or `trpc.feature.list.queryKey(input)`.
- Server Components can prefetch through `src/trpc/server.tsx`: get the cached query client, prefetch query options, then wrap the subtree in `HydrateClient`.
- Keep `superjson` configured consistently in the server/client/query-client setup.

## shadcn/ui Rules

- `components.json` is the source of truth for shadcn placement:
  - `ui`: `@/components/ui`
  - `components`: `@/components`
  - `lib`: `@/lib`
  - `hooks`: `@/hooks`
  - Tailwind CSS file: `src/app/globals.css`
  - RSC support: `true`
- Add new shadcn primitives with `pnpm dlx shadcn@latest add <component>` unless the component already exists locally.
- Import primitives from `@/components/ui/<component>`. Compose workflow-specific UI in `src/app/views/<workflow>/` or `src/components/<domain>/`.
- Use existing primitives before inventing new ones: `Button`, `Dialog`, `Sheet`, `Tabs`, `Select`, `Tooltip`, `Table`, `Sidebar`, `Input`, `Textarea`, `Badge`, `Separator`, and `Sonner`.
- Keep UI dense and operational. This is a schema management app, not a marketing site.
- Use icons from the existing icon libraries (`lucide-react` or `@tabler/icons-react`) for tool buttons and actions.

## Folder Placement

- `src/app/(workflows)/`: App Router workflow route entries.
- `src/app/views/<workflow>/`: workflow screens, local panels, modals, and page-specific components.
- `src/app/views/shared/`: shell, dashboard context, shared hooks, shared workflow UI.
- `src/components/ui/`: shadcn primitives.
- `src/components/<domain>/`: reusable non-route domain components.
- `src/constants/<domain>/`: labels, class maps, option sets, and small static configs.
- `src/hooks/`: reusable client hooks.
- `src/lib/`: server/domain logic, stores, renderers, migration helpers, validation.
- `src/trpc/`: tRPC init, client/server helpers, routers.
- `src/types/`: shared TypeScript types that are safe to import broadly.

## Rendering And Data Flow

- Dashboard layout is in `src/app/(workflows)/layout.tsx`; it prefetches project data and hydrates client state.
- `DashboardProvider` owns active project/version UI state. Use `useDashboard()` and `useActiveProject()` inside client workflow views.
- Prefer tRPC queries for workflow reads and mutations. Keep fetch calls only where the endpoint is intentionally REST-based.
- After mutations, invalidate the affected query keys. Do not depend on full-page reloads for normal UI updates.
- Keep forms controlled enough to preserve user input during validation errors and pending states.

## Verification

- Use `pnpm lint` for source style/type lint checks.
- Use `pnpm test` for Vitest coverage when changing schema-store, graph, renderer, or migration logic.
- Use `pnpm build` before handing off changes that touch App Router layouts, route handlers, tRPC setup, or shared UI.
- Current known build note: `pnpm build` can emit Turbopack warnings about dynamic child-process tracing in migration route handlers while still completing successfully.

## Official References

- Next.js App Router project structure: https://nextjs.org/docs/app/getting-started/project-structure
- tRPC v11 TanStack React Query setup: https://trpc.io/docs/client/tanstack-react-query/setup
- tRPC v11 Server Components setup: https://trpc.io/docs/client/tanstack-react-query/server-components
- tRPC routers: https://trpc.io/docs/server/routers
- shadcn/ui Next.js installation: https://ui.shadcn.com/docs/installation/next
- shadcn/ui `components.json`: https://ui.shadcn.com/docs/components-json
