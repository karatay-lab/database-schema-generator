"use client";

import { useEffect, useMemo, useState } from "react";
import { useRelationFilters } from "@/hooks/use-relation-filters";
import { useRouter, useSearchParams } from "next/navigation";
import { IconChevronDown } from "@tabler/icons-react";
import { EmptyState, LoadingCard, Pagination } from "@/components/built";
import { useRelationsQuery } from "@/queries/relations";
import { useTablesQuery } from "@/queries/tables";
import { useFieldsQuery } from "@/queries/fields";
import { classNames } from "@/lib/utils";
import { fieldTypeBadgeClass } from "@/lib/badge-utils";

import { useProjectInfo } from "../shared/project-info-context";
import { useVersionDiffLookup } from "@/hooks/use-version-diff";
import { VersionDiffBadge, ApproveWarningButton } from "@/components/shared/version-diff-badge";
import { FkTypeDetailModal } from "@/components/relations/fk-type-detail-modal";
import type { FkTypeMismatch } from "@/components/relations/fk-type-detail-modal";
import { useSchemaWarnings } from "@/hooks/use-schema-warnings";
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
import { RelationCard } from "@/components/relations/relation-card";
import { useRelationForm } from "@/hooks/use-relation-form";
import { RelationFormModal } from "@/components/relations/relation-form-modal";
import { TableSelectorModal } from "@/features/table-selector";

type RelationsResponse = Partial<PrismaModelRelations> & {
  error?: string;
}


