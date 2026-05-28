import { z } from "zod";
import { db } from "@/lib/db/client";
import { baseProcedure, createTRPCRouter } from "../init";
import { formatDefault, type DefaultChange, type DefaultChangeKind } from "@/lib/tracking-utils";

export type { DefaultChange, DefaultChangeKind };
export { formatDefault };

type VersionRow = { id: number; name: string };

type FieldDiffRow = {
  table_name: string;
  field_name: string;
  field_id: string;
  from_kind: string;
  from_value: string;
  to_kind: string;
  to_value: string;
};

function classifyChange(fromKind: string, toKind: string): DefaultChangeKind {
  if (fromKind === "none" && toKind !== "none") return "added";
  if (fromKind !== "none" && toKind === "none") return "removed";
  return "changed";
}

export const trackingRouter = createTRPCRouter({
  defaultChanges: baseProcedure
    .input(z.object({ projectId: z.string() }))
    .query(({ input }) => {
      const versions = db
        .prepare(
          "SELECT id, name FROM project_versions WHERE project_id = ? ORDER BY sort_order ASC, id ASC",
        )
        .all(input.projectId) as VersionRow[];

      if (versions.length < 2) return { changes: [] as DefaultChange[] };

      const changes: DefaultChange[] = [];

      for (let i = 0; i < versions.length - 1; i++) {
        const fromVer = versions[i]!;
        const toVer = versions[i + 1]!;

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

        for (const row of rows) {
          changes.push({
            fromVersion: fromVer.name,
            toVersion: toVer.name,
            tableName: row.table_name,
            fieldName: row.field_name,
            fieldId: row.field_id,
            fromKind: row.from_kind,
            fromValue: row.from_value,
            toKind: row.to_kind,
            toValue: row.to_value,
            changeType: classifyChange(row.from_kind, row.to_kind),
          });
        }
      }

      return { changes };
    }),
});
