/**
 * Insert v1 mock data into a PostgreSQL database that already has the v1 schema deployed.
 *
 * Prerequisites:
 *   1. Run the scenario first:  pnpm seed:workflows saas-platform
 *   2. Open Migrations → connect to your database → "Destroy and Deploy Schema"
 *      → select version 1.0111 → confirm.
 *   3. Re-run this seeder.
 *
 * Usage:
 *   pnpm seed:db saas-platform postgresql://user:pass@host/db
 */

import { Client } from "pg";
import {
  organizations, users, workspaces, projects, tasks, comments, labels, attachments,
} from "../mocks/saas-platform/index.js";

const dataset = process.argv[2];
const urlArg  = process.argv[3];

if (!dataset || !urlArg) {
  console.error("Usage: pnpm seed:db <dataset> <postgres-url>");
  console.error("  e.g. pnpm seed:db saas-platform postgresql://dev:dev@localhost:54321/dev");
  process.exit(1);
}

if (dataset !== "saas-platform") {
  console.error(`Unknown dataset "${dataset}". This file handles: saas-platform`);
  process.exit(1);
}

const DB_URL = urlArg;

// camelCase keys → all-lowercase to match the @map("...") convention.
// e.g. orgId → orgid, workspaceId → workspaceid, createdAt → createdat
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
  console.log(`  ✓ ${table.padEnd(12)} ${rows.length} rows`);
}

async function checkTablesExist(client: Client): Promise<boolean> {
  const res = await client.query<{ count: string }>(
    `SELECT count(*) FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'Organization'`,
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
    5. Re-run: pnpm seed:db saas-platform <url>
`);
      process.exit(1);
    }

    console.log("Inserting mock data…\n");

    // FK-safe insertion order: parents before children
    await insertAll(client, "Organization", organizations.map(toLower));
    await insertAll(client, "User",         users.map(toLower));
    await insertAll(client, "Workspace",    workspaces.map(toLower));
    await insertAll(client, "Label",        labels.map(toLower));
    await insertAll(client, "Project",      projects.map(toLower));
    await insertAll(client, "Task",         tasks.map(toLower));
    await insertAll(client, "Comment",      comments.map(toLower));
    await insertAll(client, "Attachment",   attachments.map(toLower));

    const total = organizations.length + users.length + workspaces.length + labels.length
      + projects.length + tasks.length + comments.length + attachments.length;

    console.log(`\n✓ Done — ${total} rows inserted.`);
    console.log(`
Next steps:
  1. Open the app → Migrations → "Sync and Migrate to Another Version"
  2. Sync version: 1.0111  →  Target version: 1.0112
  3. Stage 2 will show 6 errors:
       User     — 2 rows with score = null  (Bob Smith, Dave Lee)
       Comment  — 4 rows with rating = null (comments 1, 3, 5, 7)
  4. Use Fix Modal to set values, then re-run.
`);
  } finally {
    await client.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
