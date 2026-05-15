# app-mech — Testing Generated Schemas

Run all commands from the **repo root**. Prisma is available there via pnpm.

Start the test databases first:

```bash
docker compose up -d
```

`DATABASE_URL` must be set as an environment variable — either inline or by exporting it first. The schema file's `datasource` block only needs the `provider`; the URL comes from the environment.

---

## Push a schema

```bash
DATABASE_URL=<connection-url> pnpm prisma db push --schema=./exports/<file>.prisma
```

## Reset and push (wipe all tables, recreate from scratch)

```bash
DATABASE_URL=<connection-url> pnpm prisma db push --force-reset --schema=./exports/<file>.prisma
```

---

## Per-project commands

### Shopfront Manager (PostgreSQL)

```bash
# push
DATABASE_URL=postgresql://dev:dev@localhost:54321/dev pnpm prisma db push --schema=./exports/shopfront-manager-1.0111.prisma

# reset
DATABASE_URL=postgresql://dev:dev@localhost:54321/dev pnpm prisma db push --force-reset --schema=./exports/shopfront-manager-1.0111.prisma
```

### Content Hub Pro (PostgreSQL)

```bash
# push
DATABASE_URL=postgresql://dev:dev@localhost:54321/dev pnpm prisma db push --schema=./exports/content-hub-pro-1.0111.prisma

# reset
DATABASE_URL=postgresql://dev:dev@localhost:54321/dev pnpm prisma db push --force-reset --schema=./exports/content-hub-pro-1.0111.prisma
```

### Analytics Engine (MySQL)

```bash
# push
DATABASE_URL=mysql://dev:dev@localhost:54322/dev pnpm prisma db push --schema=./exports/analytics-engine-1.0111.prisma

# reset
DATABASE_URL=mysql://dev:dev@localhost:54322/dev pnpm prisma db push --force-reset --schema=./exports/analytics-engine-1.0111.prisma
```

---

## Using .env instead of inline URLs

Export the variables from the root `.env` first, then run:

```bash
source .env

DATABASE_URL=$POSTGRES_URL pnpm prisma db push --force-reset --schema=./exports/shopfront-manager-1.0111.prisma
DATABASE_URL=$MYSQL_URL pnpm prisma db push --force-reset --schema=./exports/analytics-engine-1.0111.prisma
```
