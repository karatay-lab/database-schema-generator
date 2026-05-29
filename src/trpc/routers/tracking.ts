import { z } from "zod";
import { db } from "@/lib/db/client";
import { getWarnings } from "@/lib/schema-warnings-store";
import { baseProcedure, createTRPCRouter } from "../init";
import {
  formatDefault,
  type DefaultChange,
  type DefaultChangeKind,
  type TrackingEntry,
} from "@/lib/tracking-utils";

export type { DefaultChange, DefaultChangeKind, TrackingEntry };
export { formatDefault };

// resolution → severity order for sorting (lower = higher priority)
function resolutionOrder(resolution: string, approvedAt: string | null): number {
  if (approvedAt) return 4;
  if (resolution === "data_deleted") return 0;
  if (resolution === "lossy_convert" || resolution === "precision_loss" || resolution === "backfill_required") return 1;
  return 2; // safe / info
}

type VersionRow = { id: number; name: string };

// ─── field default diff ───────────────────────────────────────────────────────

type FieldDiffRow = {
  table_name: string;
  field_name: string;
  field_id: string;
  from_kind: string;
  from_value: string;
  to_kind: string;
  to_value: string;
};

function classifyDefault(fromKind: string, toKind: string): DefaultChangeKind {
  if (fromKind === "none" && toKind !== "none") return "added";
  if (fromKind !== "none" && toKind === "none") return "removed";
  return "changed";
}

function fieldEntries(fromVer: VersionRow, toVer: VersionRow): TrackingEntry[] {
  const rows = db
    .prepare(
      `SELECT
         st_from.name           AS table_name,
         sf_from.name           AS field_name,
         sf_from.field_id       AS field_id,
         sf_from.default_kind   AS from_kind,
         sf_from.default_value  AS from_value,
         sf_to.default_kind     AS to_kind,
         sf_to.default_value    AS to_value
       FROM schema_fields sf_from
       JOIN schema_tables st_from ON sf_from.table_id = st_from.id
       JOIN schema_tables st_to
         ON st_to.version_id = ? AND st_to.name = st_from.name
       JOIN schema_fields sf_to
         ON sf_to.table_id = st_to.id AND sf_to.field_id = sf_from.field_id
       WHERE st_from.version_id = ?
         AND (sf_from.default_kind != sf_to.default_kind
              OR sf_from.default_value != sf_to.default_value)
       ORDER BY st_from.name, sf_from.name`,
    )
    .all(toVer.id, fromVer.id) as FieldDiffRow[];

  return rows.map((row) => ({
    fromVersion: fromVer.name,
    toVersion: toVer.name,
    entityKind: "field_default",
    entityName: row.table_name,
    subName: row.field_name,
    changeKind: classifyDefault(row.from_kind, row.to_kind),
    fromDisplay: formatDefault(row.from_kind, row.from_value),
    toDisplay: formatDefault(row.to_kind, row.to_value),
  }));
}

// ─── enum diff ────────────────────────────────────────────────────────────────

type EnumRow = { enum_key: string; enum_name: string };
type EnumValueRow = { enum_key: string; enum_name: string; value_key: string; value_name: string };

