# Scenario: SaaS Project Management — "SaaS Workflow Schema"

## Overview

A project management SaaS schema covering organisations, users, workspaces,
projects, tasks, comments, labels, and attachments. Eight tables with a
four-level FK chain (Org → Workspace → Project → Task → Comment/Attachment).

Designed to exercise the **full migration pipeline including intentional Stage 2
failures**. Running v1 → v2 will surface two categories of Zod errors that must
be resolved via the Fix Modal before the run can complete.

**Project name:** `SaaS Workflow Schema`
**Provider:** Postgres
**Version:** `1.0111`

---

## Tables

| Model | PK | Purpose |
|---|---|---|
| `Organization` | `id` Int | Tenant company |
| `User` | `id` Int | Members of an organisation |
| `Workspace` | `id` Int | Grouped container for projects |
| `Project` | `id` Int | Work initiative inside a workspace |
| `Task` | `id` Int | Work item within a project |
| `Comment` | `id` Int | Discussion thread on a task |
| `Label` | `id` Int | Categorisation tag (standalone) |
| `Attachment` | `id` Int | File linked to a task |

---

## Fields

### Organization
| Field | Type | Nullable | Default |
|---|---|---|---|
| id | Int | no | — |
| name | String | no | — |
| slug | String | no | — |
| plan | String | no | `"FREE"` |
| createdAt | DateTime | no | `now()` |

### User
| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | Int | no | — | |
| email | String | no | — | unique |
| name | String | no | — | |
| role | String | no | `"MEMBER"` | |
| score | Int | yes | — | **← required in v2; rows 2 and 4 are null → Stage 2 ERROR** |
| createdAt | DateTime | no | `now()` | |
| updatedAt | DateTime | no | — | @updatedAt |

### Workspace
| Field | Type | Nullable | Default |
|---|---|---|---|
| id | Int | no | — |
| name | String | no | — |
| description | String | yes | — |
| createdAt | DateTime | no | `now()` |

### Project
| Field | Type | Nullable | Default |
|---|---|---|---|
| id | Int | no | — |
| name | String | no | — |
| description | String | yes | — |
| status | String | yes | — |
| createdAt | DateTime | no | `now()` |
| updatedAt | DateTime | no | — |

### Task
| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | Int | no | — | |
| title | String | no | — | |
| description | String | yes | — | |
| priority | String | yes | — | **← becomes Priority enum in v2; "urgent"/"on hold" values → upgrade warning** |
| estimatedHours | String | yes | — | deleted in v2 |
| dueDate | DateTime | yes | — | |
| createdAt | DateTime | no | `now()` | |
| updatedAt | DateTime | no | — | @updatedAt |

### Comment
| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | Int | no | — | |
| body | String | no | — | renamed → `content` in v2 |
| rating | Int | yes | — | **← required in v2; rows 1, 3, 5, 7 are null → Stage 2 ERROR** |
| createdAt | DateTime | no | `now()` | |

### Label
| Field | Type | Nullable | Default |
|---|---|---|---|
| id | Int | no | — |
| name | String | no | — |
| color | String | no | `"#888888"` |

### Attachment
| Field | Type | Nullable | Default |
|---|---|---|---|
| id | Int | no | — |
| filename | String | no | — |
| url | String | no | — |
| size | Int | no | `0` |
| createdAt | DateTime | no | `now()` |

---

## Relations

FK fields are auto-created by the relations workflow — do not add them in fields.

| Source | Relation field | Target | Back-ref | Auto FK | onDelete |
|---|---|---|---|---|---|
| `User` | `organization` | `Organization` | `users` | `User.orgId` | Cascade |
| `Workspace` | `organization` | `Organization` | `workspaces` | `Workspace.orgId` | Cascade |
| `Project` | `workspace` | `Workspace` | `projects` | `Project.workspaceId` | Cascade |
| `Task` | `project` | `Project` | `tasks` | `Task.projectId` | Cascade |
| `Task` | `assignee` | `User` | `assignedTasks` | `Task.assigneeId` nullable | SetNull |
| `Comment` | `task` | `Task` | `comments` | `Comment.taskId` | Cascade |
| `Comment` | `author` | `User` | `comments` | `Comment.authorId` | Cascade |
| `Attachment` | `task` | `Task` | `attachments` | `Attachment.taskId` | Cascade |

---

## Restrictions

