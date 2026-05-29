import type { FieldContext, FieldDecision, FieldResolution } from "./types";

// ─── DateTime → String ────────────────────────────────────────────────────────
// resolution: safe — ISO 8601 string representation

export function dateTimeToString(raw: unknown, _field: FieldContext, decision: FieldDecision): FieldResolution {
  switch (decision.type) {
    case "auto_cast": {
      const d = raw instanceof Date ? raw : new Date(String(raw ?? ""));
      return isNaN(d.getTime())
        ? { ok: true, value: String(raw ?? "") }
        : { ok: true, value: d.toISOString() };
    }
    case "replacement_value": return { ok: true, value: decision.value };
    case "null_out":          return { ok: true, value: null };
    case "drop":              return { ok: true, skip: true };
    case "db_generate":       return { ok: true, skip: true };
    case "pending":           return { ok: false, error: `Field "${_field.name}" change not yet approved` };
  }
}

// ─── DateTime → Int ───────────────────────────────────────────────────────────
// resolution: precision_loss — Unix timestamp in seconds; 32-bit Int overflows after 2038

export function dateTimeToInt(raw: unknown, field: FieldContext, decision: FieldDecision): FieldResolution {
  switch (decision.type) {
    case "auto_cast": {
      const d = raw instanceof Date ? raw : new Date(String(raw ?? ""));
      if (isNaN(d.getTime())) {
        return field.nullable
          ? { ok: true, value: null }
          : { ok: false, error: `"${raw}" is not a valid DateTime for Int conversion` };
      }
      return { ok: true, value: Math.trunc(d.getTime() / 1000) };
    }
    case "replacement_value": {
      const n = parseInt(decision.value, 10);
      return isNaN(n) ? { ok: false, error: `"${decision.value}" is not a valid Int` } : { ok: true, value: n };
    }
    case "null_out":    return field.nullable ? { ok: true, value: null } : { ok: false, error: `Required Int field "${field.name}"` };
    case "drop":        return { ok: true, skip: true };
    case "db_generate": return { ok: true, skip: true };
    case "pending":     return { ok: false, error: `Field "${field.name}" change not yet approved` };
  }
}

// ─── DateTime → BigInt ────────────────────────────────────────────────────────
// resolution: safe — Unix timestamp in milliseconds; BigInt handles 64-bit safely

export function dateTimeToBigInt(raw: unknown, field: FieldContext, decision: FieldDecision): FieldResolution {
  switch (decision.type) {
    case "auto_cast": {
      const d = raw instanceof Date ? raw : new Date(String(raw ?? ""));
      if (isNaN(d.getTime())) {
        return field.nullable ? { ok: true, value: null } : { ok: false, error: `"${raw}" is not a valid DateTime` };
      }
      return { ok: true, value: BigInt(d.getTime()) };
    }
    case "replacement_value": {
      try { return { ok: true, value: BigInt(decision.value) }; }
      catch { return { ok: false, error: `"${decision.value}" is not a valid BigInt` }; }
    }
    case "null_out":    return field.nullable ? { ok: true, value: null } : { ok: false, error: `Required BigInt field "${field.name}"` };
    case "drop":        return { ok: true, skip: true };
    case "db_generate": return { ok: true, skip: true };
    case "pending":     return { ok: false, error: `Field "${field.name}" change not yet approved` };
  }
}

// ─── DateTime → Float ─────────────────────────────────────────────────────────
// resolution: precision_loss — Unix timestamp seconds as float; milliseconds lose precision

export function dateTimeToFloat(raw: unknown, field: FieldContext, decision: FieldDecision): FieldResolution {
  switch (decision.type) {
    case "auto_cast": {
      const d = raw instanceof Date ? raw : new Date(String(raw ?? ""));
      if (isNaN(d.getTime())) {
        return field.nullable ? { ok: true, value: null } : { ok: false, error: `"${raw}" is not a valid DateTime` };
      }
      return { ok: true, value: d.getTime() / 1000 };
    }
    case "replacement_value": {
      const f = parseFloat(decision.value);
      return isNaN(f) ? { ok: false, error: `"${decision.value}" is not a valid Float` } : { ok: true, value: f };
    }
    case "null_out":    return field.nullable ? { ok: true, value: null } : { ok: false, error: `Required Float field "${field.name}"` };
    case "drop":        return { ok: true, skip: true };
    case "db_generate": return { ok: true, skip: true };
    case "pending":     return { ok: false, error: `Field "${field.name}" change not yet approved` };
  }
}

// ─── DateTime → Decimal ───────────────────────────────────────────────────────
// resolution: safe — milliseconds as Decimal; full precision preserved

export function dateTimeToDecimal(raw: unknown, field: FieldContext, decision: FieldDecision): FieldResolution {
  switch (decision.type) {
    case "auto_cast": {
      const d = raw instanceof Date ? raw : new Date(String(raw ?? ""));
      if (isNaN(d.getTime())) {
        return field.nullable ? { ok: true, value: null } : { ok: false, error: `"${raw}" is not a valid DateTime` };
      }
      return { ok: true, value: d.getTime() };
    }
    case "replacement_value": {
      const f = parseFloat(decision.value);
      return isNaN(f) ? { ok: false, error: `"${decision.value}" is not a valid Decimal` } : { ok: true, value: f };
    }
    case "null_out":    return field.nullable ? { ok: true, value: null } : { ok: false, error: `Required Decimal field "${field.name}"` };
    case "drop":        return { ok: true, skip: true };
    case "db_generate": return { ok: true, skip: true };
    case "pending":     return { ok: false, error: `Field "${field.name}" change not yet approved` };
  }
}
