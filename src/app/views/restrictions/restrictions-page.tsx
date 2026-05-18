"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { classNames } from "../shared/dashboard-data";
import { fieldTypeBadgeClass } from "@/lib/badge-utils";
import { useProjectInfo } from "../shared/project-info-context";
import type {
  PrismaField,
  PrismaModel,
  PrismaModelRestrictions,
  PrismaRestriction,
  PrismaRestrictionType,
} from "@/lib/schema-store";
import type { RestrictionDraft } from "@/types/restriction";

type RestrictionsResponse = Partial<PrismaModelRestrictions> & {
  error?: string;
};

const emptyRestrictionDraft: RestrictionDraft = {
  type: "UNIQUE",
  fields: [],
  dbName: "",
};

function restrictionTypeLabel(type: PrismaRestrictionType) {
  return type === "UNIQUE" ? "Unique" : "Index";
}

function restrictionTypeClass(type: PrismaRestrictionType) {
  return type === "UNIQUE"
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : "border-violet-200 bg-violet-50 text-violet-700";
}


function getDbNameSuggestion(fieldNames: string[]) {
  const fieldParts = fieldNames
    .map((fieldName) =>
      fieldName
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 3),
    )
    .filter(Boolean);

  return fieldParts.length ? `${fieldParts.join("_")}_ix` : "";
}

