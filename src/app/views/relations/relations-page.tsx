/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { classNames } from "../shared/dashboard-data";
import { fieldTypeBadgeClass } from "@/lib/badge-utils";
import { useProjectInfo } from "../shared/project-info-context";
import type {
  PrismaField,
  PrismaModel,
  PrismaModelRelations,
  PrismaRelation,
} from "@/lib/schema-store";
import type {
  FieldMappingPanel,
  RelationCardinality,
  RelationDraft,
  RelationTab,
} from "@/types/relation";

type RelationsResponse = Partial<PrismaModelRelations> & {
  error?: string;
};

const emptyRelationDraft: RelationDraft = {
  name: "",
  targetModel: "",
  backReferenceName: "",
  cardinality: "one-to-many",
  fields: "",
  references: "",
  onDelete: "",
  onUpdate: "",
  nullable: true,
};

const relationActionOptions = ["", "Cascade", "Restrict", "NoAction", "SetNull", "SetDefault"];
const relationCardinalityOptions: Array<{
  value: RelationCardinality;
  label: string;
}> = [
  { value: "one-to-one", label: "One to one" },
  { value: "one-to-many", label: "One to many" },
];

function buildLocalFieldName(targetTable: string, cardinality: string) {
  const type = cardinality === "one-to-one" ? "one" : "many";
  return `${targetTable}_${type}_id`;
}

function isAutoLocalField(value: string) {
  return /_(?:one|many)_id$/.test(value);
}

function toList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function toCsv(value: string[]) {
  return value.join(", ");
}

function defaultBackReferenceName(modelName: string) {
  return modelName ? `${modelName.charAt(0).toLowerCase()}${modelName.slice(1)}` : "";
}

function emptyRelationDraftForModel(modelName: string): RelationDraft {
  return {
    ...emptyRelationDraft,
    backReferenceName: defaultBackReferenceName(modelName),
  };
}


function relationKindLabel(kind: PrismaRelation["kind"]) {
  const labels: Record<PrismaRelation["kind"], string> = {
    "one-to-one": "One to one",
    "one-to-many": "One to many",
    "many-to-one": "Many to one",
    "many-to-many": "Many to many",
  };

  return labels[kind];
}

function relationKindClass(kind: PrismaRelation["kind"]) {
  const classes: Record<PrismaRelation["kind"], string> = {
    "one-to-one": "border-cyan-200 bg-cyan-50 text-cyan-700",
    "one-to-many": "border-emerald-200 bg-emerald-50 text-emerald-700",
    "many-to-one": "border-violet-200 bg-violet-50 text-violet-700",
    "many-to-many": "border-amber-200 bg-amber-50 text-amber-700",
  };

  return classes[kind];
}

function FieldPills({
  emptyLabel,
  fields,
}: {
  emptyLabel: string;
  fields: string[];
}) {
  if (fields.length === 0) {
    return <span className="text-xs font-semibold text-slate-400">{emptyLabel}</span>;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {fields.map((field) => (
        <span
          key={field}
          className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700"
        >
          {field}
        </span>
      ))}
    </div>
  );
}

