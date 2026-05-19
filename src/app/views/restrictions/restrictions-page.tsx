"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
  const seen = new Set<string>();
  const fieldParts = fieldNames
    .map((fieldName) =>
      fieldName
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 3),
    )
    .filter((part) => {
      if (!part || seen.has(part)) return false;
      seen.add(part);
      return true;
    });

  return fieldParts.length ? `${fieldParts.join("_")}_ix` : "";
}

export function RestrictionsPageContent() {
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
  const [draft, setDraft] = useState<RestrictionDraft>(emptyRestrictionDraft);
  const [editingRestrictionKey, setEditingRestrictionKey] = useState("");
  const [isAddingRestriction, setIsAddingRestriction] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(true);
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

  useEffect(() => {
    setDraft(emptyRestrictionDraft);
    setEditingRestrictionKey("");
    setIsAddingRestriction(false);
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
    setIsAddingRestriction(false);
    setError("");
  };

  const editRestriction = (restriction: PrismaRestriction) => {
    setIsAddingRestriction(false);
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
                Restrictions workspace
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
            <div>
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Selected Table
                  </p>
                  <h4 className="mt-1 text-lg font-semibold text-slate-950">
                    {selectedModelName}
                  </h4>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600">
                    {restrictions.length} restrictions / {fields.length} fields
                  </span>
                  {!isAddingRestriction && !editingRestrictionKey ? (
                    <button
                      type="button"
                      onClick={() => { resetDraft(); setIsAddingRestriction(true); }}
                      className="h-9 rounded-md border border-violet-300 bg-white px-4 text-xs font-semibold text-violet-700 transition hover:bg-violet-50"
                    >
                      + Add Restriction
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="mb-4 rounded-lg border border-violet-100 bg-violet-50/40">
                <button
                  type="button"
                  onClick={() => setIsGuideOpen((o) => !o)}
                  className="flex w-full items-center justify-between px-4 py-2.5 text-left"
                >
                  <span className="text-xs font-bold uppercase tracking-[0.12em] text-violet-600">
                    When &amp; why to add a restriction
                  </span>
                  <span className="text-xs font-semibold text-violet-400">
                    {isGuideOpen ? "Hide" : "Show"}
                  </span>
                </button>
                {isGuideOpen ? (
                  <div className="grid gap-4 border-t border-violet-100 px-4 py-3 sm:grid-cols-2">
                    <div>
                      <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.1em] text-emerald-700">
                        Unique constraint
                      </p>
                      <p className="text-[12px] leading-relaxed text-slate-600">
                        Prevents two rows from sharing the same value(s) in the selected columns. The database rejects any insert or update that would create a duplicate.
                      </p>
                      <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Add when</p>
                      <ul className="mt-1 space-y-0.5 text-[12px] leading-relaxed text-slate-600">
                        <li>• A column must be a business identifier — email, username, slug, phone number.</li>
                        <li>• A <span className="font-semibold">combination</span> of columns must be unique — e.g. <code className="rounded bg-slate-100 px-1 text-[11px]">(userId, projectId)</code> in a membership table.</li>
                        <li>• You want the database to enforce uniqueness without relying on application code.</li>
                      </ul>
                      <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
                        A unique constraint also creates an implicit index, so no separate Index is needed on the same column(s).
                      </p>
                    </div>
                    <div>
                      <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.1em] text-violet-700">
                        Index
                      </p>
                      <p className="text-[12px] leading-relaxed text-slate-600">
                        Builds an internal lookup structure so the database can find rows quickly without scanning the whole table. Does not enforce uniqueness.
                      </p>
                      <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Add when</p>
                      <ul className="mt-1 space-y-0.5 text-[12px] leading-relaxed text-slate-600">
                        <li>• A column appears in <code className="rounded bg-slate-100 px-1 text-[11px]">WHERE</code>, <code className="rounded bg-slate-100 px-1 text-[11px]">JOIN ON</code>, or <code className="rounded bg-slate-100 px-1 text-[11px]">ORDER BY</code> in frequent queries.</li>
                        <li>• A foreign key column — without an index, cascade deletes and joins are slow.</li>
                        <li>• A column used for dashboard filters, search, or pagination at scale.</li>
                      </ul>
                      <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
                        Trade-off: indexes consume extra storage and slightly slow down writes. Add them where query speed matters, not by default on every column.
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>

              {error ? (
                <p className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
                  {error}
                </p>
              ) : null}

              {isAddingRestriction ? (
                <div className="mb-4 rounded-lg border-2 border-dashed border-violet-300 bg-violet-50/30 p-4">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-violet-600">
                    New Restriction
                  </p>
                  <div className="flex flex-wrap gap-5">
                    <div className="shrink-0">
                      <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                        Type
                      </p>
                      <div className="flex gap-1.5">
                        {(["UNIQUE", "INDEX"] as PrismaRestrictionType[]).map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => updateDraft({ type: t })}
                            className={classNames(
                              "h-8 rounded-md border px-3 text-xs font-semibold transition",
                              draft.type === t
                                ? t === "UNIQUE"
                                  ? "border-emerald-400 bg-emerald-50 text-emerald-700"
                                  : "border-violet-400 bg-violet-50 text-violet-700"
                                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50",
                            )}
                          >
                            {restrictionTypeLabel(t)}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="min-w-48 flex-1">
                      <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                        Fields
                      </p>
                      {selectableFields.length === 0 ? (
                        <p className="text-xs text-slate-500">
                          No fields available for this type.
                        </p>
                      ) : (
                        <div className="grid grid-cols-2 gap-1.5 lg:grid-cols-3 xl:grid-cols-4">
                          {selectableFields.map((field) => {
                            const isSelected = draft.fields.includes(field.name);
                            return (
                              <button
                                key={field.key}
                                type="button"
                                onClick={() => toggleDraftField(field.name)}
                                className={classNames(
                                  "flex items-center justify-between rounded-lg border px-2.5 py-2 text-left transition",
                                  isSelected
                                    ? "border-violet-400 bg-violet-50 shadow-sm"
                                    : "border-slate-200 bg-white hover:border-violet-300",
                                )}
                              >
                                <span className={classNames("truncate text-sm font-semibold", isSelected ? "text-violet-900" : "text-slate-800")}>
                                  {field.name}
                                </span>
                                <span className={classNames(
                                  "ml-2 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold",
                                  isSelected ? "bg-violet-100 text-violet-700" : "bg-slate-100 text-slate-500",
                                )}>
                                  {field.type}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div className="flex shrink-0 min-w-44 flex-col justify-between gap-3">
                      <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                        Database Name
                        <input
                          value={draft.dbName}
                          onChange={(e) => updateDraft({ dbName: e.target.value })}
                          className="mt-1.5 h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-medium normal-case tracking-normal text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-violet-600"
                          placeholder="users_email_ix"
                        />
                      </label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={saveRestriction}
                          disabled={savingRestriction || draft.fields.length === 0}
                          className="h-9 flex-1 rounded-md bg-violet-600 px-3 text-xs font-semibold text-white shadow-sm transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                        >
                          {savingRestriction ? "Saving..." : "Add Restriction"}
                        </button>
                        <button
                          type="button"
                          onClick={resetDraft}
                          className="h-9 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              {restrictions.length === 0 && !isAddingRestriction ? (
                <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                  <p className="text-sm font-medium text-slate-500">
                    No unique or index restrictions found for this table.
                  </p>
                  <button
                    type="button"
                    onClick={() => { resetDraft(); setIsAddingRestriction(true); }}
                    className="mt-4 h-10 min-w-44 rounded-md bg-violet-600 px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700"
                  >
                    Add Restriction
                  </button>
                </div>
              ) : (
                <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
                  {restrictions.map((restriction) =>
                    editingRestrictionKey === restriction.key ? (
                      <div
                        key={restriction.key}
                        className="rounded-lg border-2 border-violet-400 bg-white p-4 shadow-sm"
                      >
                        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-violet-600">
                          Edit Restriction
                        </p>
                        <div className="space-y-3">
                          <div>
                            <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                              Type
                            </p>
                            <div className="flex gap-1.5">
                              {(["UNIQUE", "INDEX"] as PrismaRestrictionType[]).map((t) => (
                                <button
                                  key={t}
                                  type="button"
                                  onClick={() => updateDraft({ type: t })}
                                  className={classNames(
                                    "h-8 rounded-md border px-3 text-xs font-semibold transition",
                                    draft.type === t
                                      ? t === "UNIQUE"
                                        ? "border-emerald-400 bg-emerald-50 text-emerald-700"
                                        : "border-violet-400 bg-violet-50 text-violet-700"
                                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50",
                                  )}
                                >
                                  {restrictionTypeLabel(t)}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div>
                            <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                              Fields
                            </p>
                            <div className="grid grid-cols-2 gap-1.5">
                              {selectableFields.map((field) => {
                                const isSelected = draft.fields.includes(field.name);
                                return (
                                  <button
                                    key={field.key}
                                    type="button"
                                    onClick={() => toggleDraftField(field.name)}
                                    className={classNames(
                                      "flex items-center justify-between rounded-lg border px-2.5 py-2 text-left transition",
                                      isSelected
                                        ? "border-violet-400 bg-violet-50 shadow-sm"
                                        : "border-slate-200 bg-white hover:border-violet-300",
                                    )}
                                  >
                                    <span className={classNames("truncate text-sm font-semibold", isSelected ? "text-violet-900" : "text-slate-800")}>
                                      {field.name}
                                    </span>
                                    <span className={classNames(
                                      "ml-2 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold",
                                      isSelected ? "bg-violet-100 text-violet-700" : "bg-slate-100 text-slate-500",
                                    )}>
                                      {field.type}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                            Database Name
                            <input
                              value={draft.dbName}
                              onChange={(e) => updateDraft({ dbName: e.target.value })}
                              className="mt-1.5 h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-medium normal-case tracking-normal text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-violet-600"
                              placeholder="users_email_ix"
                            />
                          </label>

                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={saveRestriction}
                              disabled={savingRestriction || draft.fields.length === 0}
                              className="h-9 flex-1 rounded-md bg-violet-600 px-3 text-xs font-semibold text-white shadow-sm transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                            >
                              {savingRestriction ? "Saving..." : "Save Restriction"}
                            </button>
                            <button
                              type="button"
                              onClick={resetDraft}
                              className="h-9 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
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
                                {restriction.source === "field" ? "Field" : "Model"}
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
                            <span className="text-slate-800">{restriction.dbName}</span>
                          </p>
                        ) : null}
                        <code className="mt-3 block overflow-x-auto rounded-md bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-50">
                          {restriction.preview}
                        </code>
                      </div>
                    ),
                  )}
                </div>
              )}
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