export function RestrictionsPageContent() {
  const { projectName, version, hasProject } = useProjectInfo();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [selectedModelName, setSelectedModelName] = useState("");
  const [tableSearch, setTableSearch] = useState("");
  const [isTableSelectorOpen, setIsTableSelectorOpen] = useState(false);
  const [draft, setDraft] = useState<RestrictionDraft>(emptyRestrictionDraft);
  const [editingRestrictionKey, setEditingRestrictionKey] = useState("");
  const [deletingRestrictionKey, setDeletingRestrictionKey] = useState("");
  const [error, setError] = useState("");

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

  const restrictionsQuery = useQuery(
    trpc.restrictions.list.queryOptions(
      { projectName, version, modelName: selectedModelName, modelKey: selectedModelKey },
      { enabled: !!selectedModelName },
    ),
  );
  const fields: PrismaField[] = restrictionsQuery.data?.fields ?? [];
  const restrictions: PrismaRestriction[] = restrictionsQuery.data?.restrictions ?? [];

  const filteredModels = useMemo(
    () => models.filter((m) => m.name.toLowerCase().includes(tableSearch.toLowerCase())),
    [models, tableSearch],
  );

  const selectableFields = useMemo(
    () => fields.filter((f) => draft.type !== "UNIQUE" || f.type !== "Boolean"),
    [draft.type, fields],
  );

  const invalidateRestrictions = () =>
    queryClient.invalidateQueries({
      queryKey: trpc.restrictions.list.queryOptions({ projectName, version, modelName: selectedModelName, modelKey: selectedModelKey }).queryKey,
    });

  const createRestrictionMutation = useMutation({
    ...trpc.restrictions.create.mutationOptions(),
    onSuccess: () => { void invalidateRestrictions(); resetDraft(); },
    onError: (err) => setError(err.message),
  });
  const updateRestrictionMutation = useMutation({
    ...trpc.restrictions.update.mutationOptions(),
    onSuccess: () => { void invalidateRestrictions(); resetDraft(); },
    onError: (err) => setError(err.message),
  });
  const deleteRestrictionMutation = useMutation({
    ...trpc.restrictions.delete.mutationOptions(),
    onSuccess: () => { void invalidateRestrictions(); setDeletingRestrictionKey(""); },
    onError: (err) => { setError(err.message); setDeletingRestrictionKey(""); },
  });

  const savingRestriction = createRestrictionMutation.isPending || updateRestrictionMutation.isPending;

  useEffect(() => {
    if (selectedModelName && models.length > 0 && !models.some((m) => m.name === selectedModelName)) {
      setSelectedModelName("");
    }
  }, [models, selectedModelName]);

  useEffect(() => {
    setDraft(emptyRestrictionDraft);
    setEditingRestrictionKey("");
  }, [selectedModelName]);

  const selectModel = (modelName: string) => {
    setSelectedModelName(modelName);
    setIsTableSelectorOpen(false);
  };

  const updateDraft = (patch: Partial<RestrictionDraft>) => {
    setDraft((currentDraft) => {
      const nextDraft = { ...currentDraft, ...patch };
      if (patch.type === "UNIQUE") {
        nextDraft.fields = nextDraft.fields.filter((fieldName) => {
          const field = fields.find((item) => item.name === fieldName);
          return field?.type !== "Boolean";
        });
      }

      if (patch.fields || patch.type) {
        nextDraft.dbName = getDbNameSuggestion(nextDraft.fields);
      }

      return nextDraft;
    });
    setError("");
  };

  const toggleDraftField = (fieldName: string) => {
    updateDraft({
      fields: draft.fields.includes(fieldName)
        ? draft.fields.filter((item) => item !== fieldName)
        : [...draft.fields, fieldName],
    });
  };

  const resetDraft = () => {
    setDraft(emptyRestrictionDraft);
    setEditingRestrictionKey("");
    setError("");
  };

  const editRestriction = (restriction: PrismaRestriction) => {
    setDraft({
      type: restriction.type,
      fields: restriction.fields,
      dbName: restriction.dbName,
    });
    setEditingRestrictionKey(restriction.key);
    setError("");
  };

  const saveRestriction = () => {
    if (!selectedModelName || draft.fields.length === 0) {
      setError("Select at least one field for this restriction.");
      return;
    }
    setError("");
    const payload = {
      projectName, version,
      modelKey: selectedModelKey, modelName: selectedModelName,
      type: draft.type, fields: draft.fields, dbName: draft.dbName,
    };
    if (editingRestrictionKey) {
      updateRestrictionMutation.mutate({ ...payload, restrictionKey: editingRestrictionKey });
    } else {
      createRestrictionMutation.mutate(payload);
    }
  };

  const deleteRestriction = (restriction: PrismaRestriction) => {
    setDeletingRestrictionKey(restriction.key);
    setError("");
    deleteRestrictionMutation.mutate({
      projectName, version,
      modelKey: selectedModelKey, modelName: selectedModelName,
      restrictionKey: restriction.key,
    });
    if (editingRestrictionKey === restriction.key) resetDraft();
  };

  if (!hasProject) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-8 text-center">
        <p className="text-slate-600">Select a project to manage restrictions.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Main Window
              </p>
              <h3 className="mt-1 text-xl font-semibold text-slate-950">
                Relations workspace
              </h3>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-medium text-slate-500">
                {projectName}-{version}.prisma
              </span>
              <span className="rounded-md border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700">
                {selectedModel ? selectedModel.name : "No table selected"}
              </span>
              <button
                type="button"
                onClick={() => setIsTableSelectorOpen(true)}
                className="h-9 min-w-36 rounded-md border border-violet-300 bg-white px-5 text-xs font-semibold text-violet-700 transition hover:bg-violet-50"
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
                Select a table to edit its unique and index restrictions.
              </p>
              <button
                type="button"
                onClick={() => setIsTableSelectorOpen(true)}
                className="mt-4 h-10 min-w-44 rounded-md bg-violet-600 px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700"
              >
                Select Table
              </button>
            </div>
          ) : restrictionsQuery.isLoading ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-8 text-center text-sm font-medium text-slate-500">
              Loading restrictions...
            </div>
          ) : (
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
              <div>
                <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                      Selected Table
                    </p>
                    <h4 className="mt-1 text-lg font-semibold text-slate-950">
                      {selectedModelName}
                    </h4>
                  </div>
                  <span className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600">
                    {restrictions.length} restrictions / {fields.length} fields
                  </span>
                </div>

                {restrictions.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm font-medium text-slate-500">
                    No unique or index restrictions found for this table.
                  </div>
                ) : (
                  <div className="grid gap-3 lg:grid-cols-2">
                    {restrictions.map((restriction) => (
                      <div
                        key={restriction.key}
                        className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={classNames(
                                  "rounded-md border px-2 py-1 text-xs font-semibold",
                                  restrictionTypeClass(restriction.type),
                                )}
                              >
                                {restrictionTypeLabel(restriction.type)}
                              </span>
                              <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                                {restriction.source === "field"
                                  ? "Field"
                                  : "Model"}
                              </span>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-1.5">
                              {restriction.fields.map((fieldName) => (
                                <span
                                  key={fieldName}
                                  className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700"
                                >
                                  {fieldName}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div className="flex shrink-0 gap-1.5">
                            <button
                              type="button"
                              onClick={() => editRestriction(restriction)}
                              className="h-8 rounded-md border border-violet-200 bg-white px-2.5 text-xs font-semibold text-violet-700 transition hover:bg-violet-50"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteRestriction(restriction)}
                              disabled={deletingRestrictionKey === restriction.key}
                              className="h-8 rounded-md border border-rose-200 bg-white px-2.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:text-slate-400"
                            >
                              {deletingRestrictionKey === restriction.key
                                ? "Deleting..."
                                : "Delete"}
                            </button>
                          </div>
                        </div>

                        {restriction.dbName ? (
                          <p className="mt-3 text-xs font-semibold text-slate-500">
                            DB name:{" "}
                            <span className="text-slate-800">
                              {restriction.dbName}
                            </span>
                          </p>
                        ) : null}
                        <code className="mt-3 block overflow-x-auto rounded-md bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-50">
                          {restriction.preview}
                        </code>
                      </div>
                    ))}
                  </div>
                )}

                {error ? (
                  <p className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
                    {error}
                  </p>
                ) : null}
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  {editingRestrictionKey ? "Edit Restriction" : "Add Restriction"}
                </p>
                <div className="mt-4 space-y-4">
                  <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Type
                    <select
                      value={draft.type}
                      onChange={(event) =>
                        updateDraft({
                          type: event.target.value as PrismaRestrictionType,
                        })
                      }
                      className="mt-2 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-medium normal-case tracking-normal text-slate-950 outline-none transition focus:border-violet-600"
                    >
                      <option value="UNIQUE">Unique</option>
                      <option value="INDEX">Index</option>
                    </select>
                  </label>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                      Fields
                    </p>
                    <div className="mt-2 max-h-72 space-y-2 overflow-y-auto rounded-md border border-slate-200 bg-white p-2">
                      {selectableFields.length === 0 ? (
                        <p className="px-2 py-4 text-center text-sm font-medium text-slate-500">
                          No fields available for this restriction type.
                        </p>
                      ) : (
                        selectableFields.map((field) => (
                          <label
                            key={field.key}
                            className="flex cursor-pointer items-center justify-between gap-3 rounded-md px-2 py-2 transition hover:bg-slate-50"
                          >
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-semibold text-slate-950">
                                {field.name}
                              </span>
                              <span
                                className={classNames(
                                  "mt-1 inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold",
                                  fieldTypeBadgeClass(field.type),
                                )}
                              >
                                {field.type}
                              </span>
                            </span>
                            <input
                              type="checkbox"
                              checked={draft.fields.includes(field.name)}
                              onChange={() => toggleDraftField(field.name)}
                              className="h-4 w-4 rounded border-slate-300 text-violet-600"
                            />
                          </label>
                        ))
                      )}
                    </div>
                  </div>

                  <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Database Name
                    <input
                      value={draft.dbName}
                      onChange={(event) =>
                        updateDraft({ dbName: event.target.value })
                      }
                      className="mt-2 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-medium normal-case tracking-normal text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-violet-600"
                      placeholder="users_email_nx"
                    />
                  </label>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => saveRestriction()}
                      disabled={savingRestriction || draft.fields.length === 0}
                      className="h-10 flex-1 rounded-md bg-violet-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      {savingRestriction
                        ? "Saving..."
                        : editingRestrictionKey
                          ? "Save Restriction"
                          : "Add Restriction"}
                    </button>
                    {editingRestrictionKey ? (
                      <button
                        type="button"
                        onClick={resetDraft}
                        className="h-10 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {isTableSelectorOpen ? (
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
                  <span className="rounded-md border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700">
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
                  onChange={(event) => setTableSearch(event.target.value)}
                  placeholder="Search tables..."
                  className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-violet-600"
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
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                    {filteredModels.map((model) => {
                      const isSelected = model.name === selectedModelName;

                      return (
                        <button
                          key={model.key}
                          type="button"
                          onClick={() => selectModel(model.name)}
                          className={classNames(
                            "flex min-h-16 items-center justify-between rounded-lg border p-4 text-left transition",
                            isSelected
                              ? "border-violet-400 bg-violet-50 shadow-sm"
                              : "border-slate-200 bg-white hover:border-violet-300",
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
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
