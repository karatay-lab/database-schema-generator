import type { Project } from "@/types/projects";

export type { Project, ProjectVersion, SchemaOptions } from "@/types/projects";
export {
  defaultSchemaOptions,
  graphqlOptions,
  prismaClients,
  providers,
} from "@/constants/projects";

export type MenuItem = {
  label: string;
  href: string;
  detail?: string;
  later?: boolean;
  tone: string;
  metric: string;
};

export type TableSummary = {
  name: string;
  fields: number;
  rows: string;
  status: string;
  accent: string;
};

export const menuItemsBase: MenuItem[] = [
  { label: "Tables", href: "/tables", tone: "bg-cyan-400", metric: "0 tables" },
  { label: "Enums", href: "/enums", tone: "bg-indigo-400", metric: "0 enums" },
  {
    label: "Schema",
    href: "/schema",
    detail: "Fields & Templates",
    tone: "bg-rose-400",
    metric: "draft",
  },
  {
    label: "Relations",
    href: "/relations",
    detail: "Relations & Templates",
    tone: "bg-violet-400",
    metric: "0 links",
  },
  {
    label: "Restrictions",
    href: "/restrictions",
    detail: "Restrictions & Templates",
    tone: "bg-blue-400",
    metric: "0 links",
  },
  {
    label: "Commentary",
    href: "/commentary",
    detail: "GraphQL like comment",
    tone: "bg-fuchsia-400",
    metric: "",
  },
  {
    label: "Tracking",
    href: "/tracking",
    detail: "Default value changes",
    tone: "bg-yellow-400",
    metric: "0 changes",
  },
  { label: "Validation", href: "/validation", tone: "bg-amber-400", metric: "0 rules" },
  {
    label: "SQL Query",
    href: "/sql-query",
    detail: "Example",
    tone: "bg-orange-400",
    metric: "draft",
  },
  {
    label: "Hierarchy",
    href: "/hierarchy",
    detail: "Order",
    tone: "bg-emerald-400",
    metric: "",
  },
  {
    label: "Migrations",
    href: "/migrations",
    detail: "Sync",
    tone: "bg-slate-300",
    metric: "",
  },
  { label: "Exports", href: "/exports", tone: "bg-blue-400", metric: "0 targets" },
  { label: "Imports", href: "/imports", tone: "bg-lime-400", metric: "" },
  { label: "History", href: "/history", tone: "bg-teal-400", metric: "0 saves" },
];

export function computeMenuItems(project: Project | null): MenuItem[] {
  if (!project) {
    return menuItemsBase;
  }

  return menuItemsBase.map((item) => {
    switch (item.label) {
      case "Tables":
        return { ...item, metric: `${project.tables} tables` };
      case "Enums":
        return { ...item, metric: `${project.enums ?? 0} enums` };
      case "Validation":
        return { ...item, metric: `${Math.max(0, project.fields - project.tables)} rules` };
      case "Relations":
        return { ...item, metric: `${project.relations} links` };
      case "Restrictions":
        return { ...item, metric: `${project.restrictions ?? 0} rules` };
      case "Hierarchy":
        return { ...item, metric: `${project.relations} deps` };
      case "Imports":
        return item;
      case "History":
        return { ...item, metric: `${project.versions.length} saves` };
      default:
        return item;
    }
  });
}

export const initialProjects: Project[] = [];

export const tableSummaries: TableSummary[] = [
  {
    name: "Customer",
    fields: 12,
    rows: "24.1k",
    status: "Validated",
    accent: "border-emerald-500",
  },
  {
    name: "Invoice",
    fields: 16,
    rows: "8.8k",
    status: "Index review",
    accent: "border-amber-500",
  },
  {
    name: "LineItem",
    fields: 10,
    rows: "42.7k",
    status: "Synced",
    accent: "border-cyan-500",
  },
  {
    name: "Payment",
    fields: 9,
    rows: "7.2k",
    status: "Relation draft",
    accent: "border-violet-500",
  },
];

export const fieldRows = [
  ["id", "String", "Primary key", "@id @default(cuid())"],
  ["email", "String", "Unique", "@unique"],
  ["createdAt", "DateTime", "Default", "@default(now())"],
  ["accountId", "String", "Relation", "Account.id"],
];

export const workflowSummaries: Record<string, string> = {
  Projects: "Create the active project record and shape its generated database identity.",
  Tables: "Design schema tables, field groups, indexes, and table-level constraints.",
  Validation: "Review naming, duplicate constraints, provider limits, and migration readiness.",
  Relations: "Model relation templates, delete behavior, and provider-specific restrictions.",
  Schema: "Inspect generated Prisma and Drizzle field templates before writing artifacts.",
  Exports: "Prepare schema bundles for SQL, Prisma, Drizzle, JSON, and documentation output.",
  Imports: "Upload a version or project pickle to restore schema data into this project.",
  "SQL Query": "Draft provider-aware SQL examples against the selected schema version.",
  Commentary: "Plan GraphQL-like schema comments and generated documentation hints.",
  Migrations: "Compare committed schema state with the active draft and prepare sync steps.",
  Hierarchy: "Review table dependencies and the migration execution order used for relation-safe data moves.",
  History: "Select a project from committed history and restore its schema context.",
};
