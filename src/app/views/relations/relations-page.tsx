"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { IconChevronDown, IconChevronLeft, IconChevronRight, IconPencil, IconTrash } from "@tabler/icons-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { classNames } from "../shared/dashboard-data";
import { fieldTypeBadgeClass } from "@/lib/badge-utils";
import { toCamelCaseIdentifier } from "@/lib/schema-naming";
import { useProjectInfo } from "../shared/project-info-context";
import { useVersionDiffLookup } from "../shared/use-version-diff";
import { FkTypeDetailModal, VersionDiffBadge, ApproveWarningButton } from "../shared/version-diff-badge";
import type { FkTypeMismatch } from "../shared/version-diff-badge";
import { useSchemaWarnings } from "../shared/use-schema-warnings";
import type {
  PrismaField,
  PrismaModel,
  PrismaModelRelations,
  PrismaRelation,
} from "@/lib/schema-store";
import type {
  RelationCardinality,
  RelationDraft,
  RelationTab,
} from "@/types/relation";
import { relationKindLabel, relationKindClass } from "@/constants/relations";
import { RelationCard } from "./relation-card";
import { useRelationForm } from "@/hooks/use-relation-form";
import { RelationFormModal } from "./relation-form-modal";

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
  onDelete: "NoAction",
  onUpdate: "NoAction",
  nullable: true,
};


function toList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function toCsv(value: string[]) {
  return value.join(", ");
}

function deriveBackReferenceName(sourceName: string, relationName: string) {
  if (!sourceName && !relationName) return "";
  const source = sourceName ? `${sourceName.charAt(0).toLowerCase()}${sourceName.slice(1)}` : "";
  const rel = relationName ? `${relationName.charAt(0).toUpperCase()}${relationName.slice(1)}` : "";
  return `${source}${rel}`;
}

function emptyRelationDraftForModel(_modelName: string): RelationDraft {
  return { ...emptyRelationDraft };
}


