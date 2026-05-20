"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { useDashboard, useActiveProject } from "./dashboard-context";
import { ProjectInfoProvider } from "./project-info-context";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import {
  classNames,
  computeMenuItems,
  menuItemsBase,
} from "./dashboard-data";
import type { PrismaSchemaTestResult } from "@/lib/schema-store";

// ─── ANSI rendering ───────────────────────────────────────────────────────────

type AnsiState = { bold: boolean; color: string; underline: boolean };

function ansiClassName(state: AnsiState) {
  return classNames(
    state.bold ? "font-bold" : "",
    state.underline ? "underline underline-offset-2" : "",
    state.color,
  );
}

function applyAnsiCode(state: AnsiState, code: number): AnsiState {
  if (code === 0) return { bold: false, color: "", underline: false };
  if (code === 1) return { ...state, bold: true };
  if (code === 22) return { ...state, bold: false };
  if (code === 4) return { ...state, underline: true };
  if (code === 24) return { ...state, underline: false };
  if (code === 39) return { ...state, color: "" };
  const colorMap: Record<number, string> = {
    30: "text-slate-950", 31: "text-red-400", 32: "text-emerald-400",
    33: "text-amber-300", 34: "text-blue-400", 35: "text-fuchsia-400",
    36: "text-cyan-300", 37: "text-slate-100", 90: "text-slate-500",
    91: "text-red-300", 92: "text-emerald-300", 93: "text-amber-200",
    94: "text-blue-300", 95: "text-fuchsia-300", 96: "text-cyan-200",
    97: "text-white",
  };
  return colorMap[code] ? { ...state, color: colorMap[code] } : state;
}

