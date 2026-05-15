import Database from "better-sqlite3";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database(path.join(__dirname, "../database/app.db"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

const insert = db.prepare(`
  INSERT OR IGNORE INTO field_templates
    (id, name, type, nullable, unique_field, default_value, comment,
     native_attribute, updated_at_attribute, is_id, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const templates = [
  { id: "field-crypt-key", name: "cryptKey", type: "String", nullable: 1, unique: 0, defaultValue: "", comment: "", native: { name: "VarChar", args: [] }, updatedAt: 0, isId: 0 },
  { id: "field-ref-id", name: "refId", type: "String", nullable: 1, unique: 0, defaultValue: "", comment: "", native: { name: "VarChar", args: ["100"] }, updatedAt: 0, isId: 0 },
  { id: "field-ref-int", name: "refInt", type: "Int", nullable: 1, unique: 0, defaultValue: "", comment: "", native: null, updatedAt: 0, isId: 0 },
  { id: "field-replication-id", name: "replicationId", type: "Int", nullable: 0, unique: 0, defaultValue: "0", comment: "", native: { name: "SmallInt", args: [] }, updatedAt: 0, isId: 0 },
  { id: "field-created-credentials-token", name: "createdCredentialsToken", type: "String", nullable: 1, unique: 0, defaultValue: "", comment: "", native: { name: "VarChar", args: [] }, updatedAt: 0, isId: 0 },
  { id: "field-updated-credentials-token", name: "updatedCredentialsToken", type: "String", nullable: 1, unique: 0, defaultValue: "", comment: "", native: { name: "VarChar", args: [] }, updatedAt: 0, isId: 0 },
  { id: "field-confirmed-credentials-token", name: "confirmedCredentialsToken", type: "String", nullable: 1, unique: 0, defaultValue: "", comment: "", native: { name: "VarChar", args: [] }, updatedAt: 0, isId: 0 },
  { id: "field-is-confirmed", name: "isConfirmed", type: "Boolean", nullable: 0, unique: 0, defaultValue: "false", comment: "", native: null, updatedAt: 0, isId: 0 },
  { id: "field-is-deleted", name: "isDeleted", type: "Boolean", nullable: 0, unique: 0, defaultValue: "false", comment: "", native: null, updatedAt: 0, isId: 0 },
  { id: "field-is-active", name: "isActive", type: "Boolean", nullable: 0, unique: 0, defaultValue: "true", comment: "", native: null, updatedAt: 0, isId: 0 },
  { id: "field-is-notification-sent", name: "isNotificationSent", type: "Boolean", nullable: 0, unique: 0, defaultValue: "false", comment: "", native: null, updatedAt: 0, isId: 0 },
  { id: "field-is-email-sent", name: "isEmailSent", type: "Boolean", nullable: 0, unique: 0, defaultValue: "false", comment: "", native: null, updatedAt: 0, isId: 0 },
  { id: "field-progress", name: "progress", type: "String", nullable: 0, unique: 0, defaultValue: '"Completed"', comment: "", native: null, updatedAt: 0, isId: 0 },
  { id: "field-expiry-starts", name: "expiryStarts", type: "DateTime", nullable: 0, unique: 0, defaultValue: "now()", comment: "", native: { name: "Timestamptz", args: ["6"] }, updatedAt: 0, isId: 0 },
  { id: "field-expiry-ends", name: "expiryEnds", type: "DateTime", nullable: 0, unique: 0, defaultValue: "dbgenerated(\"'2099-12-31 00:00:00+00'::timestamp with time zone\")", comment: "", native: { name: "Timestamptz", args: ["6"] }, updatedAt: 0, isId: 0 },
  { id: "field-created-at", name: "createdAt", type: "DateTime", nullable: 0, unique: 0, defaultValue: "now()", comment: "", native: { name: "Timestamptz", args: ["6"] }, updatedAt: 0, isId: 0 },
  { id: "field-updated-at", name: "updatedAt", type: "DateTime", nullable: 0, unique: 0, defaultValue: "", comment: "", native: { name: "Timestamptz", args: ["6"] }, updatedAt: 1, isId: 0 },
];

const seed = db.transaction(() => {
  let count = 0;
  for (const t of templates) {
    insert.run(
      t.id, t.name, t.type,
      t.nullable, t.unique,
      t.defaultValue, t.comment,
      t.native ? JSON.stringify(t.native) : null,
      t.updatedAt, t.isId,
      "2026-05-05T00:00:00.000Z",
      "2026-05-05T00:00:00.000Z",
    );
    count++;
  }
  return count;
});

const inserted = seed();
console.log(`Seeded ${inserted} field templates into app.db`);
db.close();
