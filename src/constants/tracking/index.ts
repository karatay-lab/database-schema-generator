import type { TrackingEntryKind, TrackingChangeKind } from "@/lib/tracking-utils";

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