function renderAnsiOutput(output: string) {
  const text = output || "No output.";
  const chunks = text.split(/(\x1b\[[0-9;]*m)/g);
  let state: AnsiState = { bold: false, color: "", underline: false };
  let index = 0;
  return chunks.flatMap((chunk) => {
    const match = chunk.match(/^\x1b\[([0-9;]*)m$/);
    if (match) {
      const codes = match[1] ? match[1].split(";").map((c) => Number(c || 0)) : [0];
      for (const code of codes) state = applyAnsiCode(state, code);
      return [];
    }
    if (!chunk) return [];
    index += 1;
    return <span key={index} className={ansiClassName(state)}>{chunk}</span>;
  });
}

// ─── Shell ────────────────────────────────────────────────────────────────────

export function DashboardShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isSchemaTestOpen, setIsSchemaTestOpen] = useState(false);

  const trpc = useTRPC();
  const { selectedVersion } = useDashboard();
  const activeProject = useActiveProject();

  const { data: statsData } = useQuery(
    trpc.schema.stats.queryOptions(
      { projectName: activeProject?.name ?? "", version: selectedVersion },
      { enabled: !!activeProject && !!selectedVersion },
    ),
  );

  const schemaStats = {
    tableCount: statsData?.tableCount ?? 0,
    fieldCount: statsData?.fieldCount ?? 0,
    relationCount: statsData?.relationCount ?? 0,
    restrictionCount: statsData?.restrictionCount ?? 0,
    importQueuedCount: statsData?.imports ?? 0,
    enumCount: statsData?.enumCount ?? 0,
  };

  const schemaTestMutation = useMutation(trpc.schema.test.mutationOptions());

  const testSchema = () => {
    if (!activeProject || !selectedVersion) return;
    setIsSchemaTestOpen(true);
    schemaTestMutation.mutate({
      projectName: activeProject.name.trim(),
      version: selectedVersion,
    });
  };

  const activeProjectWithStats = useMemo(
    () =>
      activeProject
        ? {
            ...activeProject,
            tables: schemaStats.tableCount,
            fields: schemaStats.fieldCount,
            imports: schemaStats.importQueuedCount,
            enums: schemaStats.enumCount,
            relations: schemaStats.relationCount,
            restrictions: schemaStats.restrictionCount,
          }
        : null,
    [activeProject, schemaStats],
  );

  const menuItems = useMemo(() => computeMenuItems(activeProjectWithStats), [activeProjectWithStats]);

  const activeMenu = useMemo(
    () =>
      pathname === "/projects"
        ? { href: "/projects", label: "Project", metric: "", tone: "bg-emerald-400" }
        : menuItems.find((item) => item.href === pathname) ?? menuItems[0],
    [pathname, menuItems],
  );

  const pageTitle = activeMenu.detail
    ? `${activeMenu.label}: ${activeMenu.detail}`
    : activeMenu.label;

  const projectName = activeProject?.name.trim() || "No project";
  const selectedProvider = activeProject?.provider ?? "No DB";
  const databaseName = activeProject ? `Database-${projectName}` : "No database";

  const schemaTestResult = schemaTestMutation.data as PrismaSchemaTestResult | undefined;
  const schemaTestError = schemaTestMutation.error?.message ?? "";
  const isTestingSchema = schemaTestMutation.isPending;

  return (
    <SidebarProvider
      defaultOpen={true}
      style={{ "--sidebar-width": "420px" } as React.CSSProperties}
    >
      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <Sidebar collapsible="offcanvas" className="border-r-0">
        <SidebarHeader className="gap-0 bg-[#18231f] p-5 text-white">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">
                Schema Studio
              </p>
              <h1 className="mt-2 text-2xl font-semibold tracking-normal">Generator</h1>
            </div>
            <SidebarTrigger className="mt-1 text-slate-200 hover:bg-white/8 hover:text-white" />
          </div>

          <div className="mt-6 rounded-md bg-black/16 p-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <p className="shrink-0 text-xs font-medium uppercase tracking-[0.14em] text-slate-300">
                Active Session
              </p>
              <Button
                onClick={() => { router.push("/projects"); }}
                size="sm"
                className="border-white/10 px-2 py-1 text-[11px] font-bold text-emerald-200 hover:bg-white/8 hover:text-emerald-200"
                variant="outline"
              >
                GoTo Projects
              </Button>
            </div>
            <dl className="mt-3 space-y-2">
              {[
                ["Project", projectName],
                ["Version", selectedVersion],
                ["DB", selectedProvider.toLowerCase()],
                ["Database", databaseName],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="flex min-w-0 items-center justify-between gap-3 overflow-hidden whitespace-nowrap rounded-md bg-black/14 px-3 py-2"
                >
                  <dt className="shrink-0 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                    {label}
                  </dt>
                  <dd className="min-w-0 truncate text-sm font-semibold text-white">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </SidebarHeader>

        <SidebarContent className="bg-[#111916]">
          <SidebarGroup className="p-2">
            <SidebarGroupLabel className="mb-1 flex items-center justify-between px-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              <span>Workflows</span>
              <span>{menuItemsBase.length}</span>
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-1">
                {menuItems.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        isActive={isActive}
                        render={<Link href={item.href} />}
                        className={cn(
                          "grid h-auto grid-cols-[10px_minmax(0,1fr)_auto] gap-3 overflow-visible rounded-md px-3 py-3 text-slate-200",
                          "hover:bg-white/8 hover:text-white",
                          isActive
                            ? "bg-white text-slate-950 shadow-lg shadow-black/15 data-active:bg-white data-active:text-slate-950"
                            : "data-active:bg-transparent",
                        )}
                      >
                        <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", item.tone)} />
                        <span className="min-w-0">
                          <span className="block truncate font-semibold">{item.label}</span>
                          {item.detail ? (
                            <span className={cn("block truncate text-xs", isActive ? "text-slate-500" : "text-slate-400")}>
                              {item.detail}
                            </span>
                          ) : null}
                        </span>
                        <span
                          className={cn(
                            "rounded-md px-2 py-1 text-[11px] font-bold uppercase",
                            isActive ? "bg-slate-100 text-slate-600" : "bg-white/8 text-slate-300",
                          )}
                        >
                          {item.metric}
                        </span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <SidebarInset className="bg-[#f4f7f3]">
        <header className="border-b border-slate-200 bg-white/90 px-5 py-4 backdrop-blur md:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="text-slate-700 hover:bg-slate-100" />
              <Separator orientation="vertical" className="mx-1 h-5" />
              <div>
                <p className="text-sm font-medium text-slate-500">
                  {projectName} / {selectedProvider} / {activeMenu.label}
                </p>
                <h2 className="mt-1 text-2xl font-semibold tracking-normal text-slate-950 md:text-3xl">
                  {pageTitle}
                </h2>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                disabled={!activeProject}
                onClick={() => { router.push("/schema"); }}
              >
                Preview
              </Button>
              <Button
                disabled={!activeProject}
                onClick={() => { router.push("/sql-query"); }}
              >
                Generate SQL
              </Button>
              <Button
                onClick={testSchema}
                disabled={isTestingSchema || !activeProject || !selectedVersion}
              >
                {isTestingSchema ? "Testing..." : "Test Schema"}
              </Button>
            </div>
          </div>
        </header>

        <div className="flex-1 px-5 py-6 md:px-8">
          <ProjectInfoProvider>{children}</ProjectInfoProvider>
        </div>
      </SidebarInset>

      {/* ── Schema test panel ────────────────────────────────────────────── */}
      {isSchemaTestOpen ? (
        <div className="fixed inset-0 z-50 bg-slate-950/45 p-3 md:p-5">
          <div className="flex h-full w-full flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl">
            <div className="border-b border-slate-200 px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Schema Test
                  </p>
                  <h3 className="mt-1 text-xl font-semibold text-slate-950">
                    Prisma format and validate
                  </h3>
                </div>
                <Button variant="outline" size="sm" onClick={() => setIsSchemaTestOpen(false)}>
                  Close
                </Button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              {isTestingSchema ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-8 text-center text-sm font-semibold text-slate-500">
                  Running Prisma schema checks...
                </div>
              ) : schemaTestError ? (
                <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">
                  {schemaTestError}
                </div>
              ) : schemaTestResult ? (
                <div className="flex min-h-full flex-col gap-4">
                  <div className={classNames("rounded-lg border p-4", schemaTestResult.success ? "border-emerald-200 bg-emerald-50" : "border-rose-200 bg-rose-50")}>
                    <p className={classNames("text-sm font-semibold", schemaTestResult.success ? "text-emerald-700" : "text-rose-700")}>
                      {schemaTestResult.success ? "Schema test passed." : "Schema test failed."}
                    </p>
                    <p className="mt-1 text-xs font-medium text-slate-600">{schemaTestResult.schemaFile}</p>
                  </div>
                  {schemaTestResult.steps.map((step) => (
                    <div key={step.name} className="flex min-h-80 flex-1 flex-col rounded-lg border border-slate-200 bg-white p-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm font-semibold capitalize text-slate-950">{step.name}</p>
                          <p className="mt-1 text-xs font-medium text-slate-500">{step.command}</p>
                        </div>
                        <span className={classNames("rounded-md px-2.5 py-1 text-xs font-bold", step.success ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700")}>
                          {step.success ? "Passed" : "Failed"}
                        </span>
                      </div>
                      <pre className="mt-3 min-h-72 flex-1 overflow-auto rounded-md bg-slate-950 p-3 text-xs leading-5 text-slate-100">
                        {renderAnsiOutput(step.output)}
                      </pre>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </SidebarProvider>
  );
}
