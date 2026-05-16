import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { Client as PgClient } from "pg";
import mysql from "mysql2/promise";
import { allMockTables } from "../../mocks/tables";
import * as allMockData from "../../mocks/data";
import type { Project } from "../projects/types";

const ROOT_DIR = join(__dirname, "../../../../");
const EXPORTS_DIR = join(__dirname, "../../..", "exports");

// ─── DB config per project ────────────────────────────────────────────────────

type DbConfig = {
  provider: "postgresql" | "mysql";
  prismaUrl: string; // URL for prisma db push (includes ?schema= for PG)
  insertUrl: string; // URL for the native client (no ?schema=)
  schema?: string;   // PostgreSQL schema to SET search_path on
};

const PROJECT_DB: Record<string, DbConfig> = {
  "Analytics Engine": {
    provider: "mysql",
    prismaUrl: process.env.MYSQL_URL ?? "mysql://dev:dev@localhost:54322/dev",
    insertUrl: process.env.MYSQL_URL ?? "mysql://dev:dev@localhost:54322/dev",
  },
  "Content Hub Pro": {
    provider: "postgresql",
    prismaUrl: process.env.CONTENT_HUB_URL ?? "postgresql://dev:dev@localhost:54321/dev?schema=content_hub",
    insertUrl: process.env.POSTGRES_URL ?? "postgresql://dev:dev@localhost:54321/dev",
    schema: "content_hub",
  },
  "Shopfront Manager": {
    provider: "postgresql",
    prismaUrl: process.env.SHOPFRONT_URL ?? "postgresql://dev:dev@localhost:54321/dev?schema=shopfront",
    insertUrl: process.env.POSTGRES_URL ?? "postgresql://dev:dev@localhost:54321/dev",
    schema: "shopfront",
  },
};

// ─── mock data registry: project name → { dbName → rows[] } ──────────────────

const MOCK_DATA_BY_PROJECT: Record<string, Record<string, readonly unknown[]>> = {
  "Analytics Engine": {
    users:        allMockData.analyticsEngine.v1.users,
    sessions:     allMockData.analyticsEngine.v1.sessions,
    events:       allMockData.analyticsEngine.v1.events,
    properties:   allMockData.analyticsEngine.v1.properties,
    funnels:      allMockData.analyticsEngine.v1.funnels,
    funnel_steps: allMockData.analyticsEngine.v1.funnelSteps,
    data_sources: allMockData.analyticsEngine.v1.dataSources,
    dashboards:   allMockData.analyticsEngine.v1.dashboards,
    widgets:      allMockData.analyticsEngine.v1.widgets,
    reports:      allMockData.analyticsEngine.v1.reports,
  },
  "Content Hub Pro": {
    authors:    allMockData.contentHubPro.v1.authors,
    posts:      allMockData.contentHubPro.v1.posts,
    revisions:  allMockData.contentHubPro.v1.revisions,
    categories: allMockData.contentHubPro.v1.categories,
    tags:       allMockData.contentHubPro.v1.tags,
    media:      allMockData.contentHubPro.v1.media,
    comments:   allMockData.contentHubPro.v1.comments,
    pages:      allMockData.contentHubPro.v1.pages,
    menus:      allMockData.contentHubPro.v1.menus,
    menu_items: allMockData.contentHubPro.v1.menuItems,
  },
  "Shopfront Manager": {
    products:    allMockData.shopfrontManager.v1.products,
    categories:  allMockData.shopfrontManager.v1.categories,
    customers:   allMockData.shopfrontManager.v1.customers,
    addresses:   allMockData.shopfrontManager.v1.addresses,
    carts:       allMockData.shopfrontManager.v1.carts,
    cart_items:  allMockData.shopfrontManager.v1.cartItems,
    orders:      allMockData.shopfrontManager.v1.orders,
    order_items: allMockData.shopfrontManager.v1.orderItems,
    payments:    allMockData.shopfrontManager.v1.payments,
    reviews:     allMockData.shopfrontManager.v1.reviews,
  },
};

// ─── helpers ──────────────────────────────────────────────────────────────────

function toSlug(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
}

function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

function isIsoDateString(v: unknown): v is string {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(v);
}

function convertRow(
  row: Record<string, unknown>,
  provider: "postgresql" | "mysql",
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    const col = camelToSnake(k);
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      // JSON objects → stringify for both providers
      out[col] = JSON.stringify(v);
    } else if (provider === "mysql" && typeof v === "boolean") {
      // MySQL TinyInt: true → 1, false → 0
      out[col] = v ? 1 : 0;
    } else if (provider === "mysql" && isIsoDateString(v)) {
      // MySQL DateTime: "2024-01-05T08:00:00.000Z" → "2024-01-05 08:00:00"
      out[col] = v.replace("T", " ").slice(0, 19);
    } else {
      out[col] = v;
    }
  }
  return out;
}