function enumEntries(fromVer: VersionRow, toVer: VersionRow): TrackingEntry[] {
  const entries: TrackingEntry[] = [];

  // whole-enum added (in to, not in from)
  const added = db
    .prepare(
      `SELECT se.enum_key, se.name AS enum_name
       FROM schema_enums se
       WHERE se.version_id = ?
         AND NOT EXISTS (
           SELECT 1 FROM schema_enums se2
           WHERE se2.version_id = ? AND se2.enum_key = se.enum_key
         )
       ORDER BY se.name`,
    )
    .all(toVer.id, fromVer.id) as EnumRow[];
  for (const r of added) {
    entries.push({
      fromVersion: fromVer.name, toVersion: toVer.name,
      entityKind: "enum", entityName: r.enum_name, subName: null,
      changeKind: "added", fromDisplay: "—", toDisplay: r.enum_name,
    });
  }

  // whole-enum removed (in from, not in to)
  const removed = db
    .prepare(
      `SELECT se.enum_key, se.name AS enum_name
       FROM schema_enums se
       WHERE se.version_id = ?
         AND NOT EXISTS (
           SELECT 1 FROM schema_enums se2
           WHERE se2.version_id = ? AND se2.enum_key = se.enum_key
         )
       ORDER BY se.name`,
    )
    .all(fromVer.id, toVer.id) as EnumRow[];
  for (const r of removed) {
    entries.push({
      fromVersion: fromVer.name, toVersion: toVer.name,
      entityKind: "enum", entityName: r.enum_name, subName: null,
      changeKind: "removed", fromDisplay: r.enum_name, toDisplay: "—",
    });
  }

  // enum renamed (same enum_key, different name)
  type RenameRow = { from_name: string; to_name: string };
  const renamed = db
    .prepare(
      `SELECT se_from.name AS from_name, se_to.name AS to_name
       FROM schema_enums se_from
       JOIN schema_enums se_to
         ON se_to.version_id = ? AND se_to.enum_key = se_from.enum_key
       WHERE se_from.version_id = ?
         AND se_from.name != se_to.name
       ORDER BY se_from.name`,
    )
    .all(toVer.id, fromVer.id) as RenameRow[];
  for (const r of renamed) {
    entries.push({
      fromVersion: fromVer.name, toVersion: toVer.name,
      entityKind: "enum", entityName: r.to_name, subName: null,
      changeKind: "renamed", fromDisplay: r.from_name, toDisplay: r.to_name,
    });
  }

  // value added (in to enum, not in from enum — matched by value_key within matching enum)
  const valAdded = db
    .prepare(
      `SELECT se_to.name AS enum_name, se_to.enum_key, sev.value_key, sev.name AS value_name
       FROM schema_enum_values sev
       JOIN schema_enums se_to ON sev.enum_id = se_to.id AND se_to.version_id = ?
       WHERE EXISTS (
         SELECT 1 FROM schema_enums se_from
         WHERE se_from.version_id = ? AND se_from.enum_key = se_to.enum_key
       )
       AND NOT EXISTS (
         SELECT 1 FROM schema_enum_values sev2
         JOIN schema_enums se_from ON sev2.enum_id = se_from.id AND se_from.version_id = ?
         WHERE se_from.enum_key = se_to.enum_key AND sev2.value_key = sev.value_key
       )
       ORDER BY se_to.name, sev.name`,
    )
    .all(toVer.id, fromVer.id, fromVer.id) as EnumValueRow[];
  for (const r of valAdded) {
    entries.push({
      fromVersion: fromVer.name, toVersion: toVer.name,
      entityKind: "enum_value", entityName: r.enum_name, subName: r.value_name,
      changeKind: "value_added", fromDisplay: "—", toDisplay: r.value_name,
    });
  }

  // value removed (in from enum, not in to enum)
  const valRemoved = db
    .prepare(
      `SELECT se_from.name AS enum_name, se_from.enum_key, sev.value_key, sev.name AS value_name
       FROM schema_enum_values sev
       JOIN schema_enums se_from ON sev.enum_id = se_from.id AND se_from.version_id = ?
       WHERE EXISTS (
         SELECT 1 FROM schema_enums se_to
         WHERE se_to.version_id = ? AND se_to.enum_key = se_from.enum_key
       )
       AND NOT EXISTS (
         SELECT 1 FROM schema_enum_values sev2
         JOIN schema_enums se_to ON sev2.enum_id = se_to.id AND se_to.version_id = ?
         WHERE se_to.enum_key = se_from.enum_key AND sev2.value_key = sev.value_key
       )
       ORDER BY se_from.name, sev.name`,
    )
    .all(fromVer.id, toVer.id, toVer.id) as EnumValueRow[];
  for (const r of valRemoved) {
    entries.push({
      fromVersion: fromVer.name, toVersion: toVer.name,
      entityKind: "enum_value", entityName: r.enum_name, subName: r.value_name,
      changeKind: "value_removed", fromDisplay: r.value_name, toDisplay: "—",
    });
  }

  return entries;
}