export function RelationsPageContent() {
  const { projectName, version, hasProject } = useProjectInfo();

  const [models, setModels] = useState<PrismaModel[]>([]);
  const [loadingTables, setLoadingTables] = useState(true);
  const [selectedModelName, setSelectedModelName] = useState("");
  const [tableSearch, setTableSearch] = useState("");
  const [isTableSelectorOpen, setIsTableSelectorOpen] = useState(false);
  const [targetFields, setTargetFields] = useState<PrismaField[]>([]);
  const [relations, setRelations] = useState<PrismaRelation[]>([]);
  const [loadingRelations, setLoadingRelations] = useState(false);
  const [loadingTargetFields, setLoadingTargetFields] = useState(false);
  const [activeRelationTab, setActiveRelationTab] =
    useState<RelationTab>("relations");
  const [relationTargetFilter, setRelationTargetFilter] = useState("");
  const [relationKindFilter, setRelationKindFilter] =
    useState<PrismaRelation["kind"] | "">("");
  const [relationPage, setRelationPage] = useState(1);
  const [draft, setDraft] = useState<RelationDraft>(emptyRelationDraft);
  const [openFieldMappingPanel, setOpenFieldMappingPanel] =
    useState<FieldMappingPanel>("local");
  const [editingRelationKey, setEditingRelationKey] = useState("");
  const [savingRelation, setSavingRelation] = useState(false);
  const [deletingRelation, setDeletingRelation] = useState("");
  const [error, setError] = useState("");
  const relationsPerPage = 6;

  const selectedModel = useMemo(
    () => models.find((model) => model.name === selectedModelName) ?? null,
    [models, selectedModelName],
  );
  const selectedModelKey = selectedModel?.key ?? "";

  const filteredModels = useMemo(
    () =>
      models.filter((model) =>
        model.name.toLowerCase().includes(tableSearch.toLowerCase()),
      ),
    [models, tableSearch],
  );

  const ownedRelations = useMemo(
    () =>
      relations.filter(
        (relation) => !relation.isBackReference,
      ),
    [relations],
  );
  const backReferences = useMemo(
    () =>
      relations.filter(
        (relation) => relation.isBackReference,
      ),
    [relations],
  );
  const visibleRelations =
    activeRelationTab === "relations" ? ownedRelations : backReferences;
  const relationTargetOptions = useMemo(
    () =>
      Array.from(new Set(visibleRelations.map((relation) => relation.targetModel)))
        .filter(Boolean)
        .sort((left, right) => left.localeCompare(right)),
    [visibleRelations],
  );
  const relationKindOptions = useMemo(
    () =>
      Array.from(new Set(visibleRelations.map((relation) => relation.kind))).sort(
        (left, right) =>
          relationKindLabel(left).localeCompare(relationKindLabel(right)),
      ),
    [visibleRelations],
  );
  const filteredVisibleRelations = useMemo(
    () =>
      visibleRelations.filter((relation) => {
        const matchesTarget =
          !relationTargetFilter || relation.targetModel === relationTargetFilter;
        const matchesKind =
          !relationKindFilter || relation.kind === relationKindFilter;

        return matchesTarget && matchesKind;
      }),
    [relationKindFilter, relationTargetFilter, visibleRelations],
  );
  const relationPageCount = Math.max(
    1,
    Math.ceil(filteredVisibleRelations.length / relationsPerPage),
  );
  const paginatedRelations = filteredVisibleRelations.slice(
    (relationPage - 1) * relationsPerPage,
    relationPage * relationsPerPage,
  );
  const selectableTargetFields = useMemo(
    () => targetFields.filter((field) => !field.isRelation),
    [targetFields],
  );

  const loadTables = useCallback(async () => {
    if (!projectName || !version) {
      return [];
    }

    try {
      const params = new URLSearchParams({ projectName, version });
      const response = await fetch(`/api/tables?${params}`);
      const data = (await response.json()) as { models?: PrismaModel[] };
      return data.models ?? [];
    } catch {
      return [];
    }
  }, [projectName, version]);

  const loadRelations = useCallback(
    async (modelName: string, modelKey = "") => {
      if (!projectName || !version || (!modelName && !modelKey)) {
        setRelations([]);
        return;
      }

      setLoadingRelations(true);
      setError("");

      try {
        const params = new URLSearchParams({ projectName, version });
        if (modelName) {
          params.set("modelName", modelName);
        }
        if (modelKey) {
          params.set("modelKey", modelKey);
        }

        const response = await fetch(`/api/schema-relations?${params}`);
        const data = (await response.json()) as RelationsResponse;

        if (!response.ok) {
          throw new Error(data.error ?? "Failed to load relations.");
        }

        setRelations(data.relations ?? []);
      } catch (err) {
        setRelations([]);
        setError(err instanceof Error ? err.message : "Failed to load relations.");
      } finally {
        setLoadingRelations(false);
      }
    },
    [projectName, version],
  );

  const loadTargetFields = useCallback(
    async (targetModelName: string) => {
      if (!projectName || !version || !targetModelName) {
        setTargetFields([]);
        return;
      }

      const targetModel = models.find((model) => model.name === targetModelName);

      setLoadingTargetFields(true);

      try {
        const params = new URLSearchParams({
          projectName,
          version,
          modelName: targetModelName,
        });
        if (targetModel?.key) {
          params.set("modelKey", targetModel.key);
        }

        const response = await fetch(`/api/schema-fields?${params}`);
        const data = (await response.json()) as { fields?: PrismaField[] };

        if (!response.ok) {
          throw new Error("Failed to load target fields.");
        }

        setTargetFields(data.fields ?? []);
      } catch {
        setTargetFields([]);
      } finally {
        setLoadingTargetFields(false);
      }
    },
    [models, projectName, version],
  );

  useEffect(() => {
    setLoadingTables(true);
    loadTables().then((data) => {
      setModels(data);
      setLoadingTables(false);

      if (
        selectedModelName &&
        !data.some((model) => model.name === selectedModelName)
      ) {
        setSelectedModelName("");
      }
    });
  }, [loadTables, selectedModelName]);

  useEffect(() => {
    void loadRelations(selectedModelName, selectedModelKey);
  }, [loadRelations, selectedModelKey, selectedModelName]);

  useEffect(() => {
    setDraft(emptyRelationDraftForModel(selectedModelName));
    setEditingRelationKey("");
    setError("");
  }, [selectedModelName]);

  useEffect(() => {
    void loadTargetFields(draft.targetModel);
  }, [draft.targetModel, loadTargetFields]);

  useEffect(() => {
    setRelationPage(1);
  }, [
    activeRelationTab,
    filteredVisibleRelations.length,
    relationKindFilter,
    relationTargetFilter,
    selectedModelName,
  ]);

  useEffect(() => {
    if (
      relationTargetFilter &&
      !relationTargetOptions.includes(relationTargetFilter)
    ) {
      setRelationTargetFilter("");
    }
  }, [relationTargetFilter, relationTargetOptions]);

  useEffect(() => {
    if (relationKindFilter && !relationKindOptions.includes(relationKindFilter)) {
      setRelationKindFilter("");
    }
  }, [relationKindFilter, relationKindOptions]);

  useEffect(() => {
    setRelationPage((page) => Math.min(page, relationPageCount));
  }, [relationPageCount]);

  const selectModel = (modelName: string) => {
    setSelectedModelName(modelName);
    setTableSearch("");
    setRelationTargetFilter("");
    setRelationKindFilter("");
    setIsTableSelectorOpen(false);
  };

  const refreshRelations = (data: RelationsResponse) => {
    setRelations(data.relations ?? []);
  };

  const updateDraft = (patch: Partial<RelationDraft>) => {
    setDraft((currentDraft) => {
      const nextDraft = { ...currentDraft, ...patch };
      if (patch.targetModel) {
        const targetModel = models.find((model) => model.name === patch.targetModel);
        nextDraft.references = targetModel?.pkName || "id";
      }

      return nextDraft;
    });
    setError("");
  };

  const resetDraft = () => {
    setDraft(emptyRelationDraftForModel(selectedModelName));
    setEditingRelationKey("");
    setError("");
  };

  const editRelation = (relation: PrismaRelation) => {
    setDraft({
      name: relation.name,
      targetModel: relation.targetModel,
      backReferenceName:
        relation.backReferenceName || defaultBackReferenceName(selectedModelName),
      cardinality: relation.kind === "one-to-one" ? "one-to-one" : "one-to-many",
      fields: toCsv(relation.fields),
      references: toCsv(relation.references),
      onDelete: relation.onDelete,
      onUpdate: relation.onUpdate,
      nullable: relation.nullable,
    });
    setEditingRelationKey(relation.key);
    setError("");
  };

  const saveRelation = async () => {
    if (
      !selectedModelName ||
      !draft.name.trim() ||
      !draft.targetModel.trim() ||
      !draft.backReferenceName.trim() ||
      !draft.fields.trim() ||
      !draft.references.trim()
    ) {
      setError("Relation field, target table, back reference, local field, and target reference are required.");
      return;
    }

    try {
      setSavingRelation(true);
      setError("");
      const response = await fetch("/api/schema-relations", {
        method: editingRelationKey ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectName,
          version,
          modelKey: selectedModelKey,
          modelName: selectedModelName,
          relationKey: editingRelationKey,
          name: draft.name,
          targetModel: draft.targetModel,
          backReferenceName: draft.backReferenceName,
          fields: toList(draft.fields),
          references: toList(draft.references),
          onDelete: draft.onDelete,
          onUpdate: draft.onUpdate,
          nullable: draft.nullable,
          isArray: false,
          backReferenceIsArray: draft.cardinality === "one-to-many",
        }),
      });
      const data = (await response.json()) as RelationsResponse;

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to save relation.");
      }

      refreshRelations(data);
      resetDraft();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save relation.");
    } finally {
      setSavingRelation(false);
    }
  };

  const deleteRelation = async (relation: PrismaRelation) => {
    try {
      setDeletingRelation(relation.key);
      setError("");
      const response = await fetch("/api/schema-relations", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectName,
          version,
          modelKey: selectedModelKey,
          modelName: selectedModelName,
          relationKey: relation.key,
        }),
      });
      const data = (await response.json()) as RelationsResponse;

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to delete relation.");
      }

      refreshRelations(data);
      if (editingRelationKey === relation.key) {
        resetDraft();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete relation.");
    } finally {
      setDeletingRelation("");
    }
  };

  if (!hasProject) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-8 text-center">
        <p className="text-slate-600">Select a project to inspect table relations.</p>
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
                Select a table to inspect its Prisma relations.
              </p>
              <button
                type="button"
                onClick={() => setIsTableSelectorOpen(true)}
                className="mt-4 h-10 min-w-44 rounded-md bg-violet-600 px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700"
              >
                Select Table
              </button>
            </div>
          ) : loadingRelations ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-8 text-center text-sm font-medium text-slate-500">
              Loading relations...
            </div>
          ) : (
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
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
                    {ownedRelations.length} relations / {backReferences.length} references
                  </span>
                </div>

                <div className="mb-4 flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 p-1.5 md:flex-row md:items-center md:justify-between">
                  <div className="flex flex-wrap gap-2">
                    {[
                      ["relations", `Relations (${ownedRelations.length})`],
                      ["references", `References (${backReferences.length})`],
                    ].map(([tab, label]) => {
                      const isActive = activeRelationTab === tab;

                      return (
                        <button
                          key={tab}
                          type="button"
                          onClick={() => {
                            setActiveRelationTab(tab as RelationTab);
                            setRelationTargetFilter("");
                            setRelationKindFilter("");
                          }}
                          className={classNames(
                            "h-9 rounded-md px-4 text-sm font-semibold transition",
                            isActive
                              ? "bg-white text-violet-700 shadow-sm"
                              : "text-slate-600 hover:bg-white/70",
                          )}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <label className="flex min-w-0 items-center gap-2 px-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                      Related table
                      <select
                        value={relationTargetFilter}
                        onChange={(event) =>
                          setRelationTargetFilter(event.target.value)
                        }
                        disabled={relationTargetOptions.length === 0}
                        className="h-9 min-w-44 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold normal-case tracking-normal text-slate-700 outline-none transition focus:border-violet-600 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                      >
                        <option value="">All tables</option>
                        {relationTargetOptions.map((targetModel) => (
                          <option key={targetModel} value={targetModel}>
                            {targetModel}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="flex min-w-0 items-center gap-2 px-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                      Type
                      <select
                        value={relationKindFilter}
                        onChange={(event) =>
                          setRelationKindFilter(
                            event.target.value as PrismaRelation["kind"] | "",
                          )
                        }
                        disabled={relationKindOptions.length === 0}
                        className="h-9 min-w-40 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold normal-case tracking-normal text-slate-700 outline-none transition focus:border-violet-600 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                      >
                        <option value="">All types</option>
                        {relationKindOptions.map((kind) => (
                          <option key={kind} value={kind}>
                            {relationKindLabel(kind)}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>

                {filteredVisibleRelations.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm font-medium text-slate-500">
                    {relationTargetFilter || relationKindFilter
                      ? "No relations found for the selected filters."
                      : activeRelationTab === "relations"
                        ? "No owning relations found for this table."
                        : "No back references found for this table."}
                  </div>
                ) : (
                  <div className="grid gap-3 lg:grid-cols-2">
                    {paginatedRelations.map((relation) => (
                      <div
                        key={relation.key}
                        className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={classNames(
                                  "rounded-md border px-2 py-1 text-xs font-semibold",
                                  relationKindClass(relation.kind),
                                )}
                              >
                                {relationKindLabel(relation.kind)}
                              </span>
                              <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                                {relation.isArray
                                  ? "List"
                                  : relation.nullable
                                    ? "Optional"
                                    : "Required"}
                              </span>
                            </div>
                            <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                              <h5 className="truncate text-base font-semibold text-slate-950">
                                {relation.name}
                              </h5>
                              <span
                                className={classNames(
                                  "rounded-md border px-2.5 py-1 text-sm font-bold",
                                  activeRelationTab === "references"
                                    ? "border-amber-200 bg-amber-50 text-amber-700"
                                    : "border-cyan-200 bg-cyan-50 text-cyan-700",
                                )}
                              >
                                {activeRelationTab === "references" ? "from" : "to"}{" "}
                                {relation.targetModel}
                              </span>
                            </div>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-2">
                            {activeRelationTab === "relations" &&
                            relation.backReferenceName ? (
                              <span className="max-w-52 truncate rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
                                backref: {relation.backReferenceName}
                              </span>
                            ) : null}
                            {activeRelationTab === "relations" ? (
                              <div className="flex gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => editRelation(relation)}
                                  className="h-8 rounded-md border border-violet-200 bg-white px-2.5 text-xs font-semibold text-violet-700 transition hover:bg-violet-50"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void deleteRelation(relation)}
                                  disabled={deletingRelation === relation.key}
                                  className="h-8 rounded-md border border-rose-200 bg-white px-2.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:text-slate-400"
                                >
                                  {deletingRelation === relation.key
                                    ? "Deleting..."
                                    : "Delete"}
                                </button>
                              </div>
                            ) : null}
                          </div>
                        </div>

                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          <div>
                            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                              Local Fields
                            </p>
                            <FieldPills
                              emptyLabel="Implicit relation"
                              fields={relation.fields}
                            />
                          </div>
                          <div>
                            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                              References
                            </p>
                            <FieldPills
                              emptyLabel="Managed by Prisma"
                              fields={relation.references}
                            />
                          </div>
                        </div>

                        {relation.onDelete || relation.onUpdate ? (
                          <div className="mt-4 flex flex-wrap gap-2">
                            {relation.onDelete ? (
                              <span className="rounded-md bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700">
                                onDelete: {relation.onDelete}
                              </span>
                            ) : null}
                            {relation.onUpdate ? (
                              <span className="rounded-md bg-cyan-50 px-2 py-1 text-xs font-semibold text-cyan-700">
                                onUpdate: {relation.onUpdate}
                              </span>
                            ) : null}
                          </div>
                        ) : null}

                        <code className="mt-4 block overflow-x-auto rounded-md bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-50">
                          {relation.preview}
                        </code>
                      </div>
                    ))}
                  </div>
                )}

                {visibleRelations.length > relationsPerPage ? (
                  <div className="mt-4 flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => setRelationPage((page) => Math.max(1, page - 1))}
                      disabled={relationPage === 1}
                      className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-white text-sm font-semibold text-slate-600 transition hover:border-violet-200 hover:text-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {"<"}
                    </button>
                    <span className="text-sm font-semibold text-slate-600">
                      {relationPage} / {relationPageCount}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setRelationPage((page) => Math.min(relationPageCount, page + 1))
                      }
                      disabled={relationPage === relationPageCount}
                      className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-white text-sm font-semibold text-slate-600 transition hover:border-violet-200 hover:text-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {">"}
                    </button>
                  </div>
                ) : null}

                {error ? (
                  <p className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
                    {error}
                  </p>
                ) : null}
              </div>

              <div className="space-y-4">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                      {editingRelationKey ? "Update Relation" : "Create Relation"}
                    </p>
                    {editingRelationKey ? (
                      <button
                        type="button"
                        onClick={resetDraft}
                        className="h-8 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                    ) : null}
                  </div>

                  <div className="mt-4 space-y-3">
                    <div className="rounded-md border border-slate-200 bg-white p-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                        Basics
                      </p>
                      <div className="mt-3 space-y-3">
                        <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                          Relation Field
                          <input
                            value={draft.name}
                            onChange={(event) =>
                              updateDraft({ name: event.target.value })
                            }
                            onBlur={() => {}}
                            className="mt-2 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-medium normal-case tracking-normal text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-violet-600"
                            placeholder="company"
                          />
                        </label>

                        <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                          Target Table
                          <select
                            value={draft.targetModel}
                            onChange={(event) => {
                              const target = event.target.value;
                              const patch: Record<string, string> = { targetModel: target };
                              if (target && (!draft.fields.trim() || isAutoLocalField(draft.fields))) {
                                patch.fields = buildLocalFieldName(target, draft.cardinality);
                              }
                              updateDraft(patch);
                            }}
                            className="mt-2 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-medium normal-case tracking-normal text-slate-950 outline-none transition focus:border-violet-600"
                          >
                            <option value="">Select target</option>
                            {models.map((model) => (
                              <option key={model.key} value={model.name}>
                                {model.name}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                          Back reference field
                          <input
                            value={draft.backReferenceName}
                            onChange={(event) =>
                              updateDraft({
                                backReferenceName: event.target.value,
                              })
                            }
                            className="mt-2 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-medium normal-case tracking-normal text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-violet-600"
                            placeholder={defaultBackReferenceName(selectedModelName)}
                          />
                        </label>
                      </div>
                    </div>

                    <div className="rounded-md border border-slate-200 bg-white p-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                        Field mapping
                      </p>
                      <div className="mt-3 space-y-2">
                        <div className="overflow-hidden rounded-md border border-slate-200 bg-slate-50">
                          <button
                            type="button"
                            onClick={() => setOpenFieldMappingPanel("local")}
                            className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition hover:bg-white"
                          >
                            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                              Local fields
                            </span>
                            <span className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-violet-700">
                              {draft.fields || "None"}
                            </span>
                          </button>
                          {openFieldMappingPanel === "local" ? (
                            <div className="border-t border-slate-200 p-3">
                              <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                                Local field name
                                <input
                                  value={draft.fields}
                                  onChange={(event) =>
                                    updateDraft({ fields: event.target.value })
                                  }
                                  className="mt-2 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-medium normal-case tracking-normal text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-violet-600"
                                  placeholder={draft.targetModel ? buildLocalFieldName(draft.targetModel, draft.cardinality) : "[target]_[one|many]_id"}
                                />
                              </label>
                            </div>
                          ) : null}
                        </div>

                        <div className="overflow-hidden rounded-md border border-slate-200 bg-slate-50">
                          <button
                            type="button"
                            onClick={() => setOpenFieldMappingPanel("target")}
                            className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition hover:bg-white"
                          >
                            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                              Target references
                            </span>
                            <span className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-cyan-700">
                              {draft.references || "None"}
                            </span>
                          </button>
                          {openFieldMappingPanel === "target" ? (
                            <div className="border-t border-slate-200 p-2">
                              <div className="mb-2 flex justify-end px-1">
                                <button
                                  type="button"
                                  onClick={() => updateDraft({ references: "" })}
                                  disabled={!draft.references.trim()}
                                  className="h-7 rounded-md border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  Clear
                                </button>
                              </div>
                              <div className="max-h-56 space-y-1 overflow-y-auto">
                                {!draft.targetModel ? (
                                  <p className="px-2 py-3 text-center text-sm font-medium text-slate-500">
                                    Select a target table first.
                                  </p>
                                ) : loadingTargetFields ? (
                                  <p className="px-2 py-3 text-center text-sm font-medium text-slate-500">
                                    Loading target fields...
                                  </p>
                                ) : selectableTargetFields.length === 0 ? (
                                  <p className="px-2 py-3 text-center text-sm font-medium text-slate-500">
                                    No target fields available.
                                  </p>
                                ) : (
                                  selectableTargetFields.map((field) => {
                                    const selectedReferences = toList(draft.references);
                                    const isChecked = selectedReferences.includes(field.name);

                                    return (
                                      <label
                                        key={field.key}
                                        className="flex cursor-pointer items-center justify-between gap-3 rounded-md bg-white px-2 py-2 transition hover:bg-cyan-50"
                                      >
                                        <span className="min-w-0 truncate text-sm font-semibold text-slate-700">
                                          {field.name}
                                        </span>
                                        <input
                                          type="checkbox"
                                          checked={isChecked}
                                          onChange={() => {
                                            const nextReferences = isChecked
                                              ? selectedReferences.filter(
                                                  (item) => item !== field.name,
                                                )
                                              : [...selectedReferences, field.name];
                                            updateDraft({
                                              references: toCsv(nextReferences),
                                            });
                                          }}
                                          className="h-4 w-4 rounded border-slate-300 text-cyan-600"
                                        />
                                      </label>
                                    );
                                  })
                                )}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </div>

                      <div className="mt-3 grid gap-2 text-xs font-semibold text-slate-500 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                        <div className="rounded-md bg-slate-50 px-2 py-2">
                          Local:{" "}
                          <span className="text-slate-800">
                            {draft.fields || "None"}
                          </span>
                        </div>
                        <div className="rounded-md bg-slate-50 px-2 py-2">
                          References:{" "}
                          <span className="text-slate-800">
                            {draft.references || "None"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                          Relation type
                        </p>
                        <div className="mt-2 grid grid-cols-2 gap-1 rounded-md border border-slate-200 bg-slate-50 p-1">
                          {relationCardinalityOptions.map((option) => {
                            const isActive = draft.cardinality === option.value;

                            return (
                              <button
                                key={option.value}
                                type="button"
                                onClick={() => {
                                  const patch: Record<string, string> = { cardinality: option.value };
                                  if (draft.targetModel && (!draft.fields.trim() || isAutoLocalField(draft.fields))) {
                                    patch.fields = buildLocalFieldName(draft.targetModel, option.value);
                                  }
                                  updateDraft(patch);
                                }}
                                className={classNames(
                                  "h-9 rounded-md text-sm font-semibold transition",
                                  isActive
                                    ? "bg-white text-violet-700 shadow-sm"
                                    : "text-slate-600 hover:bg-white/70",
                                )}
                              >
                                {option.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
                        <input
                          type="checkbox"
                          checked={draft.nullable}
                          onChange={(event) =>
                            updateDraft({ nullable: event.target.checked })
                          }
                          className="h-4 w-4 rounded border-slate-300 text-violet-600"
                        />
                        Optional
                      </label>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                      <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                        On Delete
                        <select
                          value={draft.onDelete}
                          onChange={(event) =>
                            updateDraft({ onDelete: event.target.value })
                          }
                          className="mt-2 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-medium normal-case tracking-normal text-slate-950 outline-none transition focus:border-violet-600"
                        >
                          {relationActionOptions.map((option) => (
                            <option key={option || "default"} value={option}>
                              {option || "Default"}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                        On Update
                        <select
                          value={draft.onUpdate}
                          onChange={(event) =>
                            updateDraft({ onUpdate: event.target.value })
                          }
                          className="mt-2 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-medium normal-case tracking-normal text-slate-950 outline-none transition focus:border-violet-600"
                        >
                          {relationActionOptions.map((option) => (
                            <option key={option || "default"} value={option}>
                              {option || "Default"}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <button
                      type="button"
                      onClick={() => void saveRelation()}
                      disabled={
                        savingRelation ||
                        !draft.name.trim() ||
                        !draft.targetModel.trim() ||
                        !draft.backReferenceName.trim() ||
                        !draft.fields.trim() ||
                        !draft.references.trim()
                      }
                      className="h-10 w-full rounded-md bg-violet-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      {savingRelation
                        ? "Saving..."
                        : editingRelationKey
                          ? "Save Relation"
                          : "Create Relation"}
                    </button>
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
                {loadingTables ? (
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
