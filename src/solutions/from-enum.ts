import type { FieldContext, EnumDecision, FieldResolution } from "./types";

// ─── Enum value removed ───────────────────────────────────────────────────────
// Called per-record for every enum field where a value was removed.
// If the stored value is NOT the removed one, it passes through untouched.
// If it IS the removed one, apply the client's decision.

export function enumValueRemoved(
  raw: unknown,
  removedValue: string,
  field: FieldContext,
  decision: EnumDecision,
): FieldResolution {
  // Value is not the removed one — pass through as-is
  if (raw !== removedValue) return { ok: true, value: raw };

  switch (decision.type) {
    case "remap":
      return { ok: true, value: decision.replacement };

    case "null_out":
      return field.nullable
        ? { ok: true, value: null }
        : {
            ok: false,
            error: `Enum value "${removedValue}" was removed. Field "${field.name}" is required — choose a replacement value in Tracking`,
          };
  }
}

// ─── Enum type deleted (field that used the enum changes to a scalar) ─────────
// When the entire enum type is removed and the field type changes to String (or other),
// the string values are preserved as-is since they're already strings in storage.
// No special handling needed — the field goes through the normal type-change path.
// This function is a no-op pass-through; included for documentation completeness.

export function enumTypeDeleted(raw: unknown): FieldResolution {
  return { ok: true, value: raw };
}

// ─── String cast to Enum (String field becomes an enum-typed field) ───────────
// Applies when Order.status changes from String to OrderStatus enum.
// The string value "PENDING" is valid as an OrderStatus member — pass through.
// If the string is NOT a valid member, the DB will reject it on INSERT.

export function stringCastToEnum(
  raw: unknown,
  validValues: string[],
  field: FieldContext,
  fallbackValue: string | null,
): FieldResolution {
  if (raw !== null && raw !== undefined && validValues.includes(String(raw))) {
    return { ok: true, value: raw };
  }
  // Value is not a valid member — use fallback or null
  if (fallbackValue !== null && validValues.includes(fallbackValue)) {
    return { ok: true, value: fallbackValue };
  }
  return field.nullable
    ? { ok: true, value: null }
    : {
        ok: false,
        error: `"${raw}" is not a valid member of the enum. Valid values: ${validValues.join(", ")}`,
      };
}
