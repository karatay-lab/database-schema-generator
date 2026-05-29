/**
 * Insert v1 mock data into a MySQL database that already has the v1 schema deployed.
 *
 * Prerequisites:
 *   1. Run the scenario first:  pnpm seed:workflows shop-mysql
 *   2. Open Migrations → connect to your MySQL database → "Destroy and Deploy Schema"
 *      → select version 1.0111 → confirm.
 *   3. Re-run this seeder.
 *
 * Usage:
 *   pnpm seed:db shop-mysql mysql://user:pass@host:3306/db
 */

import mysql from "mysql2/promise";
import {
  categories, products, customers, orders, orderItems,
} from "../../mocks/shop-mysql/index.js";

const dataset = process.argv[2];
const urlArg  = process.argv[3];

if (!dataset || !urlArg) {
  console.error("Usage: pnpm seed:db <dataset> <mysql-url>");
  console.error("  e.g. pnpm seed:db shop-mysql mysql://dev:dev@localhost:3306/dev");
  process.exit(1);
}

if (dataset !== "shop-mysql") {
  console.error(`Unknown dataset "${dataset}". This file handles: shop-mysql`);
  process.exit(1);
}

// camelCase keys → all-lowercase to match @map("...") convention.
function toLower<T extends Record<string, unknown>>(row: T): Record<string, unknown> {
  return Object.fromEntries(Object.entries(row).map(([k, v]) => [k.toLowerCase(), v]));
}

async function insertAll(
  conn: mysql.Connection,
  table: string,
  rows: Record<string, unknown>[],
): Promise<void> {
  for (const row of rows) {
    const cols = Object.keys(row);
    const vals = Object.values(row);
    const colList = cols.map((c) => `\`${c}\``).join(", ");
    const placeholders = cols.map(() => "?").join(", ");
    await conn.execute(
      `INSERT IGNORE INTO \`${table}\` (${colList}) VALUES (${placeholders})`,
      vals,
    );
  }
  console.log(`  ✓ ${table.padEnd(12)} ${rows.length} rows`);
}

async function checkTablesExist(conn: mysql.Connection): Promise<boolean> {
  const [rows] = await conn.execute<mysql.RowDataPacket[]>(
    `SELECT COUNT(*) AS cnt FROM information_schema.tables
     WHERE table_schema = DATABASE() AND table_name = 'Category'`,
  );
  return (rows[0]?.cnt ?? 0) > 0;
}

async function main() {
  console.log(`\nConnecting to ${urlArg} …`);
  const conn = await mysql.createConnection(urlArg);

  try {
    const tablesExist = await checkTablesExist(conn);
    if (!tablesExist) {
      console.error(`
  ✗ Schema not found in database.

  Deploy the v1 schema first:
    1. Open the app → Migrations
    2. Connect to this MySQL database
    3. Select "Destroy and Deploy Schema"
    4. Choose version 1.0111 and confirm
    5. Re-run: pnpm seed:db shop-mysql <url>
`);
      process.exit(1);
    }

    console.log("Inserting mock data…\n");

    // FK-safe insertion order: parents before children
    await insertAll(conn, "Category",  categories.map(toLower));
    await insertAll(conn, "Customer",  customers.map(toLower));
    await insertAll(conn, "Product",   products.map(toLower));
    await insertAll(conn, "Order",     orders.map(toLower));
    await insertAll(conn, "OrderItem", orderItems.map(toLower));

    const total = categories.length + customers.length + products.length
      + orders.length + orderItems.length;

    console.log(`\n✓ Done — ${total} rows inserted.`);
    console.log(`
Next steps:
  1. Open the app → Migrations → "Sync and Migrate to Another Version"
  2. Sync version: 1.0111  →  Target version: <v2 version>
  3. Stage 2 should pass cleanly (no Zod errors expected).
     Upgrade warning only: Order.status String → OrderStatus
     (all seeded values are valid enum members).
`);
  } finally {
    await conn.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
