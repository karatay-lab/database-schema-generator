# Contributing to Schema Studio

Thank you for your interest in contributing. This document covers everything you need to get started.

## Table of Contents

- [Development Setup](#development-setup)
- [Branch Strategy](#branch-strategy)
- [Commit Conventions](#commit-conventions)
- [Pull Requests](#pull-requests)
- [Versioning & Releases](#versioning--releases)

---

## Development Setup

```bash
git clone https://github.com/karatay-lab/database-schema-generator.git
cd database-schema-generator
pnpm install
cp .env.example .env
pnpm db:push
pnpm dev
```

Run the linter before pushing:

```bash
pnpm lint
pnpm build   # confirm no type errors
```

---

## Branch Strategy

| Branch | Purpose |
|---|---|
| `main` | Stable, releasable code. Protected — no direct pushes. |
| `feature/<scope>` | New features |
| `fix/<scope>` | Bug fixes |
| `chore/<scope>` | Tooling, deps, docs, refactors with no behaviour change |

Branch off `main`, open a PR back into `main`.

---

## Commit Conventions

We follow [Conventional Commits](https://www.conventionalcommits.org/).

```
<type>(<scope>): <short summary>

[optional body]

[optional footer — Co-Authored-By, Closes #issue, etc.]
```

### Types

| Type | When to use |
|---|---|
| `feat` | A new user-facing feature |
| `fix` | A bug fix |
| `refactor` | Code change with no feature or bug impact |
| `chore` | Tooling, deps, config, docs, cleanup |
| `perf` | Performance improvement |
| `test` | Adding or updating tests |
| `ci` | CI/CD pipeline changes |

### Scopes

Use the workflow or layer name: `relations`, `schema`, `migrations`, `shell`, `trpc`, `db`, `ux`, etc.

### Examples

```
feat(relations): add inline FK column creation to create-relation modal
fix(schema): prevent duplicate field names on blur normalization
chore: update pnpm lockfile after dependency bump
ci: add lint and build checks to PR workflow
```

---

## Pull Requests

- Keep PRs focused — one feature or fix per PR
- Fill in the PR template checklist
- Link related issues with `Closes #N`
- All CI checks must pass before merge
- At least one review required for `main`

---

## Versioning & Releases

Schema Studio uses [Semantic Versioning](https://semver.org/):

- **MAJOR** (`v2.0.0`) — breaking changes to the data layer or public API
- **MINOR** (`v1.1.0`) — new backwards-compatible features
- **PATCH** (`v1.0.1`) — bug fixes and minor improvements

### Creating a Release

1. Update `CHANGELOG.md` under `[Unreleased]` with the release version and date
2. Bump the version in `package.json`
3. Commit: `chore(release): bump version to v1.1.0`
4. Tag: `git tag v1.1.0 -m "v1.1.0"`
5. Push tag: `git push origin v1.1.0`

The `release.yml` CI workflow picks up the tag, generates release notes from the tag message and CHANGELOG, and publishes a GitHub Release automatically.
