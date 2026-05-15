"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useDashboard } from "./dashboard-context";
import { ProjectInfoProvider } from "./project-info-context";
import {
  classNames,
  computeMenuItems,
  menuItemsBase,
} from "./dashboard-data";
import type { PrismaSchemaTestResult } from "@/lib/schema-store";

type DashboardSchemaStats = {
  fieldCount: number;
  importQueuedCount: number;
  relationCount: number;
  restrictionCount: number;
  tableCount: number;
};

const emptySchemaStats: DashboardSchemaStats = {
  fieldCount: 0,
  importQueuedCount: 0,
  relationCount: 0,
  restrictionCount: 0,
  tableCount: 0,
};

type AnsiState = {
  bold: boolean;
  color: string;
  underline: boolean;
};

function ansiClassName(state: AnsiState) {
  return classNames(
    state.bold ? "font-bold" : "",
    state.underline ? "underline underline-offset-2" : "",
    state.color,
  );
}

function applyAnsiCode(state: AnsiState, code: number): AnsiState {
  if (code === 0) {
    return { bold: false, color: "", underline: false };
  }

  if (code === 1) {
    return { ...state, bold: true };
  }

  if (code === 22) {
    return { ...state, bold: false };
  }

  if (code === 4) {
    return { ...state, underline: true };
  }

  if (code === 24) {
    return { ...state, underline: false };
  }

  if (code === 39) {
    return { ...state, color: "" };
  }

  const colorMap: Record<number, string> = {
    30: "text-slate-950",
    31: "text-red-400",
    32: "text-emerald-400",
    33: "text-amber-300",
    34: "text-blue-400",
    35: "text-fuchsia-400",
    36: "text-cyan-300",
    37: "text-slate-100",
    90: "text-slate-500",
    91: "text-red-300",
    92: "text-emerald-300",
    93: "text-amber-200",
    94: "text-blue-300",
    95: "text-fuchsia-300",
    96: "text-cyan-200",
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
      const codes = match[1]
        ? match[1].split(";").map((code) => Number(code || 0))
        : [0];
      for (const code of codes) {
        state = applyAnsiCode(state, code);
      }

      return [];
    }

    if (!chunk) {
      return [];
    }

    index += 1;
    return (
      <span key={index} className={ansiClassName(state)}>
        {chunk}
      </span>
    );
  });
}

