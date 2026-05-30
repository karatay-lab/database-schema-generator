import { randomUUID } from "node:crypto";
import type { FieldContext, FieldDecision, FieldResolution } from "./types";

// ─── Backfill required ────────────────────────────────────────────────────────
// Handles two cases:
//   1. "added" — new required field with no default; existing rows have no value
//   2. "nullability_changed" — optional→required; existing NULL rows need a value
//   3. "default_changed" — default removed from required field (existing rows already have values,
//      but new inserts will fail — client needs to ensure app code provides values)

export function backfillRequired(
  field: FieldContext,
  targetType: string,
  decision: FieldDecision,
): FieldResolution {
  switch (decision.type) {
    case "replacement_value":
      return coerceToTarget(decision.value, targetType, field.name);

    case "null_out":
      // Only valid if the target field was made optional (nullable)
      return field.nullable
        ? { ok: true, value: null }
        : { ok: false, error: `Field "${field.name}" is required — cannot backfill with NULL` };

    case "drop":
      return { ok: true, skip: true };

    case "db_generate":
      // Field has @default(...) — omit from INSERT, DB fills it
      return { ok: true, skip: true };

    case "auto_cast":
    case "pending":
      // No value and no decision → generate a type-safe placeholder
      // This is only reached if migration runs without a client decision (shouldn't happen
      // once the gate blocks migration until backfill values are set)
      return { ok: true, value: generatePlaceholder(targetType, field.name) };
  }
}

// ─── Nullable → Required (existing NULL rows) ─────────────────────────────────
// Checks whether a specific row value is NULL and applies the backfill decision.

export function backfillNullRow(
  raw: unknown,
  field: FieldContext,
  targetType: string,
  decision: FieldDecision,
): FieldResolution {
  // Non-null values pass through untouched
  if (raw !== null && raw !== undefined) return { ok: true, value: raw };

  // NULL row — apply decision
  return backfillRequired(field, targetType, decision);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function coerceToTarget(value: string, targetType: string, fieldName: string): FieldResolution {
  switch (targetType) {
    case "Int":
    case "BigInt": {
      const n = parseInt(value, 10);
      return isNaN(n)
        ? { ok: false, error: `Backfill value "${value}" is not a valid ${targetType} for field "${fieldName}"` }
        : { ok: true, value: n };
    }
    case "Float":
    case "Decimal": {
      const f = parseFloat(value);
      return isNaN(f)
        ? { ok: false, error: `Backfill value "${value}" is not a valid ${targetType} for field "${fieldName}"` }
        : { ok: true, value: f };
    }
    case "Boolean": {
      const v = value.toLowerCase();
      if (v === "true" || v === "1") return { ok: true, value: true };
      if (v === "false" || v === "0") return { ok: true, value: false };
      return { ok: false, error: `Backfill value "${value}" is not a valid Boolean — use true/false/1/0` };
    }
    case "DateTime": {
      const d = new Date(value);
      return isNaN(d.getTime())
        ? { ok: false, error: `Backfill value "${value}" is not a valid date for field "${fieldName}"` }
        : { ok: true, value: d.toISOString() };
    }
    case "String":
    default:
      return { ok: true, value: value };
  }
}

function generatePlaceholder(targetType: string, fieldName: string): unknown {
  switch (targetType) {
    case "String":   return `${fieldName}-${randomUUID()}`;
    case "Int":
    case "BigInt":   return 0;
    case "Float":
    case "Decimal":  return 0.0;
    case "Boolean":  return false;
    case "DateTime": return new Date().toISOString();
    default:         return null;
  }
}
