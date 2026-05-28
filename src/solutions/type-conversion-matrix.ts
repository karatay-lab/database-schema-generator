export type Resolution = "safe" | "precision_loss" | "lossy_convert" | "data_deleted" | "backfill_required";

// Resolution severity — higher = worse. Used to pick the "worst" resolution when multiple changes combine.
const SEVERITY: Record<Resolution, number> = {
  safe: 0,
  backfill_required: 1,
  precision_loss: 2,
  lossy_convert: 3,
  data_deleted: 4,
};

export function worstResolution(...resolutions: (Resolution | undefined)[]): Resolution {
  let worst: Resolution = "safe";
  for (const r of resolutions) {
    if (r && SEVERITY[r] > SEVERITY[worst]) worst = r;
  }
  return worst;
}

// 10×10 from→to matrix. Keys are the display types from toDisplayType() in detect-changes.ts.
// Absence means the pair is the same type (no-op) or unmapped (treated as "data_deleted").
const MATRIX: Partial<Record<string, Partial<Record<string, Resolution>>>> = {
  String: {
    Int:      "lossy_convert",
    BigInt:   "lossy_convert",
    Float:    "lossy_convert",
    Decimal:  "lossy_convert",
    Boolean:  "lossy_convert",
    DateTime: "lossy_convert",
    Uuid:     "lossy_convert",
    Json:     "lossy_convert",
    Bytes:    "data_deleted",
  },
  Int: {
    String:   "safe",
    BigInt:   "safe",
    Float:    "precision_loss",
    Decimal:  "safe",
    Boolean:  "lossy_convert",
    DateTime: "lossy_convert",
    Uuid:     "data_deleted",
    Json:     "safe",
    Bytes:    "data_deleted",
  },
  BigInt: {
    String:   "safe",
    Int:      "precision_loss",
    Float:    "precision_loss",
    Decimal:  "safe",
    Boolean:  "data_deleted",
    DateTime: "lossy_convert",
    Uuid:     "data_deleted",
    Json:     "lossy_convert",
    Bytes:    "data_deleted",
  },
  Float: {
    String:   "safe",
    Int:      "precision_loss",
    BigInt:   "precision_loss",
    Decimal:  "precision_loss",
    Boolean:  "data_deleted",
    DateTime: "data_deleted",
    Uuid:     "data_deleted",
    Json:     "safe",
    Bytes:    "data_deleted",
  },
  Decimal: {
    String:   "safe",
    Int:      "precision_loss",
    BigInt:   "precision_loss",
    Float:    "precision_loss",
    Boolean:  "data_deleted",
    DateTime: "data_deleted",
    Uuid:     "data_deleted",
    Json:     "safe",
    Bytes:    "data_deleted",
  },
  Boolean: {
    String:   "safe",
    Int:      "safe",
    BigInt:   "safe",
    Float:    "safe",
    Decimal:  "safe",
    DateTime: "data_deleted",
    Uuid:     "data_deleted",
    Json:     "safe",
    Bytes:    "data_deleted",
  },
  DateTime: {
    String:   "safe",
    Int:      "precision_loss",
    BigInt:   "safe",
    Float:    "precision_loss",
    Decimal:  "safe",
    Boolean:  "data_deleted",
    Uuid:     "data_deleted",
    Json:     "safe",
    Bytes:    "data_deleted",
  },
  Uuid: {
    String:   "safe",
    Int:      "data_deleted",
    BigInt:   "data_deleted",
    Float:    "data_deleted",
    Decimal:  "data_deleted",
    Boolean:  "data_deleted",
    DateTime: "data_deleted",
    Json:     "safe",
    Bytes:    "lossy_convert",
  },
  Json: {
    String:   "safe",
    Int:      "lossy_convert",
    BigInt:   "lossy_convert",
    Float:    "lossy_convert",
    Decimal:  "lossy_convert",
    Boolean:  "lossy_convert",
    DateTime: "data_deleted",
    Uuid:     "data_deleted",
    Bytes:    "data_deleted",
  },
  Bytes: {
    String:   "lossy_convert",
    Int:      "data_deleted",
    BigInt:   "data_deleted",
    Float:    "data_deleted",
    Decimal:  "data_deleted",
    Boolean:  "data_deleted",
    DateTime: "data_deleted",
    Uuid:     "data_deleted",
    Json:     "data_deleted",
  },
};

export function getTypeResolution(from: string, to: string): Resolution {
  if (from === to) return "safe";
  return MATRIX[from]?.[to] ?? "data_deleted";
}

// Stricter PK-only allowlist. Non-PK changes use getTypeResolution.
const PK_MATRIX: Partial<Record<string, Partial<Record<string, Resolution>>>> = {
  Int:    { BigInt: "safe",  String: "safe",  Decimal: "safe",  Float: "precision_loss" },
  BigInt: { String: "safe",  Decimal: "safe", Int: "precision_loss", Float: "precision_loss" },
  Uuid:   { String: "safe" },
  String: { Uuid: "lossy_convert", Json: "safe" },
};

export function getPkTypeResolution(from: string, to: string): Resolution {
  if (from === to) return "safe";
  return PK_MATRIX[from]?.[to] ?? "data_deleted";
}
