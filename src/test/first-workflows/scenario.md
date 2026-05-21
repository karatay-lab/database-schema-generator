# Scenario: Blog Platform — "Project Mock To Test"

## Overview

A realistic blog platform schema covering authors, posts, categories, tags, comments,
and media. Designed to exercise every UI workflow: tables, fields, relations,
and restrictions.

**Project name:** `Project Mock To Test`  
**Provider:** Postgres  
**Version:** `1.0111`

---

## Tables

| Model | PK | Purpose |
|---|---|---|
| `User` | `id` Int | Blog authors and commenters |
| `Category` | `id` Int | Top-level post categories |
| `Tag` | `id` Int | Many-sided post labels |
| `Post` | `id` Int | Blog articles |
| `Comment` | `id` Int | Reader comments on posts |
| `Media` | `id` Int | Uploaded images and files |

---

## Fields

### User
| Field | Type | Nullable | Unique | Default | Notes |
|---|---|---|---|---|---|
| id | Int | no | — | — | PK (auto) |
| email | String | no | yes | — | login identifier |
| name | String | no | no | — | display name |
| bio | String | yes | no | — | optional profile text |
| role | String | no | no | `"AUTHOR"` | AUTHOR or ADMIN |
| createdAt | DateTime | no | no | `now()` | |
| updatedAt | DateTime | no | no | — | @updatedAt |

### Category
| Field | Type | Nullable | Unique | Default |
|---|---|---|---|---|
| id | Int | no | — | — |
| name | String | no | no | — |
| slug | String | no | no | — |
| description | String | yes | no | — |

### Tag
| Field | Type | Nullable | Unique | Default |
|---|---|---|---|---|
| id | Int | no | — | — |
| name | String | no | no | — |
| slug | String | no | no | — |

### Post
| Field | Type | Nullable | Unique | Default | Notes |
|---|---|---|---|---|---|
| id | Int | no | — | — | PK (auto) |
| title | String | no | no | — | |
| slug | String | no | no | — | URL-safe identifier |
| content | String | yes | no | — | Markdown body |
| excerpt | String | yes | no | — | Short preview |
| published | Boolean | no | no | `false` | |
| publishedAt | DateTime | yes | no | — | Set when published |
| createdAt | DateTime | no | no | `now()` | |
| updatedAt | DateTime | no | no | — | @updatedAt |

### Comment
| Field | Type | Nullable | Unique | Default |
|---|---|---|---|---|
| id | Int | no | — | — |
| body | String | no | no | — |
| approved | Boolean | no | no | `false` |
| createdAt | DateTime | no | no | `now()` |

### Media
| Field | Type | Nullable | Unique | Default |
|---|---|---|---|---|
| id | Int | no | — | — |
| url | String | no | no | — |
| alt | String | yes | no | — |
| type | String | no | no | `"IMAGE"` |
| size | Int | no | no | `0` |
| createdAt | DateTime | no | no | `now()` |

---

## Relations

FK fields are **auto-created** by the relations workflow — do not add them manually in fields.

| Source model | Relation field | Target | Back-ref | Auto FK | onDelete |
|---|---|---|---|---|---|
| `Post` | `author` | `User` | `posts` | `Post.authorId` | Cascade |
| `Comment` | `author` | `User` | `comments` | `Comment.userId` | Cascade |
| `Comment` | `post` | `Post` | `comments` | `Comment.postId` | Cascade |
| `Post` | `category` | `Category` | `posts` | `Post.categoryId` nullable | SetNull |
| `Post` | `featuredImage` | `Media` | `posts` | `Post.mediaId` nullable | SetNull |

---

## Restrictions

Model-level `@@unique` and `@@index` constraints added after relations are in place.

| Model | Type | Fields | Purpose |
|---|---|---|---|
| `User` | INDEX | `[name]` | Fast name search |
| `Post` | UNIQUE | `[slug]` | Ensure unique post URLs |
| `Post` | INDEX | `[published]` | Filter drafts vs published |
| `Category` | UNIQUE | `[slug]` | Ensure unique category URLs |
| `Tag` | UNIQUE | `[name]` | No duplicate tag names |
| `Comment` | INDEX | `[createdAt]` | Timeline / pagination queries |

---

## Running the scenario

```bash
# Terminal 1 — start the app
pnpm dev

# Terminal 2 — run all phases
pnpm seed:workflows
```

After the run, open the app and navigate to **Project Mock To Test** to explore the
fully generated schema in every workflow view.
