import type { FieldContext, FieldDecision, FieldResolution } from "./types";

// ─── Int → String ─────────────────────────────────────────────────────────────
// resolution: safe — always succeeds

export function intToString(raw: unknown, _field: FieldContext, decision: FieldDecision): FieldResolution {
  switch (decision.type) {
    case "auto_cast":
    case "replacement_value": return { ok: true, value: decision.type === "auto_cast" ? String(raw ?? "") : decision.value };
    case "null_out":          return { ok: true, value: null };
    case "drop":              return { ok: true, skip: true };
    case "db_generate":       return { ok: true, skip: true };
    case "pending":           return { ok: false, error: `Field "${_field.name}" change not yet approved` };
  }
}

// ─── Int → BigInt ─────────────────────────────────────────────────────────────
// resolution: safe

export function intToBigInt(raw: unknown, _field: FieldContext, decision: FieldDecision): FieldResolution {
  switch (decision.type) {
    case "auto_cast":   return { ok: true, value: BigInt(Math.trunc(Number(raw ?? 0))) };
    case "replacement_value": {
      try { return { ok: true, value: BigInt(decision.value) }; }
      catch { return { ok: false, error: `"${decision.value}" is not a valid BigInt` }; }
    }
    case "null_out":    return { ok: true, value: null };
    case "drop":        return { ok: true, skip: true };
    case "db_generate": return { ok: true, skip: true };
    case "pending":     return { ok: false, error: `Field "${_field.name}" change not yet approved` };
  }
}

// ─── Int → Float / Decimal ────────────────────────────────────────────────────
// resolution: precision_loss — values above 2⁵³ lose exact representation

export function intToFloat(raw: unknown, _field: FieldContext, decision: FieldDecision): FieldResolution {
  switch (decision.type) {
    case "auto_cast":   return { ok: true, value: Number(raw) };
    case "replacement_value": {
      const f = parseFloat(decision.value);
      return isNaN(f) ? { ok: false, error: `"${decision.value}" is not a valid Float` } : { ok: true, value: f };
    }
    case "null_out":    return { ok: true, value: null };
    case "drop":        return { ok: true, skip: true };
    case "db_generate": return { ok: true, skip: true };
    case "pending":     return { ok: false, error: `Field "${_field.name}" change not yet approved` };
  }
}

// ─── Int → Boolean ────────────────────────────────────────────────────────────
// resolution: lossy_convert — only 0 and 1 are valid; all others fail or produce undefined

export function intToBoolean(raw: unknown, field: FieldContext, decision: FieldDecision): FieldResolution {
  switch (decision.type) {
    case "auto_cast": {
      const n = Number(raw);
      if (n === 0) return { ok: true, value: false };
      if (n === 1) return { ok: true, value: true };
      return field.nullable
        ? { ok: true, value: null }
        : { ok: false, error: `Int value "${raw}" cannot be mapped to Boolean — only 0/1 are valid` };
    }
    case "replacement_value": {
      const v = decision.value.toLowerCase();
      if (v === "true" || v === "1") return { ok: true, value: true };
      if (v === "false" || v === "0") return { ok: true, value: false };
      return { ok: false, error: `"${decision.value}" is not a valid Boolean` };
    }
    case "null_out":    return field.nullable ? { ok: true, value: null } : { ok: false, error: `Required Boolean field "${field.name}"` };
    case "drop":        return { ok: true, skip: true };
    case "db_generate": return { ok: true, skip: true };
    case "pending":     return { ok: false, error: `Field "${field.name}" change not yet approved` };
  }
}

// ─── Int → DateTime ───────────────────────────────────────────────────────────
// resolution: lossy_convert — treated as Unix timestamp seconds; ambiguous after 2038