export function RelationsPageContent() {
  const { projectName, version, hasProject, projectId, versions } = useProjectInfo();
  const previousVersion = versions[versions.indexOf(version) - 1] ?? "";
  const { getWarning, approve, unapprove } = useSchemaWarnings(projectId, previousVersion, version);
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [selectedModelName, setSelectedModelName] = useState(
    () => searchParams.get("table") ?? "",
  );
  const [tableSearch, setTableSearch] = useState("");
  const [isTableSelectorOpen, setIsTableSelectorOpen] = useState(false);
  const [activeRelationTab, setActiveRelationTab] =
    useState<RelationTab>("relations");
  const [relationTargetFilter, setRelationTargetFilter] = useState("");
  const [relationKindFilter, setRelationKindFilter] =
    useState<PrismaRelation["kind"] | "">("");
  const [relationPage, setRelationPage] = useState(1);
  const [fkDetailModal, setFkDetailModal] = useState<{
    relationName: string;
    targetTableName: string;
    mismatches: FkTypeMismatch[];
  } | null>(null);
  const modalTablesPerPage = 12;
  const relationsPerPage = 6;

  const { fkCascadeMap, relationDiffs, diffByRelationId } = useVersionDiffLookup(projectName, version);
  const removedRelationDiffs = relationDiffs.filter((d) => d.changeKind === "removed");

  const tablesQuery = useQuery(
    trpc.tables.list.queryOptions(
      { projectName, version },
      { enabled: !!projectName && !!version },
    ),
  );
  const models: PrismaModel[] = (tablesQuery.data ?? []) as PrismaModel[];

  const selectedModel = useMemo(
    () => models.find((model) => model.name === selectedModelName) ?? null,
    [models, selectedModelName],
  );
  const selectedModelKey = selectedModel?.key ?? "";

  const relationsQuery = useQuery(
    trpc.relations.list.queryOptions(
      { projectName, version, modelName: selectedModelName, modelKey: selectedModelKey },
      { enabled: !!selectedModelName },
    ),
  );
  const relations: PrismaRelation[] = relationsQuery.data?.relations ?? [];

  const sourceFieldsQuery = useQuery(
    trpc.fields.list.queryOptions(
      { projectName, version, modelName: selectedModelName, modelKey: selectedModelKey },
      { enabled: !!selectedModelName },
    ),
  );
  const sourceFields: PrismaField[] = sourceFieldsQuery.data?.fields ?? [];
  const sourceFieldNames = useMemo(
    () => new Set(sourceFields.filter((f) => !f.isRelation).map((f) => f.name)),
    [sourceFields],
  );

  const invalidateRelations = () =>
    queryClient.invalidateQueries({
      queryKey: trpc.relations.list.queryOptions({ projectName, version, modelName: selectedModelName, modelKey: selectedModelKey }).queryKey,
    });

  // ── Relation form hook (manages draft, edit state, mutations, handlers) ────

  const {
    draft, editingRelationKey, isRelationFormOpen, modalTableSearch, modalTablePage,
    fkFieldType, fkFieldDbName, deletingRelationKey, error, savingRelation,
    setFkFieldType, setFkFieldDbName, setModalTableSearch, setModalTablePage,
    setIsRelationFormOpen, setError,
    updateDraft, resetDraft, editRelation, saveRelation, deleteRelation,
  } = useRelationForm({ selectedModelName, selectedModelKey, models, invalidateRelations });

  const targetModel = models.find((m) => m.name === draft.targetModel);
  const targetFieldsQuery = useQuery(
    trpc.fields.list.queryOptions(
      { projectName, version, modelName: draft.targetModel, modelKey: targetModel?.key ?? "" },
      { enabled: !!draft.targetModel },
    ),
  );
  const targetFields: PrismaField[] = targetFieldsQuery.data?.fields ?? [];
  const selectableTargetFields = useMemo(
    () => targetFields.filter((field) => !field.isRelation && (field.isId || field.unique)),
    [targetFields],
  );

  const filteredModels = useMemo(
    () =>
      models.filter((model) =>
        model.name.toLowerCase().includes(tableSearch.toLowerCase()),
      ),
    [models, tableSearch],
  );

  const ownedRelations = useMemo(
    () => relations.filter((r) => !r.isBackReference),
    [relations],
  );
  const backReferences = useMemo(
    () => relations.filter((r) => r.isBackReference),
    [relations],
  );
  const visibleRelations = activeRelationTab === "relations" ? ownedRelations : backReferences;
  const fkNameConflict = useMemo(() => {
    if (!draft.fields.trim() || editingRelationKey) return false;
    const name = draft.fields.trim();
    const usedByRelation = ownedRelations.some((r) => r.fields.includes(name));
    const usedByField = sourceFieldNames.has(name);
    return usedByRelation || usedByField;
  }, [ownedRelations, editingRelationKey, draft.fields, sourceFieldNames]);

  const fkConflictIsExistingField = useMemo(() => {
    if (!draft.fields.trim() || editingRelationKey) return false;
    return sourceFieldNames.has(draft.fields.trim()) &&
      !ownedRelations.some((r) => r.fields.includes(draft.fields.trim()));
  }, [draft.fields, editingRelationKey, sourceFieldNames, ownedRelations]);

  const backRefConflict = useMemo(() => {
    if (!draft.backReferenceName.trim() || !draft.targetModel) return false;
    return ownedRelations
      .filter((r) => r.key !== editingRelationKey && r.targetModel === draft.targetModel)
      .some((r) => r.backReferenceName === draft.backReferenceName.trim());
  }, [ownedRelations, editingRelationKey, draft.backReferenceName, draft.targetModel]);

  const relationTargetOptions = useMemo(
    () =>
      Array.from(new Set(visibleRelations.map((r) => r.targetModel)))
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b)),
    [visibleRelations],
  );
  const relationKindOptions = useMemo(
    () =>
      Array.from(new Set(visibleRelations.map((r) => r.kind))).sort((a, b) =>
        relationKindLabel(a).localeCompare(relationKindLabel(b)),
      ),
    [visibleRelations],
  );
  const filteredVisibleRelations = useMemo(
    () =>
      visibleRelations.filter((r) => {
        const matchesTarget = !relationTargetFilter || r.targetModel === relationTargetFilter;
        const matchesKind = !relationKindFilter || r.kind === relationKindFilter;
        return matchesTarget && matchesKind;
      }),
    [relationKindFilter, relationTargetFilter, visibleRelations],
  );
  const relationPageCount = Math.max(1, Math.ceil(filteredVisibleRelations.length / relationsPerPage));
  const safeRelationPage = Math.min(relationPage, relationPageCount);
  const paginatedRelations = filteredVisibleRelations.slice(
    (safeRelationPage - 1) * relationsPerPage,
    safeRelationPage * relationsPerPage,
  );

  // Deselect model if it disappears from the list
  useEffect(() => {
    if (selectedModelName && models.length > 0 && !models.some((m) => m.name === selectedModelName)) {
      setSelectedModelName("");
    }
  }, [models, selectedModelName]);

  useEffect(() => {
    setRelationPage(1);
  }, [activeRelationTab, filteredVisibleRelations.length, relationKindFilter, relationTargetFilter, selectedModelName]);

  useEffect(() => {
    if (relationTargetFilter && !relationTargetOptions.includes(relationTargetFilter)) {
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

  // Auto-set FK field type from selected target reference field
  useEffect(() => {
    const refField = selectableTargetFields.find((f) => f.name === draft.references);
    if (refField) setFkFieldType(refField.type);
  }, [draft.references, selectableTargetFields]);

  // Sync selected table → URL param
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

  const selectModel = (modelName: string) => {
    setSelectedModelName(modelName);
    setTableSearch("");
    setRelationTargetFilter("");
    setRelationKindFilter("");
    setIsTableSelectorOpen(false);
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
          ) : relationsQuery.isLoading ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-8 text-center text-sm font-medium text-slate-500">
              Loading relations...
            </div>
          ) : (
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
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => { resetDraft(); setIsRelationFormOpen(true); }}
                    className="h-9 rounded-md bg-violet-600 px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-violet-700"
                  >
                    + Create Relation
                  </button>
                </div>
              </div>

              {removedRelationDiffs.filter((d) => d.sourceTableName === selectedModelName).length > 0 && (
                <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                  <div className="flex items-center justify-between gap-3">
                    <span>
                      {removedRelationDiffs.filter((d) => d.sourceTableName === selectedModelName).length === 1
                        ? "1 relation removed since the previous version"
                        : `${removedRelationDiffs.filter((d) => d.sourceTableName === selectedModelName).length} relations removed since the previous version`}
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {removedRelationDiffs
                        .filter((d) => d.sourceTableName === selectedModelName)
                        .map((d) => (
                          <ApproveWarningButton
                            key={d.relationId}
                            warning={getWarning("relation", d.relationId, d.changeKind)}
                            onApprove={approve}
                            onUnapprove={unapprove}
                          />
                        ))}
                    </div>
                  </div>
                  <ul className="mt-1.5 list-disc pl-4 text-xs font-normal text-red-600">
                    {removedRelationDiffs
                      .filter((d) => d.sourceTableName === selectedModelName)
                      .map((d) => (
                        <li key={d.relationId}>{d.message}</li>
                      ))}
                  </ul>
                </div>
              )}

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
                        : "No back references yet. Create a relation from another table that targets this one."}
                  </div>
                ) : (
                  <div className="grid gap-3 lg:grid-cols-2">
                    {paginatedRelations.map((relation) => {
                      const modelCascadeHints = fkCascadeMap.get(selectedModelName);
                      const fksMissing = activeRelationTab === "relations" &&
                        relation.fields.length > 0 && sourceFields.length > 0 &&
                        relation.fields.some((f) => !sourceFieldNames.has(f));
                      const fkTypeMismatches = activeRelationTab === "relations"
                        ? relation.fields.flatMap((f) => {
                            const info = modelCascadeHints?.get(f);
                            return info ? [{ fieldName: f, ...info }] : [];
                          })
                        : [];
                      const hasFkTypeMismatch = fkTypeMismatches.length > 0;
                      const isNewRelation = diffByRelationId.get(relation.key)?.changeKind === "added";
                      return (
                        <RelationCard
                          key={relation.key}
                          relation={relation}
                          activeRelationTab={activeRelationTab}
                          selectedModelName={selectedModelName}
                          modelCascadeHints={modelCascadeHints}
                          fksMissing={fksMissing}
                          hasFkTypeMismatch={hasFkTypeMismatch}
                          fkTypeMismatches={fkTypeMismatches}
                          isNewRelation={!!isNewRelation}
                          isDeleting={deletingRelationKey === relation.key}
                          onEdit={() => editRelation(relation)}
                          onDelete={() => deleteRelation(relation)}
                          onShowFkDetail={(mismatches, relationName, targetTableName) =>
                            setFkDetailModal({ relationName, targetTableName, mismatches })
                          }
                        />
                      );
                    })}
                  </div>
                )}

                {visibleRelations.length > relationsPerPage ? (
                  <div className="mt-4 flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => setRelationPage((page) => Math.max(1, page - 1))}
                      disabled={safeRelationPage === 1}
                      className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 transition hover:border-violet-200 hover:text-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <IconChevronLeft size={16} />
                    </button>
                    <span className="text-sm font-semibold text-slate-600">
                      {safeRelationPage} / {relationPageCount}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setRelationPage((page) => Math.min(relationPageCount, page + 1))
                      }
                      disabled={safeRelationPage === relationPageCount}
                      className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 transition hover:border-violet-200 hover:text-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <IconChevronRight size={16} />
                    </button>
                  </div>
                ) : null}
            </div>
          )}
        </div>
      </section>

      <RelationFormModal
        isOpen={isRelationFormOpen}
        selectedModelName={selectedModelName}
        editingRelationKey={editingRelationKey}
        draft={draft}
        fkNameConflict={fkNameConflict}
        fkConflictIsExistingField={fkConflictIsExistingField}
        backRefConflict={backRefConflict}
        savingRelation={savingRelation}
        modalTableSearch={modalTableSearch}
        modalTablePage={modalTablePage}
        modalTablesPerPage={modalTablesPerPage}
        fkFieldType={fkFieldType}
        fkFieldDbName={fkFieldDbName}
        error={error}
        models={models}
        tablesIsLoading={tablesQuery.isLoading}
        targetFieldsIsLoading={targetFieldsQuery.isLoading}
        selectableTargetFields={selectableTargetFields}
        onCancel={resetDraft}
        onSave={saveRelation}
        onUpdateDraft={updateDraft}
        onTableSearchChange={setModalTableSearch}
        onTablePageChange={setModalTablePage}
        onFkDbNameChange={setFkFieldDbName}
      />

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

      {fkDetailModal ? (
        <FkTypeDetailModal
          relationName={fkDetailModal.relationName}
          sourceTableName={selectedModelName}
          targetTableName={fkDetailModal.targetTableName}
          mismatches={fkDetailModal.mismatches}
          fromVersion={previousVersion}
          toVersion={version}
          onClose={() => setFkDetailModal(null)}
        />
      ) : null}
    </div>
  );
}
