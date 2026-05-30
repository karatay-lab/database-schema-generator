"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { classNames } from "../shared/dashboard-data";
import { fieldTypeBadgeClass } from "@/lib/badge-utils";
import { useProjectInfo } from "../shared/project-info-context";
import type { PrismaField, PrismaModel } from "@/lib/schema-store";

type FieldCommentUpdate = { fieldKey: string; comment: string };

function displayType(field: PrismaField, enumTypes: string[]) {
  if (enumTypes.includes(field.type)) return field.type;
  if (field.nativeAttribute?.name === "Uuid") return "Uuid";
  if (field.nativeAttribute?.name === "Timestamptz") return "Timestamptz";
  return field.type;
}

export function CommentaryPageContent() {
  const { projectName, version, hasProject } = useProjectInfo();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [selectedModelName, setSelectedModelName] = useState(
    () => searchParams.get("table") ?? "",
  );
  const [tableSearch, setTableSearch] = useState("");
  const [isTableSelectorOpen, setIsTableSelectorOpen] = useState(false);
  const [tablePage, setTablePage] = useState(1);
  const TABLE_PAGE_SIZE = 9;

  const [comments, setComments] = useState<Record<string, string>>({});
  const [dirtyKeys, setDirtyKeys] = useState<Set<string>>(new Set());
  const [saveError, setSaveError] = useState("");
  const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set());

  const [fieldSearch, setFieldSearch] = useState("");
  const [fieldPage, setFieldPage] = useState(1);
  const FIELD_PAGE_SIZE = 10;

  const tablesQuery = useQuery(
    trpc.tables.list.queryOptions(
      { projectName, version },
      { enabled: !!projectName && !!version },
    ),
  );
  const models: PrismaModel[] = (tablesQuery.data ?? []) as PrismaModel[];

  const selectedModel = useMemo(
    () => models.find((m) => m.name === selectedModelName) ?? null,
    [models, selectedModelName],
  );
  const selectedModelKey = selectedModel?.key ?? "";

  const fieldsQuery = useQuery(
    trpc.commentary.listFields.queryOptions(
      { projectName, version, modelName: selectedModelName, modelKey: selectedModelKey },
      { enabled: !!selectedModelName },
    ),
  );
  const fields: PrismaField[] = fieldsQuery.data?.fields ?? [];
  const enumTypes: string[] = fieldsQuery.data?.enumTypes ?? [];

  // Sync comments when fields data changes
  useEffect(() => {
    const initial: Record<string, string> = {};
    for (const f of fields) initial[f.key] = f.comment ?? "";
    setComments(initial);
    setDirtyKeys(new Set());
    setSavedKeys(new Set());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fieldsQuery.data]);

  const updateCommentsMutation = useMutation({
    ...trpc.commentary.updateComments.mutationOptions(),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: trpc.commentary.listFields.queryOptions({ projectName, version, modelName: selectedModelName, modelKey: selectedModelKey }).queryKey,
      });
      setSavedKeys(new Set(dirtyKeys));
      setDirtyKeys(new Set());
      setSaveError("");
    },
    onError: (err) => setSaveError(err.message),
  });

  const filteredModels = useMemo(
    () => models.filter((m) => m.name.toLowerCase().includes(tableSearch.toLowerCase())),
    [models, tableSearch],
  );

  const paginatedModels = useMemo(() => {
    const start = (tablePage - 1) * TABLE_PAGE_SIZE;
    return filteredModels.slice(start, start + TABLE_PAGE_SIZE);
  }, [filteredModels, tablePage]);

  const totalTablePages = Math.ceil(filteredModels.length / TABLE_PAGE_SIZE);

  useEffect(() => {
    setTablePage(1);
  }, [tableSearch]);

  useEffect(() => {
    setFieldPage(1);
  }, [fieldSearch]);

  const visibleFields = useMemo(
    () =>
      fields.filter(
        (f) =>
          !f.isRelation &&
          f.name.toLowerCase().includes(fieldSearch.toLowerCase()),
      ),
    [fields, fieldSearch],
  );

  const paginatedFields = useMemo(() => {
    const start = (fieldPage - 1) * FIELD_PAGE_SIZE;
    return visibleFields.slice(start, start + FIELD_PAGE_SIZE);
  }, [visibleFields, fieldPage]);

  const totalFieldPages = Math.ceil(visibleFields.length / FIELD_PAGE_SIZE);

  useEffect(() => {
    if (selectedModelName && models.length > 0 && !models.some((m) => m.name === selectedModelName)) {
      setSelectedModelName("");
    }
  }, [models, selectedModelName]);

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (selectedModelName) {
      params.set("table", selectedModelName);
    } else {
      params.delete("table");
    }
    if (params.toString() !== searchParams.toString()) {
      router.replace(`?${params.toString()}`, { scroll: false });
    }
  }, [selectedModelName]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setFieldPage(1); setSaveError(""); }, [selectedModelName]);

  const selectModel = (modelName: string) => {
    setSelectedModelName(modelName);
    setTableSearch("");
    setFieldSearch("");
    setIsTableSelectorOpen(false);
    setTablePage(1);
  };

  const handleCommentChange = (fieldKey: string, value: string) => {
    setComments((prev) => ({ ...prev, [fieldKey]: value }));
    setDirtyKeys((prev) => new Set(prev).add(fieldKey));
    setSaveError("");
    setSavedKeys((prev) => {
      const next = new Set(prev);
      next.delete(fieldKey);
      return next;
    });
  };

  const handleSave = () => {
    if (dirtyKeys.size === 0) return;
    const updates = Array.from(dirtyKeys).map((key) => ({ fieldKey: key, comment: comments[key] ?? "" }));
    updateCommentsMutation.mutate({ projectName, version, modelName: selectedModelName, modelKey: selectedModelKey, updates });
  };

  if (!hasProject) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-8 text-center">
        <p className="text-slate-600">Select a project to add GraphQL comments.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-slate-200 bg-white shadow-sm min-h-[calc(100vh-140px)]">
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Main Window
              </p>
              <h3 className="mt-1 text-xl font-semibold text-slate-950">
                Commentary
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Add <code className="rounded bg-slate-100 px-1 text-xs font-mono text-fuchsia-700">{"/// comment"}</code> style annotations to schema fields.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-medium text-slate-500">
                {projectName}-{version}
              </span>
              <span className="rounded-md border border-fuchsia-200 bg-fuchsia-50 px-3 py-1.5 text-xs font-semibold text-fuchsia-700">
                {selectedModel ? selectedModel.name : "No table selected"}
              </span>
              <button
                type="button"
                onClick={() => setIsTableSelectorOpen(true)}
                className="h-9 min-w-36 rounded-md border border-fuchsia-300 bg-white px-5 text-xs font-semibold text-fuchsia-700 transition hover:bg-fuchsia-50"
              >
                Select Table
              </button>
            </div>
          </div>
        </div>

        <div className="p-5">
          {!selectedModelName ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
              <p className="text-sm font-medium text-slate-500">
                Select a table to add GraphQL-style comments to its fields.
              </p>
              <button
                type="button"
                onClick={() => setIsTableSelectorOpen(true)}
                className="mt-4 h-10 min-w-44 rounded-md bg-fuchsia-600 px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-fuchsia-700"
              >
                Select Table
              </button>
            </div>
          ) : fieldsQuery.isLoading ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-8 text-center text-sm font-medium text-slate-500">
              Loading fields...
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Selected Table
                  </p>
                  <h4 className="mt-1 text-lg font-semibold text-slate-950">
                    {selectedModelName}
                  </h4>
                  <p className="mt-1 text-sm font-medium text-slate-500">
                    {fields.length} fields
                    {dirtyKeys.size > 0 && (
                      <span className="ml-2 text-fuchsia-600">
                        · {dirtyKeys.size} unsaved
                      </span>
                    )}
                  </p>
                </div>
                <div className="ml-auto w-full flex-none lg:w-72">
                  <input
                    type="text"
                    value={fieldSearch}
                    onChange={(e) => setFieldSearch(e.target.value)}
                    placeholder="Search fields..."
                    className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-fuchsia-500"
                  />
                </div>
              </div>

              <div className="divide-y divide-slate-100 rounded-md border border-slate-200 bg-white">
                {visibleFields.length === 0 ? (
                  <div className="py-10 text-center text-sm font-medium text-slate-500">
                    {fieldSearch ? "No fields match your search." : "No fields available."}
                  </div>
                ) : (
                  paginatedFields.map((field) => {
                    const isDirty = dirtyKeys.has(field.key);
                    const isSaved = savedKeys.has(field.key);
                    const displayFieldType = displayType(field, enumTypes);

                    return (
                      <div
                        key={field.key}
                        className="grid grid-cols-1 items-center gap-3 p-4 lg:grid-cols-[minmax(280px,0.55fr)_minmax(0,1fr)]"
                      >
                        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
                          <span className="truncate text-sm font-semibold text-slate-950">
                            {field.name}
                          </span>
                          <div className="flex shrink-0 items-center gap-1.5">
                            <span
                              className={classNames(
                                "inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold",
                                fieldTypeBadgeClass(displayFieldType),
                              )}
                            >
                              {displayFieldType}
                            </span>
                            {field.isId && (
                              <span className="inline-flex rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                                id
                              </span>
                            )}
                            {field.nullable && (
                              <span className="inline-flex rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                                nullable
                              </span>
                            )}
                            {isDirty && (
                              <span className="inline-flex rounded-full bg-fuchsia-100 px-2 py-0.5 text-[10px] font-semibold text-fuchsia-700">
                                unsaved
                              </span>
                            )}
                            {isSaved && !isDirty && (
                              <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                                saved
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <span className="shrink-0 select-none font-mono text-xs text-slate-400">
                            {"///"}
                          </span>
                          <input
                            type="text"
                            value={comments[field.key] ?? ""}
                            onChange={(e) =>
                              handleCommentChange(field.key, e.target.value)
                            }
                            placeholder="Add a comment for this field…"
                            className={classNames(
                              "h-9 w-full rounded-md border px-3 text-sm font-medium text-slate-950 outline-none transition placeholder:text-slate-400",
                              isDirty
                                ? "border-fuchsia-300 focus:border-fuchsia-500"
                                : "border-slate-200 focus:border-fuchsia-400",
                            )}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {saveError && (
                <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
                  {saveError}
                </p>
              )}

              <div className="flex items-center justify-between gap-4">
                <p className="shrink-0 text-sm font-medium text-slate-500">
                  {dirtyKeys.size > 0
                    ? `${dirtyKeys.size} field${dirtyKeys.size !== 1 ? "s" : ""} with unsaved changes`
                    : savedKeys.size > 0
                      ? `${savedKeys.size} field${savedKeys.size !== 1 ? "s" : ""} saved`
                      : "No changes"}
                </p>
                {totalFieldPages > 1 && (
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setFieldPage((p) => Math.max(1, p - 1))}
                      disabled={fieldPage === 1}
                      className="h-9 rounded-md border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100"
                    >
                      Previous
                    </button>
                    <span className="text-sm font-medium text-slate-600">
                      Page {fieldPage} of {totalFieldPages}
                    </span>
                    <button
                      type="button"
                      onClick={() => setFieldPage((p) => Math.min(totalFieldPages, p + 1))}
                      disabled={fieldPage === totalFieldPages}
                      className="h-9 rounded-md border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100"
                    >
                      Next
                    </button>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => handleSave()}
                  disabled={updateCommentsMutation.isPending || dirtyKeys.size === 0}
                  className="ml-auto h-10 min-w-36 shrink-0 rounded-md bg-fuchsia-600 px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-fuchsia-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {updateCommentsMutation.isPending ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {isTableSelectorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-3">
          <div className="max-h-[94vh] w-[96vw] max-w-[1500px] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl">
            <div className="border-b border-slate-200 px-5 py-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Table Selector
                  </p>
                  <h3 className="mt-1 text-xl font-semibold text-slate-950">
                    Tables
                  </h3>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded-md border border-fuchsia-200 bg-fuchsia-50 px-3 py-1.5 text-xs font-semibold text-fuchsia-700">
                    {models.length} tables
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsTableSelectorOpen(false)}
                    className="h-9 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>

            <div className="p-5">
              <div className="mb-4">
                <input
                  type="text"
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                  placeholder="Search tables..."
                  className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-fuchsia-500"
                />
              </div>

              <div className="max-h-[70vh] overflow-y-auto pr-1">
                {tablesQuery.isLoading ? (
                  <div className="py-8 text-center text-sm font-medium text-slate-500">
                    Loading...
                  </div>
                ) : filteredModels.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm font-medium text-slate-500">
                    No tables found.
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-3 gap-4">
                      {paginatedModels.map((model) => {
                        const isSelected = model.name === selectedModelName;
                        return (
                          <button
                            key={model.key}
                            type="button"
                            onClick={() => selectModel(model.name)}
                            className={classNames(
                              "flex min-h-16 items-center justify-between rounded-lg border p-4 text-left transition",
                              isSelected
                                ? "border-fuchsia-400 bg-fuchsia-50 shadow-sm"
                                : "border-slate-200 bg-white hover:border-fuchsia-300",
                            )}
                          >
                            <span className="min-w-0 truncate font-semibold text-slate-950">
                              {model.name}
                            </span>
                            <span
                              className={classNames(
                                "ml-3 inline-flex shrink-0 items-center rounded-md px-2 py-1 text-xs font-medium",
                                fieldTypeBadgeClass(model.pkType),
                              )}
                            >
                              {model.pkType || "String"}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    {totalTablePages > 1 && (
                      <div className="mt-4 flex items-center justify-center gap-4">
                        <button
                          type="button"
                          onClick={() => setTablePage((p) => Math.max(1, p - 1))}
                          disabled={tablePage === 1}
                          className="h-9 rounded-md border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100"
                        >
                          Previous
                        </button>
                        <span className="text-sm font-medium text-slate-600">
                          Page {tablePage} of {totalTablePages}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setTablePage((p) => Math.min(totalTablePages, p + 1))
                          }
                          disabled={tablePage === totalTablePages}
                          className="h-9 rounded-md border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100"
                        >
                          Next
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