function pushSchema(url: string, schemaPath: string): void {
  execFileSync(
    "pnpm",
    ["prisma", "db", "push", "--force-reset", "--schema", schemaPath, "--url", url],
    {
      cwd: ROOT_DIR,
      stdio: "pipe",
    },
  );
}

// ─── insert helpers ───────────────────────────────────────────────────────────

async function insertPostgres(
  client: PgClient,
  tableName: string,
  rows: Record<string, unknown>[],
): Promise<void> {
  if (rows.length === 0) return;
  const converted = rows.map((r) => convertRow(r, "postgresql"));
  const cols = Object.keys(converted[0]!);
  const colsSql = cols.map((c) => `"${c}"`).join(", ");
  for (const row of converted) {
    const vals = cols.map((c) => row[c]);
    const ph = cols.map((_, i) => `$${i + 1}`).join(", ");
    await client.query(
      `INSERT INTO "${tableName}" (${colsSql}) VALUES (${ph}) ON CONFLICT DO NOTHING`,
      vals,
    );
  }
}

async function insertMysql(
  conn: mysql.Connection,
  tableName: string,
  rows: Record<string, unknown>[],
): Promise<void> {
  if (rows.length === 0) return;
  const converted = rows.map((r) => convertRow(r, "mysql"));
  const cols = Object.keys(converted[0]!);
  const colsSql = cols.map((c) => `\`${c}\``).join(", ");
  const ph = cols.map(() => "?").join(", ");
  for (const row of converted) {
    const vals = cols.map((c) => row[c] ?? null);
    await conn.execute(
      `INSERT IGNORE INTO \`${tableName}\` (${colsSql}) VALUES (${ph})`,
      vals,
    );
  }
}

// ─── public ───────────────────────────────────────────────────────────────────

export async function simulateMockData(projects: Project[]): Promise<void> {
  for (const project of projects) {
    const dbConfig = PROJECT_DB[project.name];
    const tableDefs = allMockTables[project.name];
    const projectData = MOCK_DATA_BY_PROJECT[project.name];
    if (!dbConfig || !tableDefs || !projectData) continue;

    const v1Version = project.versions.find((v) => v.minor === 111);
    if (!v1Version) continue;

    const slug = toSlug(project.name);
    const schemaPath = join(EXPORTS_DIR, `${slug}-${v1Version.name}.prisma`);

    console.log(
      `\n── mock data: ${project.name} (${dbConfig.provider}) ${"─".repeat(Math.max(0, 40 - project.name.length))}`,
    );

    // 1. Push v1 schema (force-reset creates a clean slate)
    console.log(`  [schema]  ${slug}-${v1Version.name}.prisma → pushing...`);
    try {
      pushSchema(dbConfig.prismaUrl, schemaPath);
      console.log(`  [schema]  ✓ pushed`);
    } catch (e) {
      const err = e as { stderr?: Buffer; stdout?: Buffer; message?: string };
      const detail = [err.stderr?.toString().trim(), err.stdout?.toString().trim(), err.message]
        .filter(Boolean)
        .join("\n");
      console.error(`  [schema]  ✗ failed:\n${detail}`);
      continue;
    }

    // 2. Insert v1 rows
    try {
      if (dbConfig.provider === "postgresql") {
        const client = new PgClient({ connectionString: dbConfig.insertUrl });
        await client.connect();
        try {
          if (dbConfig.schema) {
            await client.query(`SET search_path = "${dbConfig.schema}"`);
          }
          for (const def of tableDefs) {
            const rows = (projectData[def.dbName] ?? []) as Record<string, unknown>[];
            await insertPostgres(client, def.dbName, rows);
            console.log(`  [insert]  ${def.name.padEnd(16)} (${def.dbName}) → ${rows.length} rows`);
          }
        } finally {
          await client.end();
        }
      } else {
        const conn = await mysql.createConnection(dbConfig.insertUrl);
        try {
          await conn.query("SET FOREIGN_KEY_CHECKS=0");
          for (const def of tableDefs) {
            const rows = (projectData[def.dbName] ?? []) as Record<string, unknown>[];
            await insertMysql(conn, def.dbName, rows);
            console.log(`  [insert]  ${def.name.padEnd(16)} (${def.dbName}) → ${rows.length} rows`);
          }
          await conn.query("SET FOREIGN_KEY_CHECKS=1");
        } finally {
          await conn.end();
        }
      }
    } catch (e) {
      console.error(`  [insert]  ✗ failed: ${(e as Error).message}`);
    }
  }
}