// ─── router ───────────────────────────────────────────────────────────────────

export const trackingRouter = createTRPCRouter({
  // Sorted warnings for a specific entity kind + version pair.
  // Includes enumValuesMap (target version enum name → values) for replacement pickers.
  warningsByKind: baseProcedure
    .input(z.object({
      projectId: z.string(),
      fromVersion: z.string(),
      toVersion: z.string(),
      entityKind: z.enum(["table", "field", "enum", "relation", "restriction"]),
    }))
    .query(({ input }) => {
      const all = getWarnings(input.projectId, input.fromVersion, input.toVersion);
      const filtered = all
        .filter((w) => w.entityKind === input.entityKind)
        .sort((a, b) =>
          resolutionOrder(a.resolution, a.approvedAt) -
          resolutionOrder(b.resolution, b.approvedAt),
        );

      // Build enumValuesMap from target version for replacement pickers
      const enumValuesMap: Record<string, string[]> = {};
      if (input.entityKind === "enum") {
        type Row = { enum_name: string; value_name: string };
        const pidRow = db
          .prepare("SELECT id FROM projects WHERE id = ?")
          .get(input.projectId) as { id: string } | undefined;
        if (pidRow) {
          const rows = db
            .prepare(
              `SELECT se.name AS enum_name, sev.name AS value_name
               FROM schema_enum_values sev
               JOIN schema_enums se ON sev.enum_id = se.id
               JOIN project_versions pv ON se.version_id = pv.id
               WHERE pv.project_id = ? AND pv.name = ?
               ORDER BY se.name, sev.sort_order`,
            )
            .all(input.projectId, input.toVersion) as Row[];
          for (const r of rows) {
            if (!enumValuesMap[r.enum_name]) enumValuesMap[r.enum_name] = [];
            enumValuesMap[r.enum_name]!.push(r.value_name);
          }
        }
      }

      return { warnings: filtered, enumValuesMap };
    }),

  // Pending count per entity kind — used for tab badges.
  pendingCounts: baseProcedure
    .input(z.object({ projectId: z.string(), fromVersion: z.string(), toVersion: z.string() }))
    .query(({ input }) => {
      type Row = { entity_kind: string; n: number };
      const rows = db
        .prepare(
          `SELECT entity_kind, COUNT(*) as n
           FROM schema_warnings
           WHERE project_id = ? AND from_version = ? AND to_version = ? AND approved_at IS NULL
           GROUP BY entity_kind`,
        )
        .all(input.projectId, input.fromVersion, input.toVersion) as Row[];
      const counts: Record<string, number> = {};
      for (const r of rows) counts[r.entity_kind] = r.n;
      return {
        table:    counts["table"]    ?? 0,
        field:    counts["field"]    ?? 0,
        enum:     counts["enum"]     ?? 0,
        relation: counts["relation"] ?? 0,
        total:    Object.values(counts).reduce((s, n) => s + n, 0),
      };
    }),

  allChanges: baseProcedure
    .input(z.object({ projectId: z.string() }))
    .query(({ input }) => {
      const versions = db
        .prepare(
          "SELECT id, name FROM project_versions WHERE project_id = ? ORDER BY sort_order ASC, id ASC",
        )
        .all(input.projectId) as VersionRow[];

      if (versions.length < 2) return { entries: [] as TrackingEntry[] };

      const entries: TrackingEntry[] = [];

      for (let i = 0; i < versions.length - 1; i++) {
        const fromVer = versions[i]!;
        const toVer = versions[i + 1]!;

        entries.push(...fieldEntries(fromVer, toVer));
        entries.push(...enumEntries(fromVer, toVer));
      }

      return { entries };
    }),
});
