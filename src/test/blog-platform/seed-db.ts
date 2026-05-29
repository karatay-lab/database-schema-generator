/**
 * Insert v1 mock data into a PostgreSQL database that already has the schema deployed.
 *
 * Prerequisites:
 *   1. Deploy the v1 schema first — open the Migrations UI, connect to your database,
 *      select "Destroy and Deploy Schema", choose version 1.0111, and confirm.
 *   2. The database must have the tables created by that deploy.
 *
 * Usage:
 *   pnpm seed:db blog-platform postgresql://user:pass@host/db
 */

import { Client } from "pg";
import {
  users, categories, tags, media, posts, comments,
} from "../mocks/blog-platform/index.js";

const dataset = process.argv[2];
const urlArg  = process.argv[3];

if (!dataset || !urlArg) {
  console.error("Usage: pnpm seed:db <dataset> <postgres-url>");
  console.error("  e.g. pnpm seed:db blog-platform postgresql://dev:dev@localhost:54321/dev");
  process.exit(1);
}

if (dataset !== "blog-platform") {
  console.error(`Unknown dataset "${dataset}". Available: blog-platform`);
  process.exit(1);
}

const DB_URL = urlArg;

// camelCase keys → all-lowercase to match the @map("...") convention in this project's schemas.
// e.g. createdAt → createdat, authorId → authorid, publishedAt → publishedat
function toLower<T extends Record<string, unknown>>(row: T): Record<string, unknown> {
  return Object.fromEntries(Object.entries(row).map(([k, v]) => [k.toLowerCase(), v]));
}

async function insertAll(
  client: Client,
  table: string,
  rows: Record<string, unknown>[],
): Promise<void> {
  for (const row of rows) {
    const cols = Object.keys(row);
    const vals = Object.values(row);
    const colList = cols.map((c) => `"${c}"`).join(", ");
    const placeholders = cols.map((_, i) => `$${i + 1}`).join(", ");
    await client.query(
      `INSERT INTO "${table}" (${colList}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
      vals,
    );
  }
  console.log(`  ✓ ${table.padEnd(10)} ${rows.length} rows`);
}

async function checkTablesExist(client: Client): Promise<boolean> {
  const res = await client.query<{ count: string }>(
    `SELECT count(*) FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'User'`,
  );
  return parseInt(res.rows[0]?.count ?? "0") > 0;
}

async function main() {
  console.log(`\nConnecting to ${DB_URL} …`);
  const client = new Client({ connectionString: DB_URL });
  await client.connect();

  try {
    const tablesExist = await checkTablesExist(client);
    if (!tablesExist) {
      console.error(`
  ✗ Schema not found in database.

  Deploy the v1 schema first:
    1. Open the app → Migrations
    2. Connect to this database
    3. Select "Destroy and Deploy Schema"
    4. Choose version 1.0111 and confirm
    5. Re-run: pnpm seed:db
`);
      process.exit(1);
    }

    console.log("Inserting mock data…\n");

    // FK-safe order: independent tables first, then dependents
    await insertAll(client, "User",     users.map(toLower));
    await insertAll(client, "Category", categories.map(toLower));
    await insertAll(client, "Tag",      tags.map(toLower));
    await insertAll(client, "Media",    media.map(toLower));
    await insertAll(client, "Post",     posts.map(toLower));
    await insertAll(client, "Comment",  comments.map(toLower));

    const total = users.length + categories.length + tags.length + media.length + posts.length + comments.length;
    console.log(`\n✓ Done — ${total} rows inserted.`);
    console.log(`  Open Migrations → "Sync and Migrate to Another Version" → v1 → v2 to test the migration.\n`);
  } finally {
    await client.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