export function RelationsPageContent() {
  const { projectName, version, hasProject, projectId, versions } = useProjectInfo();
  const previousVersion = versions[versions.indexOf(version) - 1] ?? "";
  const { getWarning, approve, unapprove } = useSchemaWarnings(projectId, previousVersion, version);
  const router = useRouter();
  const searchParams = useSearchParams();

  const [selectedModelName, setSelectedModelName] = useState(
    () => searchParams.get("table") ?? "",
  );
  const [tableSearch, setTableSearch] = useState("");
  const [isTableSelectorOpen, setIsTableSelectorOpen] = useState(false);
  const [fkDetailModal, setFkDetailModal] = useState<{
    relationName: string;
    targetTableName: string;
    mismatches: FkTypeMismatch[];
  } | null>(null);
  const modalTablesPerPage = 12;

  const { fkCascadeMap, relationDiffs, diffByRelationId } = useVersionDiffLookup(projectName, version);
  const removedRelationDiffs = relationDiffs.filter((d) => d.changeKind === "removed");

  const tablesQuery    = useTablesQuery(projectName, version);
  const models: PrismaModel[] = (tablesQuery.data ?? []) as PrismaModel[];

  const selectedModel   = useMemo(() => models.find((m) => m.name === selectedModelName) ?? null, [models, selectedModelName]);
  const selectedModelKey = selectedModel?.key ?? "";

  const relationsQuery  = useRelationsQuery(projectName, version, selectedModelName, selectedModelKey);
  const relations: PrismaRelation[] = relationsQuery.data?.relations ?? [];

  const sourceFieldsQuery = useFieldsQuery(projectName, version, selectedModelName, selectedModelKey);
  const sourceFields: PrismaField[] = sourceFieldsQuery.data?.fields ?? [];
  const sourceFieldNames = useMemo(
    () => new Set(sourceFields.filter((f) => !f.isRelation).map((f) => f.name)),
    [sourceFields],
  );

  // ── Relation form hook (manages draft, edit state, mutations, handlers) ────

  const {
    draft, editingRelationKey, isRelationFormOpen, modalTableSearch, modalTablePage,
    fkFieldType, fkFieldDbName, deletingRelationKey, error, savingRelation,
    setFkFieldType, setFkFieldDbName, setModalTableSearch, setModalTablePage,
    setIsRelationFormOpen, setError,
    updateDraft, resetDraft, editRelation, saveRelation, deleteRelation,
  } = useRelationForm({ selectedModelName, selectedModelKey, models });

  const targetModel      = models.find((m) => m.name === draft.targetModel);
  const targetFieldsQuery = useFieldsQuery(projectName, version, draft.targetModel, targetModel?.key ?? "");
  const targetFields: PrismaField[] = targetFieldsQuery.data?.fields ?? [];
  const selectableTargetFields = useMemo(
    () => targetFields.filter((field) => !field.isRelation && (field.isId || field.unique)),
    [targetFields],
  );

  const ownedRelations = useMemo(() => relations.filter((r) => !r.isBackReference), [relations]);
  const backReferences = useMemo(() => relations.filter((r) => r.isBackReference), [relations]);

  const filters = useRelationFilters({ ownedRelations, backReferences, selectedModelName });

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

  // Deselect model if it disappears from the list
  useEffect(() => {
    if (selectedModelName && models.length > 0 && !models.some((m) => m.name === selectedModelName)) {
      setSelectedModelName("");
    }
  }, [models, selectedModelName]);

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
    filters.setRelationTargetFilter("");
    filters.setRelationKindFilter("");
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
            <EmptyState
              message="Select a table to inspect its Prisma relations."
              action={{ label: "Select Table", onClick: () => setIsTableSelectorOpen(true), tone: "violet" }}
            />
          ) : relationsQuery.isLoading ? (
            <LoadingCard message="Loading relations…" />
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
                    ].map(([tab, label]) => (
                      <button key={tab} type="button"
                        onClick={() => filters.changeTab(tab as RelationTab)}
                        className={classNames(
                          "h-9 rounded-md px-4 text-sm font-semibold transition",
                          filters.activeRelationTab === tab ? "bg-white text-violet-700 shadow-sm" : "text-slate-600 hover:bg-white/70",
                        )}>
                        {label}
                      </button>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <label className="flex min-w-0 items-center gap-2 px-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                      Related table
                      <select
                        value={filters.relationTargetFilter}
                        onChange={(e) => filters.setRelationTargetFilter(e.target.value)}
                        disabled={filters.relationTargetOptions.length === 0}
                        className="h-9 min-w-44 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold normal-case tracking-normal text-slate-700 outline-none transition focus:border-violet-600 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                      >
                        <option value="">All tables</option>
                        {filters.relationTargetOptions.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </label>

                    <label className="flex min-w-0 items-center gap-2 px-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                      Type
                      <select
                        value={filters.relationKindFilter}
                        onChange={(e) => filters.setRelationKindFilter(e.target.value as PrismaRelation["kind"] | "")}
                        disabled={filters.relationKindOptions.length === 0}
                        className="h-9 min-w-40 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold normal-case tracking-normal text-slate-700 outline-none transition focus:border-violet-600 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                      >
                        <option value="">All types</option>
                        {filters.relationKindOptions.map((kind) => (
                          <option key={kind} value={kind}>{relationKindLabel(kind)}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>

                {filters.filteredVisibleRelations.length === 0 ? (
                  <EmptyState
                    message={
                      filters.relationTargetFilter || filters.relationKindFilter
                        ? "No relations found for the selected filters."
                        : filters.activeRelationTab === "relations"
                          ? "No owning relations found for this table."
                          : "No back references yet. Create a relation from another table that targets this one."
                    }
                  />
                ) : (
                  <div className="grid gap-3 lg:grid-cols-2">
                    {filters.paginatedRelations.map((relation) => {
                      const modelCascadeHints = fkCascadeMap.get(selectedModelName);
                      const fksMissing = filters.activeRelationTab === "relations" &&
                        relation.fields.length > 0 && sourceFields.length > 0 &&
                        relation.fields.some((f) => !sourceFieldNames.has(f));
                      const fkTypeMismatches = filters.activeRelationTab === "relations"
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
                          activeRelationTab={filters.activeRelationTab}
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
                          onNavigateToTable={(tableName) => {
                            selectModel(tableName);
                            // Flip the tab — from Relations (owning) click lands on References,
                            // from References (back-ref) click lands on Relations.
                            filters.changeTab(filters.activeRelationTab === "relations" ? "references" : "relations");
                          }}
                        />
                      );
                    })}
                  </div>
                )}

                <Pagination
                  page={filters.safeRelationPage}
                  pageCount={filters.relationPageCount}
                  onPageChange={filters.setRelationPage}
                  className="mt-4"
                />
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

      <TableSelectorModal
        isOpen={isTableSelectorOpen}
        models={models}
        selectedModelName={selectedModelName}
        search={tableSearch}
        isLoading={tablesQuery.isLoading}
        tone="violet"
        onSearch={setTableSearch}
        onSelect={selectModel}
        onClose={() => setIsTableSelectorOpen(false)}
        typeBadgeClass={fieldTypeBadgeClass}
      />

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
