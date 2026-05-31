import type { TrackingEntryKind, TrackingChangeKind } from "@/lib/tracking-utils";

// ─── Warning severity ─────────────────────────────────────────────────────────

export type Severity = "breaking" | "warning" | "info" | "approved";

export const severityConfig: Record<Severity, { row: string; badge: string; label: string; dot: string }> = {
  breaking: { row: "bg-red-50/60",    badge: "border-red-200 bg-red-50 text-red-700",       label: "Breaking", dot: "bg-red-500"    },
  warning:  { row: "bg-amber-50/40",  badge: "border-amber-200 bg-amber-50 text-amber-700", label: "Warning",  dot: "bg-amber-500"  },
  info:     { row: "",                badge: "border-sky-200 bg-sky-50 text-sky-700",        label: "Info",     dot: "bg-sky-400"    },
  approved: { row: "bg-emerald-50/40",badge: "border-emerald-200 bg-emerald-50 text-emerald-600", label: "Approved", dot: "bg-emerald-400" },
};

// ─── Resolution strategy ──────────────────────────────────────────────────────

export type StrategyName =
  | "Unique Prefix + UUID" | "Static Default" | "Set NULL"
  | "Type Cast" | "Remapped" | "Data Dropped" | "Acknowledged" | "Pending";

export const STRATEGIES_BY_KIND: Record<string, StrategyName[]> = {
  table:       ["Data Dropped", "Acknowledged"],
  enum:        ["Remapped", "Set NULL", "Data Dropped", "Acknowledged"],
  field:       ["Unique Prefix + UUID", "Static Default", "Type Cast", "Set NULL", "Data Dropped", "Acknowledged"],
  relation:    ["Data Dropped", "Acknowledged"],
  restriction: ["Acknowledged"],
};

export const strategyStyle: Record<StrategyName, { cls: string }> = {
  "Unique Prefix + UUID": { cls: "border-violet-200 bg-violet-50 text-violet-700"  },
  "Static Default":       { cls: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  "Set NULL":             { cls: "border-slate-200 bg-slate-50 text-slate-500"      },
  "Type Cast":            { cls: "border-sky-200 bg-sky-50 text-sky-700"            },
  "Remapped":             { cls: "border-amber-200 bg-amber-50 text-amber-700"      },
  "Data Dropped":         { cls: "border-rose-200 bg-rose-50 text-rose-700"         },
  "Acknowledged":         { cls: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  "Pending":              { cls: "border-slate-200 bg-white text-slate-400"         },
};

export const VALID_TABS = ["all", "tables", "enums", "schema", "relations", "restrictions"] as const;
export type TrackingTab = typeof VALID_TABS[number];

export const changeBadge: Record<TrackingChangeKind, { cls: string; label: string }> = {
  added:         { cls: "border-emerald-200 bg-emerald-50 text-emerald-700",  label: "Added"         },
  removed:       { cls: "border-red-200 bg-red-50 text-red-700",              label: "Removed"       },
  changed:       { cls: "border-amber-200 bg-amber-50 text-amber-700",        label: "Changed"       },
  renamed:       { cls: "border-sky-200 bg-sky-50 text-sky-700",              label: "Renamed"       },
  value_added:   { cls: "border-emerald-200 bg-emerald-50 text-emerald-700",  label: "Value added"   },
  value_removed: { cls: "border-red-200 bg-red-50 text-red-700",              label: "Value removed" },
};

export const rowTint: Partial<Record<TrackingChangeKind, string>> = {
  added:         "bg-emerald-50/40",
  removed:       "bg-red-50/40",
  changed:       "bg-amber-50/40",
  renamed:       "bg-sky-50/40",
  value_added:   "bg-emerald-50/40",
  value_removed: "bg-red-50/40",
};

export const kindLabel: Record<TrackingEntryKind, string> = {
  field_default: "Field default",
  enum:          "Enum",
  enum_value:    "Enum value",
};

export const tabMeta: Record<string, { dot: string; label: string }> = {
  all:          { dot: "bg-slate-400",   label: "All Changes"  },
  tables:       { dot: "bg-cyan-500",    label: "Tables"       },
  enums:        { dot: "bg-indigo-500",  label: "Enums"        },
  schema:       { dot: "bg-rose-500",    label: "Schema"       },
  relations:    { dot: "bg-violet-500",  label: "Relations"    },
  restrictions: { dot: "bg-blue-500",    label: "Restrictions" },
};

export const tabAccent: Record<string, string> = {
  all:          "data-active:border-slate-700",
  tables:       "data-active:border-cyan-600",
  enums:        "data-active:border-indigo-600",
  schema:       "data-active:border-rose-600",
  relations:    "data-active:border-violet-600",
  restrictions: "data-active:border-blue-600",
};
