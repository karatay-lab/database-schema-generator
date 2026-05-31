"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { useProjectInfo } from "../shared/project-info-context";
import { useVersionDiffLookup } from "@/hooks/use-version-diff";
import { useFieldEditor } from "@/hooks/use-field-editor";
import { useFieldTemplates } from "@/hooks/use-field-templates";
import Link from "next/link";
import { VersionDiffBadge } from "@/components/shared/version-diff-badge";
import { classNames } from "@/lib/utils";
import { EmptyState, InlineError, LoadingCard, Pagination } from "@/components/built";
import type { PrismaModel } from "@/lib/schema-store";
import { typeBadgeClass } from "@/constants/schema";
import { FieldLegend } from "@/components/schema/field-legend";
import { TableSelectorModal } from "@/features/table-selector";
import { TemplatesModal } from "@/components/schema/templates-modal";
import { FieldCard } from "@/components/schema/field-card";
import { NewFieldCard } from "@/components/schema/new-field-card";
import { TemplateDropdown } from "@/components/schema/template-dropdown";
import { RemovedFieldsSection } from "@/components/schema/removed-fields-section";

export function SchemaPageContent() {
  const { projectName, version, versions, hasProject, provider: projectProvider, projectId } = useProjectInfo();
  const { diffByFieldKey, diffByTableKey } = useVersionDiffLookup(projectName, version);
  const versionIdx = versions.indexOf(version);
  const previousVersion = versionIdx > 0 ? versions[versionIdx - 1]! : "";
  const activeProject = hasProject;
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();

  // ── URL-synced + UI toggle state ───────────────────────────────────────────
  const [selectedModelName, setSelectedModelName] = useState(() => searchParams.get("table") ?? "");
  const [tableSearch, setTableSearch] = useState("");
  const [isFieldLegendOpen, setIsFieldLegendOpen] = useState(true);
  const [isTableSelectorOpen, setIsTableSelectorOpen] = useState(false);
  const [isTemplatesOpen, setIsTemplatesOpen] = useState(false);

  // ── Queries ────────────────────────────────────────────────────────────────
  const tablesQuery = useQuery(trpc.tables.list.queryOptions({ projectName, version }, { enabled: !!projectName && !!version }));
  const models: PrismaModel[] = (tablesQuery.data ?? []) as PrismaModel[];

  const selectedModel = useMemo(() => models.find((m) => m.name === selectedModelName) ?? null, [models, selectedModelName]);
  const selectedModelKey = selectedModel?.key ?? "";

  const removedFieldDiffs = useMemo(() => {
    const td = selectedModelKey ? diffByTableKey.get(selectedModelKey) : null;
    return (td?.fieldDiffs ?? []).filter((fd) => fd.changeKind === "removed" && !fd.isPk);
  }, [selectedModelKey, diffByTableKey]);

  const fieldsQuery = useQuery(trpc.fields.list.queryOptions(
    { projectName, version, modelName: selectedModelName, modelKey: selectedModelKey },
    { enabled: !!selectedModelName },
  ));
  const fields = fieldsQuery.data?.fields ?? [];
  const enumTypes: string[] = fieldsQuery.data?.enumTypes ?? [];
  const scalarTypes: string[] = fieldsQuery.data?.scalarTypes ?? [];

  const enumsListQuery = useQuery(trpc.enums.list.queryOptions({ projectName, version }, { enabled: !!projectName && !!version }));
  const enumsList = enumsListQuery.data ?? [];
  const getEnumValues = (enumName: string) => enumsList.find((e) => e.name === enumName)?.values ?? [];

  // ── Field editor hook (mutations, drafts, filter, pagination) ──────────────
  const editor = useFieldEditor({
    projectName, version, selectedModelName, selectedModelKey,
    fields, enumTypes, scalarTypes,
  });

  // ── Field templates hook ───────────────────────────────────────────────────
  const invalidateFields = () =>
    queryClient.invalidateQueries({
      queryKey: trpc.fields.list.queryOptions({ projectName, version, modelName: selectedModelName, modelKey: selectedModelKey }).queryKey,
    });

  const templateState = useFieldTemplates({ selectedModelName, selectedModelKey, fields, invalidateFields });

  const baseDropdownTemplates = useMemo(
    () => templateState.templates.filter(
      (t) => (t.provider === "All" || t.provider === projectProvider) && !templateState.usedTemplateNames.has(t.name),
    ),
    [templateState.templates, projectProvider, templateState.usedTemplateNames],
  );

  // ── Effects ────────────────────────────────────────────────────────────────

  // Deselect model if it disappears from the list
  useEffect(() => {
    if (selectedModelName && models.length > 0 && !models.some((m) => m.name === selectedModelName)) {
      setSelectedModelName("");
    }
  }, [models, selectedModelName]);

  // Sync selected model name to URL
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (selectedModelName) { params.set("table", selectedModelName); } else { params.delete("table"); }
    if (params.toString() !== searchParams.toString()) router.replace(`?${params.toString()}`, { scroll: false });
  }, [selectedModelName]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectModel = (modelName: string) => { setSelectedModelName(modelName); setIsTableSelectorOpen(false); };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {!activeProject ? (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center">
          <p className="text-slate-600">Select a project to manage schema fields.</p>
          <button type="button" onClick={() => setIsTemplatesOpen(true)}
            className="mt-4 h-9 rounded-md border border-emerald-300 bg-white px-5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50">
            Field Templates
          </button>
        </div>
      ) : (
        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Main Window</p>
                <h3 className="mt-1 text-xl font-semibold text-slate-950">Schema workspace</h3>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-xs font-medium text-slate-400">{projectName}-{version}.prisma</span>
                  <span className="text-slate-300">·</span>
                  <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Table:</span>
                  <span className="text-base font-bold text-cyan-700">{selectedModel ? selectedModel.name : "—"}</span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button type="button" onClick={() => setIsTemplatesOpen(true)}
                  className="h-9 min-w-32 rounded-md border border-emerald-300 bg-white px-4 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50">
                  Templates
                </button>
                <button type="button" onClick={() => setIsTableSelectorOpen(true)}
                  className="h-9 min-w-36 rounded-md border border-cyan-300 bg-white px-5 text-xs font-semibold text-cyan-700 transition hover:bg-cyan-50">
                  Select Table
                </button>
                {selectedModelName ? (
                  <TemplateDropdown
                    baseTemplates={baseDropdownTemplates}
                    addingTemplateId={templateState.addingTemplateToTable}
                    onAddNewField={editor.addNewFieldCard}
                    onAddTemplate={(t) => templateState.addTemplateToTable(t)()}
                    onOpenFullTemplates={() => setIsTemplatesOpen(true)}
                  />
                ) : null}
              </div>
            </div>
          </div>

          <div className="p-5">
            {!selectedModelName ? (
              <EmptyState
                message="Select a table to edit its fields."
                action={{ label: "Select Table", onClick: () => setIsTableSelectorOpen(true), tone: "cyan" }}
              />
            ) : fieldsQuery.isLoading ? (
              <LoadingCard message="Loading fields…" />
            ) : (
              <div className="space-y-5">
                <div>
                  {/* ── Header row: table name + controls ──────────────────── */}
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    {/* Left: label + name + diff badge */}
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Selected Table</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <h4 className="text-xl font-bold text-slate-950">{selectedModelName}</h4>
                        {(() => {
                          const td = selectedModelKey ? diffByTableKey.get(selectedModelKey) : null;
                          return td ? <VersionDiffBadge severity={td.severity} title={td.message} /> : null;
                        })()}
                      </div>
                    </div>

                    {/* Right: type filter + count + legend */}
                    <div className="flex flex-wrap items-center gap-3">
                      <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                        Type
                        <select value={editor.fieldTypeFilter} onChange={(e) => editor.setFieldTypeFilter(e.target.value)}
                          className="h-9 min-w-36 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold normal-case tracking-normal text-slate-700 outline-none transition focus:border-cyan-600">
                          <option value="All">All fields</option>
                          {editor.fieldFilterOptions.map((type) => <option key={type} value={type}>{type}</option>)}
                        </select>
                      </label>
                      <span className="text-xs font-semibold text-slate-400">
                        {editor.filteredFields.length} shown · {editor.editableFields.length} editable · {editor.preservedFieldCount} preserved
                      </span>
                      <button type="button" onClick={() => setIsFieldLegendOpen((o) => !o)}
                        className={classNames(
                          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold transition",
                          isFieldLegendOpen
                            ? "border-cyan-300 bg-cyan-50 text-cyan-700"
                            : "border-slate-300 bg-white text-slate-500 hover:border-cyan-200 hover:text-cyan-600",
                        )}
                        title="Field legend">?</button>
                    </div>
                  </div>

                  {/* Resolve banner — full width, only when table has diffs */}
                  {(() => {
                    const td = selectedModelKey ? diffByTableKey.get(selectedModelKey) : null;
                    if (!td) return null;
                    return (
                      <Link
                        href="/tracking?resolve=schema"
                        className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-5 py-3.5 transition hover:bg-amber-100 hover:border-amber-400 active:scale-[0.99]"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-xl">⚠</span>
                          <div>
                            <p className="text-sm font-bold text-amber-800">Schema changes need review</p>
                            <p className="mt-0.5 text-xs text-amber-600">
                              Some fields have type, nullability, or naming changes. Approve them in the Tracking workflow before running a migration.
                            </p>
                          </div>
                        </div>
                        <span className="shrink-0 rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-700 shadow-sm">
                          Resolve in Tracking →
                        </span>
                      </Link>
                    );
                  })()}

                  {isFieldLegendOpen ? <FieldLegend /> : null}

                  {editor.editableFields.length === 0 ? (
                    <EmptyState message="No editable scalar fields found." />
                  ) : editor.filteredFields.length === 0 ? (
                    <EmptyState message="No fields match the selected type filter." />
                  ) : (
                    <div className="space-y-4">
                      {editor.newFieldDrafts.length > 0 && (
                        <div className="grid gap-3 xl:grid-cols-2 2xl:grid-cols-3">
                          {editor.newFieldDrafts.map((draft) => (
                            <NewFieldCard key={draft.id} draft={draft}
                              enumTypes={enumTypes} scalarTypeOptions={editor.scalarTypeOptions}
                              savingNewCardId={editor.savingNewCardId} getEnumValues={getEnumValues}
                              onUpdate={editor.updateNewFieldDraft} onSave={editor.saveNewFieldDraft} onRemove={editor.removeNewFieldDraft}
                            />
                          ))}
                        </div>
                      )}
                      <div className="grid gap-3 xl:grid-cols-2 2xl:grid-cols-3">
                        {editor.paginatedFields.map((field) => {
                          const draft = editor.fieldDrafts[field.key];
                          if (!draft) return null;
                          const hasChanges =
                            draft.name !== field.name || draft.type !== field.type || draft.nullable !== field.nullable ||
                            draft.unique !== field.unique || (draft.defaultValue ?? "") !== (field.defaultValue ?? "") ||
                            (draft.comment ?? "") !== (field.comment ?? "");
                          const fieldDiff = diffByFieldKey.get(field.key);
                          const cardBorder = fieldDiff
                            ? fieldDiff.severity === "breaking" ? "border-red-300"
                              : fieldDiff.severity === "warning" ? "border-amber-300" : "border-sky-300"
                            : "border-slate-200";
                          return (
                            <FieldCard key={field.key} field={field} draft={draft} hasChanges={hasChanges}
                              fieldDiff={fieldDiff} cardBorder={cardBorder}
                              enumTypes={enumTypes} scalarTypeOptions={editor.scalarTypeOptions}
                              savingFieldKey={editor.savingFieldKey} deletingFieldKey={editor.deletingFieldKey}
                              getEnumValues={getEnumValues}
                              onUpdateDraft={editor.updateDraft} onSave={editor.saveField} onDelete={editor.deleteField}
                              previousVersion={previousVersion}
                              currentVersion={version}
                            />
                          );
                        })}
                      </div>
                      <Pagination page={editor.fieldPage} pageCount={editor.fieldPageCount} onPageChange={editor.setFieldPage} />
                    </div>
                  )}
                </div>

                <RemovedFieldsSection
                  removedFieldDiffs={removedFieldDiffs}
                  isPending={editor.isCreatingField}
                  onRestore={editor.restoreRemovedField}
                />

                <InlineError message={editor.error} />
              </div>
            )}
          </div>
        </section>
      )}

      <TableSelectorModal
        isOpen={isTableSelectorOpen} models={models} selectedModelName={selectedModelName}
        search={tableSearch} isLoading={tablesQuery.isLoading} tone="cyan"
        onSearch={setTableSearch} onSelect={selectModel} onClose={() => setIsTableSelectorOpen(false)}
        typeBadgeClass={typeBadgeClass}
      />

      <TemplatesModal
        isOpen={isTemplatesOpen} selectedModelName={selectedModelName}
        projectProvider={projectProvider} fieldTypeOptions={editor.fieldTypeOptions}
        onClose={() => setIsTemplatesOpen(false)}
        onSelectTable={() => { setIsTemplatesOpen(false); setIsTableSelectorOpen(true); }}
        {...templateState}
      />
    </div>
  );
}
