import type { FieldContext, FieldDecision, FieldResolution } from "./types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function nullOrError(field: FieldContext, raw: unknown, targetType: string): FieldResolution {
  return field.nullable
    ? { ok: true, value: null }
    : { ok: false, error: `"${raw}" cannot be converted to ${targetType} and field "${field.name}" is required — enter a replacement value` };
}

// ─── String → Int ─────────────────────────────────────────────────────────────
// resolution: lossy_convert
// Only numeric strings survive. "gold" → client must provide a default.

export function stringToInt(raw: unknown, field: FieldContext, decision: FieldDecision): FieldResolution {
  switch (decision.type) {
    case "replacement_value": {
      const n = parseInt(decision.value, 10);
      return isNaN(n)
        ? { ok: false, error: `Replacement "${decision.value}" is not a valid Int` }
        : { ok: true, value: n };
    }
    case "null_out":
      return field.nullable
        ? { ok: true, value: null }
        : { ok: false, error: `Cannot null required Int field "${field.name}" — enter a replacement value` };
    case "auto_cast": {
      const n = parseInt(String(raw ?? ""), 10);
      return isNaN(n) ? nullOrError(field, raw, "Int") : { ok: true, value: n };
    }
    case "drop":        return { ok: true, skip: true };
    case "db_generate": return { ok: true, skip: true };
    case "pending":     return { ok: false, error: `Field "${field.name}" change not yet approved` };
  }
}

// ─── String → BigInt ──────────────────────────────────────────────────────────

export function stringToBigInt(raw: unknown, field: FieldContext, decision: FieldDecision): FieldResolution {
  switch (decision.type) {
    case "replacement_value": {
      try { return { ok: true, value: BigInt(decision.value) }; }
      catch { return { ok: false, error: `"${decision.value}" is not a valid BigInt` }; }
    }
    case "null_out":
      return field.nullable ? { ok: true, value: null } : { ok: false, error: `Required BigInt field "${field.name}"` };
    case "auto_cast": {
      try { return { ok: true, value: BigInt(String(raw ?? "")) }; }
      catch { return nullOrError(field, raw, "BigInt"); }
    }
    case "drop":        return { ok: true, skip: true };
    case "db_generate": return { ok: true, skip: true };
    case "pending":     return { ok: false, error: `Field "${field.name}" change not yet approved` };
  }
}

// ─── String → Float / Decimal ─────────────────────────────────────────────────

export function stringToFloat(raw: unknown, field: FieldContext, decision: FieldDecision): FieldResolution {
  switch (decision.type) {
    case "replacement_value": {
      const f = parseFloat(decision.value);
      return isNaN(f)
        ? { ok: false, error: `"${decision.value}" is not a valid Float` }
        : { ok: true, value: f };
    }
    case "null_out":
      return field.nullable ? { ok: true, value: null } : { ok: false, error: `Required Float field "${field.name}"` };
    case "auto_cast": {
      const f = parseFloat(String(raw ?? ""));
      return isNaN(f) ? nullOrError(field, raw, "Float") : { ok: true, value: f };
    }
    case "drop":        return { ok: true, skip: true };
    case "db_generate": return { ok: true, skip: true };
    case "pending":     return { ok: false, error: `Field "${field.name}" change not yet approved` };
  }
}

// Decimal uses same logic as Float
export const stringToDecimal = stringToFloat;

// ─── String → Boolean ─────────────────────────────────────────────────────────
// Only "true", "false", "1", "0" survive. All others → NULL or error.

export function stringToBoolean(raw: unknown, field: FieldContext, decision: FieldDecision): FieldResolution {
  switch (decision.type) {
    case "replacement_value": {
      const v = decision.value.toLowerCase();
      if (v === "true" || v === "1") return { ok: true, value: true };
      if (v === "false" || v === "0") return { ok: true, value: false };
      return { ok: false, error: `"${decision.value}" is not a valid Boolean — use true/false/1/0` };
    }
    case "null_out":
      return field.nullable ? { ok: true, value: null } : { ok: false, error: `Required Boolean field "${field.name}"` };
    case "auto_cast": {
      const v = String(raw ?? "").toLowerCase();
      if (v === "true" || v === "1") return { ok: true, value: true };
      if (v === "false" || v === "0") return { ok: true, value: false };
      return nullOrError(field, raw, "Boolean");
    }
    case "drop":        return { ok: true, skip: true };
    case "db_generate": return { ok: true, skip: true };
    case "pending":     return { ok: false, error: `Field "${field.name}" change not yet approved` };
  }
}