export function DashboardShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [schemaStats, setSchemaStats] =
    useState<DashboardSchemaStats>(emptySchemaStats);
  const [isTestingSchema, setIsTestingSchema] = useState(false);
  const [isSchemaTestOpen, setIsSchemaTestOpen] = useState(false);
  const [schemaTestResult, setSchemaTestResult] =
    useState<PrismaSchemaTestResult | null>(null);
  const [schemaTestError, setSchemaTestError] = useState("");
  const {
    activeProject,
    activeProjectId,
    databaseName,
    projectName,
    projects,
    selectedProvider,
    selectedVersion,
  } = useDashboard();

  const baseHref = "";

  const projectStats = useMemo(
    () => ({
      fields: schemaStats.fieldCount,
      imports: schemaStats.importQueuedCount,
      relations: schemaStats.relationCount,
      restrictions: schemaStats.restrictionCount,
      tables: schemaStats.tableCount,
    }),
    [schemaStats],
  );

  useEffect(() => {
    async function fetchStats() {
      if (!activeProject || !selectedVersion) {
        setSchemaStats(emptySchemaStats);
        return;
      }

      try {
        const params = new URLSearchParams({
          projectName: activeProject.name,
          version: selectedVersion,
        });
        const response = await fetch(`/api/schema-stats?${params}`);
        const data = (await response.json()) as Partial<DashboardSchemaStats>;
        setSchemaStats({
          fieldCount: data.fieldCount ?? 0,
          importQueuedCount: data.importQueuedCount ?? 0,
          relationCount: data.relationCount ?? 0,
          restrictionCount: data.restrictionCount ?? 0,
          tableCount: data.tableCount ?? 0,
        });
      } catch {
        setSchemaStats(emptySchemaStats);
      }
    }

    fetchStats();
  }, [activeProject, selectedVersion]);

  const activeProjectWithStats = useMemo(
    () =>
      activeProject
        ? {
            ...activeProject,
            tables: projectStats.tables,
            fields: projectStats.fields,
            imports: projectStats.imports,
            relations: projectStats.relations,
            restrictions: projectStats.restrictions,
          }
        : null,
    [activeProject, projectStats],
  );

  const menuItems = useMemo(
    () => computeMenuItems(activeProjectWithStats),
    [activeProjectWithStats],
  );

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

  const testSchema = async () => {
    if (!activeProject || !selectedVersion) {
      return;
    }

    try {
      setIsTestingSchema(true);
      setIsSchemaTestOpen(true);
      setSchemaTestResult(null);
      setSchemaTestError("");

      const response = await fetch("/api/schema-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectName: activeProject.name.trim(),
          version: selectedVersion,
        }),
      });
      const data = (await response.json()) as
        | PrismaSchemaTestResult
        | { error?: string };

      if (!response.ok) {
        throw new Error("error" in data ? data.error : "Schema test failed.");
      }

      setSchemaTestResult(data as PrismaSchemaTestResult);
    } catch (err) {
      setSchemaTestError(err instanceof Error ? err.message : "Schema test failed.");
    } finally {
      setIsTestingSchema(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#f4f7f3] text-slate-950">
      <div
        className={classNames(
          "grid min-h-screen transition-[grid-template-columns] duration-300",
          isSidebarOpen ? "xl:grid-cols-[420px_minmax(0,1fr)]" : "xl:grid-cols-1",
        )}
      >
        {isSidebarOpen ? (
          <aside className="bg-[#18231f] px-5 py-5 text-white xl:min-h-screen">
            <div className="flex h-full flex-col gap-5">
              <section className="rounded-lg border border-white/10 bg-white/[0.07] p-4 shadow-2xl shadow-black/10">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">
                      Schema Studio
                    </p>
                    <h1 className="mt-2 text-2xl font-semibold tracking-normal">
                      Generator
                    </h1>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsSidebarOpen(false)}
                    className="h-9 rounded-md border border-white/15 bg-white/8 px-3 text-xs font-bold uppercase text-slate-200 transition hover:bg-white/15"
                  >
                    Hide
                  </button>
                </div>

                <div className="mt-6 rounded-md bg-black/16 p-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <p className="shrink-0 text-xs font-medium uppercase tracking-[0.14em] text-slate-300">
                      Active Session
                    </p>
                    <button
                      onClick={() => { router.push("/projects"); }}
                      className="rounded-md border border-white/10 px-2 py-1 text-[11px] font-bold text-emerald-200 transition hover:bg-white/8"
                    >
                      GoTo Projects
                    </button>
                  </div>
                  <dl className="mt-3 space-y-2">
                    {[
                      ["Project", activeProject?.name.trim() || "No project"],
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
                        <dd className="min-w-0 truncate text-sm font-semibold text-white">
                          {value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </section>

              <nav className="flex-1 rounded-lg border border-white/10 bg-[#111916] p-2">
                <div className="mb-2 flex items-center justify-between px-2 pt-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Workflows
                  </p>
                  <span className="text-xs text-slate-400">{menuItemsBase.length}</span>
                </div>

                <div className="space-y-1">
                  {menuItems.map((item) => {
                    const isActive = pathname === item.href;

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={classNames(
                          "group grid w-full grid-cols-[10px_minmax(0,1fr)_auto] items-center gap-3 rounded-md px-3 py-3 text-left text-sm transition",
                          isActive
                            ? "bg-white text-slate-950 shadow-lg shadow-black/15"
                            : "text-slate-200 hover:bg-white/8",
                        )}
                      >
                        <span
                          className={classNames(
                            "h-2.5 w-2.5 rounded-full",
                            item.tone,
                          )}
                        />
                        <span className="min-w-0">
                          <span className="block truncate font-semibold">
                            {item.label}
                          </span>
                          {item.detail ? (
                            <span
                              className={classNames(
                                "block truncate text-xs",
                                isActive ? "text-slate-500" : "text-slate-400",
                              )}
                            >
                              {item.detail}
                            </span>
                          ) : null}
                        </span>
                        <span
                          className={classNames(
                            "rounded-md px-2 py-1 text-[11px] font-bold uppercase",
                            isActive
                              ? "bg-slate-100 text-slate-600"
                              : "bg-white/8 text-slate-300",
                          )}
                        >
                          {item.metric}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </nav>
            </div>
          </aside>
        ) : null}

        <section className="flex min-h-screen flex-col">
          <header className="border-b border-slate-200 bg-white/90 px-5 py-4 backdrop-blur md:px-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-3">
                {!isSidebarOpen ? (
                  <button
                    type="button"
                    onClick={() => setIsSidebarOpen(true)}
                    className="mt-1 h-10 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-400"
                  >
                    Menu
                  </button>
                ) : null}
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
                <button
                  type="button"
                  disabled={!activeProject}
                  onClick={() => { router.push("/schema"); }}
                  className="h-10 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Preview
                </button>
                <button
                  type="button"
                  disabled={!activeProject}
                  onClick={() => { router.push("/sql-query"); }}
                  className="h-10 rounded-md bg-[#1f7a55] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#186648] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Generate SQL
                </button>
                <button
                  type="button"
                  onClick={testSchema}
                  disabled={isTestingSchema || !activeProject || !selectedVersion}
                  className="h-10 rounded-md bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {isTestingSchema ? "Testing..." : "Test Schema"}
                </button>
              </div>
            </div>
          </header>

          <div className="flex-1 px-5 py-6 md:px-8">
            <ProjectInfoProvider>
              {children}
            </ProjectInfoProvider>
          </div>
        </section>
      </div>

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
                <button
                  type="button"
                  onClick={() => setIsSchemaTestOpen(false)}
                  className="h-9 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Close
                </button>
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
                  <div
                    className={classNames(
                      "rounded-lg border p-4",
                      schemaTestResult.success
                        ? "border-emerald-200 bg-emerald-50"
                        : "border-rose-200 bg-rose-50",
                    )}
                  >
                    <p
                      className={classNames(
                        "text-sm font-semibold",
                        schemaTestResult.success ? "text-emerald-700" : "text-rose-700",
                      )}
                    >
                      {schemaTestResult.success
                        ? "Schema test passed."
                        : "Schema test failed."}
                    </p>
                    <p className="mt-1 text-xs font-medium text-slate-600">
                      {schemaTestResult.schemaFile}
                    </p>
                  </div>

                  {schemaTestResult.steps.map((step) => (
                    <div
                      key={step.name}
                      className="flex min-h-80 flex-1 flex-col rounded-lg border border-slate-200 bg-white p-4"
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm font-semibold capitalize text-slate-950">
                            {step.name}
                          </p>
                          <p className="mt-1 text-xs font-medium text-slate-500">
                            {step.command}
                          </p>
                        </div>
                        <span
                          className={classNames(
                            "rounded-md px-2.5 py-1 text-xs font-bold",
                            step.success
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-rose-100 text-rose-700",
                          )}
                        >
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
    </main>
  );
}
