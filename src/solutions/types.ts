// ─── user decision ───────────────────────────────────────────────────────────
// Derived from SchemaWarning (what the client approved in Tracking).
// Every field migration path requires exactly one decision to be resolved.

export type FieldDecision =
  | { type: "replacement_value"; value: string }  // client typed an explicit default/cast value
  | { type: "null_out" }                          // client approved NULL (only valid for nullable target)
  | { type: "drop" }                              // field removed — omit from INSERT entirely
  | { type: "db_generate" }                       // DB has @default(...) — omit from INSERT, let DB fill
  | { type: "auto_cast" }                         // safe / precision_loss — carry the value through
  | { type: "pending" };                          // client has NOT approved yet → block migration

export type EnumDecision =
  | { type: "remap"; replacement: string }        // removed value maps to a remaining one
  | { type: "null_out" };                         // no replacement; field must be nullable

// ─── migration result ─────────────────────────────────────────────────────────
// Returned by every converter function.

export type FieldResolution =
  | { ok: true; value: unknown }                  // use this value in the INSERT
  | { ok: true; skip: true }                      // omit this column from INSERT (DB default / dropped)
  | { ok: false; error: string };                 // hard error — report to user, block migration

// ─── field context ────────────────────────────────────────────────────────────

export type FieldContext = {
  nullable: boolean;
  hasDefault: boolean;
  name: string;
};