// ─── String → DateTime ────────────────────────────────────────────────────────
// Only ISO 8601 strings survive. Invalid date strings → NULL or error.

export function stringToDateTime(raw: unknown, field: FieldContext, decision: FieldDecision): FieldResolution {
  switch (decision.type) {
    case "replacement_value": {
      const d = new Date(decision.value);
      return isNaN(d.getTime())
        ? { ok: false, error: `"${decision.value}" is not a valid date` }
        : { ok: true, value: d.toISOString() };
    }
    case "null_out":
      return field.nullable ? { ok: true, value: null } : { ok: false, error: `Required DateTime field "${field.name}"` };
    case "auto_cast": {
      const d = new Date(String(raw ?? ""));
      return isNaN(d.getTime()) ? nullOrError(field, raw, "DateTime") : { ok: true, value: d.toISOString() };
    }
    case "drop":        return { ok: true, skip: true };
    case "db_generate": return { ok: true, skip: true };
    case "pending":     return { ok: false, error: `Field "${field.name}" change not yet approved` };
  }
}

// ─── String → Uuid ────────────────────────────────────────────────────────────
// Only RFC 4122 formatted strings survive.

export function stringToUuid(raw: unknown, field: FieldContext, decision: FieldDecision): FieldResolution {
  switch (decision.type) {
    case "replacement_value": {
      return UUID_RE.test(decision.value)
        ? { ok: true, value: decision.value }
        : { ok: false, error: `"${decision.value}" is not a valid UUID` };
    }
    case "null_out":
      return field.nullable ? { ok: true, value: null } : { ok: false, error: `Required Uuid field "${field.name}"` };
    case "auto_cast": {
      const s = String(raw ?? "");
      return UUID_RE.test(s) ? { ok: true, value: s } : nullOrError(field, raw, "Uuid");
    }
    case "drop":        return { ok: true, skip: true };
    case "db_generate": return { ok: true, skip: true };
    case "pending":     return { ok: false, error: `Field "${field.name}" change not yet approved` };
  }
}

// ─── String → Json ────────────────────────────────────────────────────────────
// Only valid JSON strings survive.

export function stringToJson(raw: unknown, field: FieldContext, decision: FieldDecision): FieldResolution {
  switch (decision.type) {
    case "replacement_value": {
      try { JSON.parse(decision.value); return { ok: true, value: decision.value }; }
      catch { return { ok: false, error: `"${decision.value}" is not valid JSON` }; }
    }
    case "null_out":
      return field.nullable ? { ok: true, value: null } : { ok: false, error: `Required Json field "${field.name}"` };
    case "auto_cast": {
      const s = String(raw ?? "");
      try { JSON.parse(s); return { ok: true, value: s }; }
      catch { return nullOrError(field, raw, "Json"); }
    }
    case "drop":        return { ok: true, skip: true };
    case "db_generate": return { ok: true, skip: true };
    case "pending":     return { ok: false, error: `Field "${field.name}" change not yet approved` };
  }
}

// ─── String → Bytes ───────────────────────────────────────────────────────────
// No meaningful automatic conversion. Always data_deleted → requires explicit decision.

export function stringToBytes(raw: unknown, field: FieldContext, decision: FieldDecision): FieldResolution {
  switch (decision.type) {
    case "replacement_value": return { ok: true, value: decision.value };
    case "null_out":
      return field.nullable ? { ok: true, value: null } : { ok: false, error: `Required Bytes field "${field.name}"` };
    case "drop":        return { ok: true, skip: true };
    case "db_generate": return { ok: true, skip: true };
    case "auto_cast":   return nullOrError(field, raw, "Bytes");
    case "pending":     return { ok: false, error: `Field "${field.name}" change not yet approved` };
  }
}
