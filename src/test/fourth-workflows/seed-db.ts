/**
 * Insert v1 mock data into a PostgreSQL database that already has the v1 schema deployed.
 *
 * Prerequisites:
 *   1. Run the scenario first:  pnpm seed:workflows fourth-workflows
 *   2. Open Migrations → connect to your PostgreSQL database → "Destroy and Deploy Schema"
 *      → select version 1.0111 → confirm.
 *   3. Re-run this seeder.
 *
 * Usage:
 *   pnpm seed:db fourth-workflows postgresql://dev:dev@localhost:54321/dev
 */

import { Client } from "pg";
import {
  customers, legacyLogs, invoices, coupons, products,
} from "../mocks/fourth-workflows/index.js";

const dataset = process.argv[2];
const urlArg  = process.argv[3];

if (!dataset || !urlArg) {
  console.error("Usage: pnpm seed:db <dataset> <postgres-url>");
  console.error("  e.g. pnpm seed:db fourth-workflows postgresql://dev:dev@localhost:54321/dev");
  process.exit(1);
}

if (dataset !== "fourth-workflows") {
  console.error(`Unknown dataset "${dataset}". This file handles: fourth-workflows`);
  process.exit(1);
}

const DB_URL = urlArg;

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

async function resetSequence(client: Client, table: string, col = "id"): Promise<void> {
  await client.query(
    `SELECT setval(pg_get_serial_sequence('"${table}"', '${col}'), COALESCE((SELECT MAX("${col}") FROM "${table}"), 0) + 1, false)`,
  );
}

async function checkTablesExist(client: Client): Promise<boolean> {
  const res = await client.query<{ count: string }>(
    `SELECT count(*) FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'Customer'`,
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
    2. Connect to this PostgreSQL database
    3. Select "Destroy and Deploy Schema"
    4. Choose version 1.0111 and confirm
    5. Re-run: pnpm seed:db fourth-workflows <url>
`);
      process.exit(1);
    }

    console.log("Inserting mock data…\n");

    // FK-safe insertion order: Customer first, then tables with FK → Customer
    await insertAll(client, "Customer",   customers.map(toLower));
    await insertAll(client, "LegacyLog",  legacyLogs.map(toLower));
    await insertAll(client, "Invoice",    invoices.map(toLower));
    await insertAll(client, "Coupon",     coupons.map(toLower));
    await insertAll(client, "Product",    products.map(toLower));

    // Reset sequences so future inserts don't conflict with the explicit IDs we inserted
    await resetSequence(client, "Customer");
    await resetSequence(client, "LegacyLog");
    await resetSequence(client, "Invoice");
    await resetSequence(client, "Coupon");
    await resetSequence(client, "Product");

    const total = customers.length + legacyLogs.length + invoices.length + coupons.length + products.length;
    console.log(`\n✓ Done — ${total} rows inserted.`);
    console.log(`
Next steps:
  1. Open the app → Migrations → Collect Data
  2. Sync version: 1.0111 → Target version: 1.0112
  3. Collect All Tables to snapshot the v1 data
`);
  } finally {
    await client.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