| Model | Type | Fields | Purpose |
|---|---|---|---|
| `Organization` | UNIQUE | `[slug]` | Unique org identifiers |
| `User` | UNIQUE | `[email]` | Login uniqueness |
| `User` | INDEX | `[orgId]` | Fast org member lookup |
| `Project` | INDEX | `[status]` | Filter by project state |
| `Task` | INDEX | `[priority]` | Filter by priority |
| `Task` | INDEX | `[dueDate]` | Deadline queries |

---

## V2 — Schema Evolution

### New table: Sprint
Fields: `id`(Int), `name`(String), `goal`(String?), `startDate`(DateTime?),
`endDate`(DateTime?), `createdAt`(DateTime now())

Relations: Sprint.space → Space (spaceId, Cascade), Sprint.createdBy → User (createdById nullable, SetNull)

### Renamed table: Workspace → Space
All Workspace data carries over via stable `tableId` UUID.

### V2 Field Changes

| Model | Change | Error type |
|---|---|---|
| `User` | `score` Int? → Int required (no default) | **Stage 2 Zod ERROR** — 2 null rows |
| `User` | + `avatarUrl` String? | none — new nullable field |
| `User` | `role` String → UserRole enum | upgrade warning — string cast |
| `Comment` | `body` → `content` (rename, same type) | none — stable fieldId rename |
| `Comment` | `rating` Int? → Int required (no default) | **Stage 2 Zod ERROR** — 4 null rows |
| `Task` | - `estimatedHours` | none — field deleted, data dropped |
| `Task` | + `storyPoints` Int? | none — new nullable field |
| `Task` | + `estimatedMinutes` Int? | none — new nullable field |
| `Task` | `priority` String? → Priority enum default LOW | upgrade warning — string cast |
| `Project` | `status` String? → ProjectStatus enum? | upgrade warning — string cast |
| `Organization` | `plan` String → OrgPlan enum default FREE | upgrade warning — string cast |

### V2 Enums

| Enum | Values |
|---|---|
| `UserRole` | MEMBER, ADMIN, OWNER |
| `Priority` | LOW, MEDIUM, HIGH, CRITICAL |
| `ProjectStatus` | ACTIVE, PAUSED, COMPLETED, ARCHIVED |
| `OrgPlan` | FREE, PRO, ENTERPRISE |

### V2 New Relations

| Source | Field | Target | Back-ref | FK | onDelete |
|---|---|---|---|---|---|
| `Sprint` | `space` | `Space` | `sprints` | `Sprint.spaceId` | Cascade |
| `Sprint` | `createdBy` | `User` | `createdSprints` | `Sprint.createdById` nullable | SetNull |
| `Task` | `sprint` | `Sprint` | `tasks` | `Task.sprintId` nullable | SetNull |

### V2 New Restrictions

| Model | Type | Fields |
|---|---|---|
| `Sprint` | UNIQUE | `[name, spaceId]` |
| `Task` | UNIQUE | `[projectId, title]` |

---

## Expected Migration Errors (v1 → v2)

Running "Sync and Migrate to Another Version" v1 → v2 with the seeded data
will produce **6 Stage 2 Zod errors across 2 models**.

### Error group 1 — User.score (Int required)
| Row | User | score value |
|---|---|---|
| [1] | Bob Smith | `null` |
| [3] | Dave Lee | `null` |

`z.number().int()` rejects null — **Fix:** set an integer score for each user.

### Error group 2 — Comment.rating (Int required)
| Row | taskId | rating value |
|---|---|---|
| [0] | 1 | `null` |
| [2] | 3 | `null` |
| [4] | 5 | `null` |
| [6] | 7 | `null` |

`z.number().int()` rejects null — **Fix:** set an integer rating (1–5) for each comment.

### Upgrade warnings (non-blocking)

Four string→enum cast warnings will appear in the diff panel:
- `Task.priority`: values `"urgent"` (3 rows) and `"on hold"` (3 rows) must resolve to valid Priority members after migration.
- `Project.status`: values `"in-progress"` (1 row) and `"planning"` (1 row) are not valid ProjectStatus members.
- `User.role`, `Organization.plan`: all existing values match enum members — warning only.

---

## Running the scenario

```bash
# Terminal 1 — start the app
pnpm dev

# Terminal 2 — build v1 + v2 schema
pnpm seed:workflows second-workflows

# Terminal 3 — seed v1 data into PostgreSQL
pnpm seed:db second-workflows postgresql://user:pass@host/db

# Then in the app:
# 1. Open Migrations → connect to the database
# 2. "Sync and Migrate to Another Version"
# 3. Sync version: 1.0111  →  Target version: 1.0112
# 4. Stage 2 shows 6 errors (2 User + 4 Comment)
# 5. Use Fix Modal to set score and rating values, then re-run
```