export function intToDateTime(raw: unknown, field: FieldContext, decision: FieldDecision): FieldResolution {
  switch (decision.type) {
    case "auto_cast": {
      const ts = Number(raw) * 1000; // seconds → ms
      const d = new Date(ts);
      return isNaN(d.getTime())
        ? (field.nullable ? { ok: true, value: null } : { ok: false, error: `"${raw}" is not a valid Unix timestamp` })
        : { ok: true, value: d.toISOString() };
    }
    case "replacement_value": {
      const d = new Date(decision.value);
      return isNaN(d.getTime())
        ? { ok: false, error: `"${decision.value}" is not a valid date` }
        : { ok: true, value: d.toISOString() };
    }
    case "null_out":    return field.nullable ? { ok: true, value: null } : { ok: false, error: `Required DateTime field "${field.name}"` };
    case "drop":        return { ok: true, skip: true };
    case "db_generate": return { ok: true, skip: true };
    case "pending":     return { ok: false, error: `Field "${field.name}" change not yet approved` };
  }
}

// ─── Float → Int ──────────────────────────────────────────────────────────────
// resolution: precision_loss — decimal part is truncated

export function floatToInt(raw: unknown, field: FieldContext, decision: FieldDecision): FieldResolution {
  switch (decision.type) {
    case "auto_cast": {
      const n = Math.trunc(Number(raw));
      return isNaN(n)
        ? (field.nullable ? { ok: true, value: null } : { ok: false, error: `"${raw}" cannot be truncated to Int` })
        : { ok: true, value: n };
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

// ─── Float → BigInt ───────────────────────────────────────────────────────────
// resolution: precision_loss — truncated, same as floatToInt

export function floatToBigInt(raw: unknown, field: FieldContext, decision: FieldDecision): FieldResolution {
  switch (decision.type) {
    case "auto_cast": {
      try { return { ok: true, value: BigInt(Math.trunc(Number(raw))) }; }
      catch { return field.nullable ? { ok: true, value: null } : { ok: false, error: `"${raw}" cannot be converted to BigInt` }; }
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

// ─── Float → String / Decimal ─────────────────────────────────────────────────
// resolution: safe (Float→String) / precision_loss (Float→Decimal — fp representation errors)

export function floatToString(raw: unknown, _field: FieldContext, decision: FieldDecision): FieldResolution {
  switch (decision.type) {
    case "auto_cast":         return { ok: true, value: String(raw ?? "") };
    case "replacement_value": return { ok: true, value: decision.value };
    case "null_out":          return { ok: true, value: null };
    case "drop":              return { ok: true, skip: true };
    case "db_generate":       return { ok: true, skip: true };
    case "pending":           return { ok: false, error: `Field "${_field.name}" change not yet approved` };
  }
}

// ─── BigInt → Int ─────────────────────────────────────────────────────────────
// resolution: precision_loss — BigInt values outside −2³¹…2³¹−1 overflow

export function bigIntToInt(raw: unknown, field: FieldContext, decision: FieldDecision): FieldResolution {
  switch (decision.type) {
    case "auto_cast": {
      const n = Number(raw);
      if (!Number.isInteger(n)) return field.nullable ? { ok: true, value: null } : { ok: false, error: `BigInt "${raw}" overflows Int` };
      return { ok: true, value: Math.trunc(n) };
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

// ─── Boolean → Int / String ───────────────────────────────────────────────────
// resolution: safe — true→1/false→0 for Int, true→"true" for String

export function booleanToInt(raw: unknown, _field: FieldContext, decision: FieldDecision): FieldResolution {
  switch (decision.type) {
    case "auto_cast":         return { ok: true, value: raw ? 1 : 0 };
    case "replacement_value": return { ok: true, value: parseInt(decision.value, 10) };
    case "null_out":          return { ok: true, value: null };
    case "drop":              return { ok: true, skip: true };
    case "db_generate":       return { ok: true, skip: true };
    case "pending":           return { ok: false, error: `Field "${_field.name}" change not yet approved` };
  }
}

export function booleanToString(raw: unknown, _field: FieldContext, decision: FieldDecision): FieldResolution {
  switch (decision.type) {
    case "auto_cast":         return { ok: true, value: String(raw) };
    case "replacement_value": return { ok: true, value: decision.value };
    case "null_out":          return { ok: true, value: null };
    case "drop":              return { ok: true, skip: true };
    case "db_generate":       return { ok: true, skip: true };
    case "pending":           return { ok: false, error: `Field "${_field.name}" change not yet approved` };
  }
}
