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
import { VersionDiffBadge } from "../shared/version-diff-badge";
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


export function RelationsPageContent() {
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
  const [activeRelationTab, setActiveRelationTab] =
    useState<RelationTab>("relations");
  const [relationTargetFilter, setRelationTargetFilter] = useState("");
  const [relationKindFilter, setRelationKindFilter] =
    useState<PrismaRelation["kind"] | "">("");
  const [relationPage, setRelationPage] = useState(1);
  const [draft, setDraft] = useState<RelationDraft>(emptyRelationDraft);
  const [editingRelationKey, setEditingRelationKey] = useState("");
  const [deletingRelationKey, setDeletingRelationKey] = useState("");
  const [isRelationFormOpen, setIsRelationFormOpen] = useState(false);
  const [fkFieldType, setFkFieldType] = useState("String");
  const [fkFieldDbName, setFkFieldDbName] = useState("");
  const [modalTableSearch, setModalTableSearch] = useState("");
  const [modalTablePage, setModalTablePage] = useState(1);
  const [error, setError] = useState("");
  const lastEditedKeyRef = useRef("");
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

  const invalidateRelations = () =>
    queryClient.invalidateQueries({
      queryKey: trpc.relations.list.queryOptions({ projectName, version, modelName: selectedModelName, modelKey: selectedModelKey }).queryKey,
    });

  const createFkFieldMutation = useMutation({
    ...trpc.fields.create.mutationOptions(),
    onError: (err) => setError(err.message),
  });
  const createRelationMutation = useMutation({
    ...trpc.relations.create.mutationOptions(),
    onSuccess: () => { void invalidateRelations(); resetDraft(); },
    onError: (err) => setError(err.message),
  });
  const updateRelationMutation = useMutation({
    ...trpc.relations.update.mutationOptions(),
    onSuccess: () => { void invalidateRelations(); resetDraft(); },
    onError: (err) => setError(err.message),
  });
  const deleteRelationMutation = useMutation({
    ...trpc.relations.delete.mutationOptions(),
    onSuccess: () => { void invalidateRelations(); setDeletingRelationKey(""); },
    onError: (err) => { setError(err.message); setDeletingRelationKey(""); },
  });

  const savingRelation = createFkFieldMutation.isPending || createRelationMutation.isPending || updateRelationMutation.isPending;

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
    setDraft(emptyRelationDraftForModel(selectedModelName));
    setEditingRelationKey("");
    setError("");
  }, [selectedModelName]);

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

  const updateDraft = (patch: Partial<RelationDraft>) => {
    setDraft((currentDraft) => {
      const nextDraft = { ...currentDraft, ...patch };
      if (patch.targetModel !== undefined) {
        const targetModel = models.find((model) => model.name === patch.targetModel);
        nextDraft.references = targetModel?.pkName || "id";
      }
      if (patch.name !== undefined || patch.targetModel !== undefined) {
        nextDraft.backReferenceName = deriveBackReferenceName(selectedModelName, nextDraft.name);
      }
      if (patch.name !== undefined) {
        nextDraft.fields = patch.name ? `${patch.name}Id` : "";
      }
      // If nullable is switched off, reset any SetNull cascade actions
      if (patch.nullable === false) {
        if (nextDraft.onDelete === "SetNull") nextDraft.onDelete = "NoAction";
        if (nextDraft.onUpdate === "SetNull") nextDraft.onUpdate = "NoAction";
      }
      return nextDraft;
    });
    setError("");
  };

  const resetDraft = () => {
    const scrollKey = lastEditedKeyRef.current;
    setDraft(emptyRelationDraftForModel(selectedModelName));
    setEditingRelationKey("");
    setIsRelationFormOpen(false);
    setModalTableSearch("");
    setModalTablePage(1);
    setFkFieldDbName("");
    setError("");
    if (scrollKey) {
      setTimeout(() => {
        document.getElementById(`relation-card-${scrollKey}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
        lastEditedKeyRef.current = "";
      }, 120);
    }
  };

  const editRelation = (relation: PrismaRelation) => {
    const nullable = relation.nullable;
    setDraft({
      name: relation.name,
      targetModel: relation.targetModel,
      backReferenceName:
        relation.backReferenceName || deriveBackReferenceName(selectedModelName, relation.name),
      cardinality: relation.kind === "one-to-one" ? "one-to-one" : "one-to-many",
      fields: toCsv(relation.fields),
      references: toCsv(relation.references),
      onDelete: !nullable && relation.onDelete === "SetNull" ? "NoAction" : (relation.onDelete || "NoAction"),
      onUpdate: !nullable && relation.onUpdate === "SetNull" ? "NoAction" : (relation.onUpdate || "NoAction"),
      nullable,
    });
    setEditingRelationKey(relation.key);
    lastEditedKeyRef.current = relation.key;
    setIsRelationFormOpen(true);
    setError("");
  };

  const saveRelation = () => {
    if (!selectedModelName || !draft.name.trim() || !draft.targetModel.trim() || !draft.backReferenceName.trim() || !draft.fields.trim() || !draft.references.trim()) {
      setError("Relation field, target table, back reference, local field, and target reference are required.");
      return;
    }
    setError("");
    const payload = {
      projectName, version,
      modelKey: selectedModelKey, modelName: selectedModelName,
      name: draft.name, targetModel: draft.targetModel,
      backReferenceName: draft.backReferenceName,
      fields: toList(draft.fields), references: toList(draft.references),
      onDelete: draft.onDelete, onUpdate: draft.onUpdate,
      nullable: draft.nullable, isArray: false,
      backReferenceIsArray: draft.cardinality === "one-to-many",
    };
    if (editingRelationKey) {
      updateRelationMutation.mutate({ ...payload, relationKey: editingRelationKey });
    } else {
      createFkFieldMutation.mutate({
        projectName, version,
        modelKey: selectedModelKey, modelName: selectedModelName,
        name: draft.fields.trim(),
        type: fkFieldType,
        nullable: draft.nullable,
        unique: false,
        defaultValue: "",
        comment: "",
      }, {
        onSuccess: () => createRelationMutation.mutate(payload),
      });
    }
  };

  const deleteRelation = (relation: PrismaRelation) => {
    setDeletingRelationKey(relation.key);
    setError("");
    deleteRelationMutation.mutate({
      projectName, version,
      modelKey: selectedModelKey, modelName: selectedModelName,
      relationKey: relation.key,
    });
    if (editingRelationKey === relation.key) resetDraft();
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
                  {removedRelationDiffs.filter((d) => d.sourceTableName === selectedModelName).length === 1
                    ? "1 relation removed since the previous version"
                    : `${removedRelationDiffs.filter((d) => d.sourceTableName === selectedModelName).length} relations removed since the previous version`}
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
                      const fksMissing = activeRelationTab === "relations" &&
                        relation.fields.length > 0 &&
                        sourceFields.length > 0 &&
                        relation.fields.some((f) => !sourceFieldNames.has(f));
                      const modelCascadeHints = fkCascadeMap.get(selectedModelName);
                      const fkTypeMismatches = activeRelationTab === "relations"
                        ? relation.fields.flatMap((f) => {
                            const info = modelCascadeHints?.get(f);
                            return info ? [{ fieldName: f, ...info }] : [];
                          })
                        : [];
                      const hasFkTypeMismatch = fkTypeMismatches.length > 0;
                      const relationDiff = diffByRelationId.get(relation.key);
                      const isNewRelation = relationDiff?.changeKind === "added";
                      return (
                      <div
                        key={relation.key}
                        id={`relation-card-${relation.key}`}
                        className={classNames(
                          "rounded-lg border bg-white p-3 shadow-sm",
                          hasFkTypeMismatch ? "border-red-300" : isNewRelation ? "border-sky-300" : fksMissing ? "border-amber-300" : "border-slate-200",
                        )}
                      >
                        {/* Row 1: kind + name → target + backref + actions */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                            <span
                              className={classNames(
                                "rounded border px-1.5 py-0.5 text-xs font-semibold",
                                relationKindClass(relation.kind),
                              )}
                            >
                              {relationKindLabel(relation.kind)}
                            </span>
                            <span className="text-sm font-bold text-slate-950">
                              {relation.name}
                            </span>
                            <span className="text-xs font-semibold text-slate-400">
                              {activeRelationTab === "references" ? "←" : "→"}
                            </span>
                            <span
                              className={classNames(
                                "rounded border px-1.5 py-0.5 text-xs font-semibold",
                                activeRelationTab === "references"
                                  ? "border-amber-200 bg-amber-50 text-amber-700"
                                  : "border-cyan-200 bg-cyan-50 text-cyan-700",
                              )}
                            >
                              {relation.targetModel}
                            </span>
                            {activeRelationTab === "relations" && relation.backReferenceName ? (
                              <span className="rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-xs font-semibold text-emerald-700">
                                ↩ {relation.backReferenceName}
                              </span>
                            ) : null}
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            {isNewRelation ? (
                              <VersionDiffBadge severity="info" label="new" />
                            ) : null}
                            {hasFkTypeMismatch ? (
                              <span title={fkTypeMismatches.map((m) => `${m.fieldName}: ${m.fromType} → ${m.toType} (${m.targetTableName} PK changed)`).join("; ")}>
                                <VersionDiffBadge severity="breaking" label="FK type" />
                              </span>
                            ) : null}
                            {fksMissing ? (
                              <span
                                title={`FK column "${relation.fields.find((f) => !sourceFieldNames.has(f))}" not found on ${selectedModelName}`}
                                className="rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700"
                              >
                                FK missing
                              </span>
                            ) : null}
                            {activeRelationTab === "relations" ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => editRelation(relation)}
                                  title="Edit"
                                  className="flex h-7 w-7 items-center justify-center rounded border border-violet-200 bg-white text-violet-700 transition hover:bg-violet-50"
                                >
                                  <IconPencil size={13} stroke={2} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => deleteRelation(relation)}
                                  disabled={deletingRelationKey === relation.key}
                                  title="Delete"
                                  className="flex h-7 w-7 items-center justify-center rounded border border-rose-200 bg-white text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:text-slate-400"
                                >
                                  <IconTrash size={13} stroke={2} />
                                </button>
                              </>
                            ) : null}
                          </div>
                        </div>

                        {/* Row 2: field mapping + nullable + cascade badges */}
                        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                          <div className="flex flex-wrap items-center gap-1">
                            {relation.fields.length > 0 ? (
                              relation.fields.map((f) => {
                                const mismatch = modelCascadeHints?.get(f);
                                return (
                                  <span
                                    key={f}
                                    title={mismatch ? `Update to ${mismatch.toType} — ${mismatch.targetTableName} PK changed from ${mismatch.fromType}` : undefined}
                                    className={classNames(
                                      "rounded border px-1.5 py-0.5 text-xs font-semibold",
                                      mismatch
                                        ? "border-red-300 bg-red-50 text-red-700"
                                        : "border-transparent bg-slate-100 text-slate-700",
                                    )}
                                  >
                                    {f}
                                  </span>
                                );
                              })
                            ) : (
                              <span className="text-xs text-slate-400">implicit</span>
                            )}
                            <span className="text-xs font-semibold text-slate-400">→</span>
                            {relation.references.length > 0 ? (
                              relation.references.map((r) => (
                                <span key={r} className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-700">{r}</span>
                              ))
                            ) : (
                              <span className="text-xs text-slate-400">managed</span>
                            )}
                          </div>
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-600">
                            {relation.isArray ? "List" : relation.nullable ? "Optional" : "Required"}
                          </span>
                          {relation.onDelete ? (
                            <span className="rounded bg-rose-50 px-1.5 py-0.5 text-xs font-semibold text-rose-700">
                              onDelete: {relation.onDelete}
                            </span>
                          ) : null}
                          {relation.onUpdate ? (
                            <span className="rounded bg-cyan-50 px-1.5 py-0.5 text-xs font-semibold text-cyan-700">
                              onUpdate: {relation.onUpdate}
                            </span>
                          ) : null}
                        </div>

                        {/* Row 3: collapsible Prisma preview */}
                        <details className="mt-2 group">
                          <summary className="flex cursor-pointer select-none items-center gap-1 text-xs font-semibold text-slate-400 hover:text-slate-600">
                            <IconChevronDown size={11} className="transition-transform group-open:rotate-0 -rotate-90" />
                            Prisma preview
                          </summary>
                          <code className="mt-1.5 block overflow-x-auto rounded bg-slate-950 px-2.5 py-1.5 text-xs font-semibold text-slate-50">
                            {relation.preview}
                          </code>
                        </details>
                      </div>
                    );})}
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

      {isRelationFormOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-3">
          <div className="flex h-[96vh] w-[98vw] max-w-[1500px] flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl">
            {/* Modal header */}
            <div className="shrink-0 border-b border-slate-200 px-6 py-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    {editingRelationKey ? "Update Relation" : "Create Relation"}
                  </p>
                  <h3 className="mt-1 text-xl font-semibold text-slate-950">
                    {selectedModelName}
                    {draft.targetModel ? (
                      <span className="ml-2 text-slate-400">→ {draft.targetModel}</span>
                    ) : null}
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={resetDraft}
                    className="h-9 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => saveRelation()}
                    disabled={
                      savingRelation ||
                      fkNameConflict ||
                      backRefConflict ||
                      !draft.name.trim() ||
                      !draft.targetModel.trim() ||
                      !draft.backReferenceName.trim() ||
                      !draft.fields.trim() ||
                      !draft.references.trim()
                    }
                    className="h-9 min-w-36 rounded-md bg-violet-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    {savingRelation ? "Saving…" : editingRelationKey ? "Save Relation" : "Create Relation"}
                  </button>
                </div>
              </div>
            </div>

            {/* Modal body */}
            <div className="min-h-0 flex-1 overflow-y-auto p-6">
              <div className="space-y-8">

                {/* ── Target Table ───────────────────────────────────────── */}
                <div>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Target Table</p>
                    {draft.targetModel ? (
                      <span className="rounded-md border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700">
                        {draft.targetModel}
                      </span>
                    ) : null}
                  </div>
                  <input
                    type="text"
                    value={modalTableSearch}
                    onChange={(e) => { setModalTableSearch(e.target.value); setModalTablePage(1); }}
                    placeholder="Search tables…"
                    className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-violet-600"
                  />
                  {(() => {
                    const filtered = models.filter((m) =>
                      m.name.toLowerCase().includes(modalTableSearch.toLowerCase()),
                    );
                    const pageCount = Math.max(1, Math.ceil(filtered.length / modalTablesPerPage));
                    const safePage = Math.min(modalTablePage, pageCount);
                    const paged = filtered.slice((safePage - 1) * modalTablesPerPage, safePage * modalTablesPerPage);
                    return (
                      <>
                        <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                          {tablesQuery.isLoading ? (
                            <div className="col-span-6 py-5 text-center text-sm font-medium text-slate-500">Loading…</div>
                          ) : paged.length === 0 ? (
                            <div className="col-span-6 py-5 text-center text-sm font-medium text-slate-500">No tables found.</div>
                          ) : paged.map((model) => {
                            const isSelected = draft.targetModel === model.name;
                            return (
                              <button
                                key={model.key}
                                type="button"
                                onClick={() => updateDraft({ targetModel: model.name })}
                                className={classNames(
                                  "flex items-center justify-between rounded-lg border px-3 py-2.5 text-left transition",
                                  isSelected
                                    ? "border-violet-400 bg-violet-50 shadow-sm"
                                    : "border-slate-200 bg-white hover:border-violet-300",
                                )}
                              >
                                <span className={classNames("truncate text-sm font-semibold", isSelected ? "text-violet-900" : "text-slate-800")}>
                                  {model.name}
                                </span>
                                <span className={classNames(
                                  "ml-2 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold",
                                  isSelected ? "bg-violet-100 text-violet-700" : "bg-slate-100 text-slate-500",
                                )}>
                                  {model.pkType || "—"}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                        {pageCount > 1 ? (
                          <div className="mt-2 flex items-center justify-center gap-2">
                            <button type="button" onClick={() => setModalTablePage((p) => Math.max(1, p - 1))} disabled={safePage === 1}
                              className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 transition hover:border-violet-300 hover:text-violet-700 disabled:cursor-not-allowed disabled:opacity-50">
                              <IconChevronLeft size={13} />
                            </button>
                            <span className="text-xs font-semibold text-slate-500">{safePage} / {pageCount}</span>
                            <button type="button" onClick={() => setModalTablePage((p) => Math.min(pageCount, p + 1))} disabled={safePage === pageCount}
                              className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 transition hover:border-violet-300 hover:text-violet-700 disabled:cursor-not-allowed disabled:opacity-50">
                              <IconChevronRight size={13} />
                            </button>
                          </div>
                        ) : null}
                      </>
                    );
                  })()}
                </div>

                {/* ── Relation Field + Back Reference ────────────────────── */}
                <div>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Relation Field</p>
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Back Reference</p>
                  </div>
                  <div className={classNames(
                    "flex overflow-hidden rounded-md border focus-within:border-violet-500",
                    backRefConflict ? "border-amber-400" : "border-slate-300",
                  )}>
                    <input
                      value={draft.name}
                      onChange={(event) => updateDraft({ name: event.target.value.replace(/[^a-zA-Z0-9]/g, "") })}
                      onBlur={() => { if (draft.name.trim()) updateDraft({ name: toCamelCaseIdentifier(draft.name) }); }}
                      placeholder="companyId"
                      autoFocus
                      className="min-w-0 flex-1 bg-white px-3 py-2.5 text-sm font-medium text-slate-950 outline-none placeholder:text-slate-400"
                    />
                    <div className="flex shrink-0 items-center border-x border-slate-300 bg-slate-100 px-4">
                      <span className="text-xs font-bold text-slate-400">To</span>
                    </div>
                    <input
                      value={draft.backReferenceName}
                      disabled
                      placeholder="auto"
                      className={classNames(
                        "min-w-0 flex-1 px-3 py-2.5 font-mono text-sm outline-none placeholder:text-slate-300",
                        backRefConflict ? "bg-amber-50 text-amber-700" : "bg-slate-50 text-slate-500",
                      )}
                    />
                  </div>
                  {backRefConflict ? (
                    <p className="mt-1.5 text-xs font-semibold text-amber-600">
                      Back reference <code className="rounded bg-amber-100 px-1 font-mono">{draft.backReferenceName}</code> already exists on <span className="font-semibold">{draft.targetModel}</span>. Use a different relation field name.
                    </p>
                  ) : (
                    <p className="mt-1 text-[10px] normal-case leading-4 tracking-normal text-slate-400">
                      Left: the FK field name on <span className="font-semibold text-slate-500">{selectedModelName}</span>. Right: virtual back-reference auto-added to <span className="font-semibold text-slate-500">{draft.targetModel || "target"}</span> — named <code className="rounded bg-slate-100 px-1 font-mono">{`{source}{Relation}`}</code>, no DB column.
                    </p>
                  )}
                </div>


                {/* ── FK Column ──────────────────────────────────────────── */}
                <div>
                  <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                    FK Column
                  </p>
                  <div className={classNames(
                    "flex overflow-hidden rounded-md border focus-within:border-violet-500",
                    fkNameConflict ? "border-amber-400" : "border-slate-300",
                  )}>
                    <input
                      value={draft.fields}
                      onChange={(event) =>
                        updateDraft({ fields: event.target.value.replace(/[^a-zA-Z0-9]/g, "") })
                      }
                      onBlur={() => {
                        if (draft.fields.trim())
                          updateDraft({ fields: toCamelCaseIdentifier(draft.fields) });
                      }}
                      disabled={!!editingRelationKey}
                      placeholder="companyId"
                      className="min-w-0 flex-1 bg-white px-3 py-2 text-sm font-medium text-slate-950 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
                    />
                    <div className={classNames(
                      "flex shrink-0 items-center border-l px-3",
                      fkNameConflict ? "border-amber-400 bg-amber-50" : "border-slate-300 bg-slate-50",
                    )}>
                      <span className="text-xs font-bold text-slate-500">{fkFieldType || "—"}</span>
                    </div>
                  </div>
                  {fkNameConflict ? (
                    <p className="mt-1.5 text-xs font-semibold text-amber-600">
                      {fkConflictIsExistingField
                        ? <>Column <code className="rounded bg-amber-100 px-1 font-mono">{draft.fields}</code> already exists as a field on <span className="font-semibold">{selectedModelName}</span> — choose a different name.</>
                        : <>Column <code className="rounded bg-amber-100 px-1 font-mono">{draft.fields}</code> is already used as a FK by another relation on <span className="font-semibold">{selectedModelName}</span>.</>
                      }
                    </p>
                  ) : (
                    <p className="mt-1.5 text-[10px] normal-case leading-4 tracking-normal text-slate-400">
                      {editingRelationKey
                        ? "FK column cannot be renamed after creation."
                        : <>Scalar column created on <span className="font-semibold text-slate-500">{selectedModelName}</span>. Type auto-matched from the target reference field.</>
                      }
                    </p>
                  )}
                  {!editingRelationKey ? (
                    <div className="mt-2">
                      <input
                        value={fkFieldDbName}
                        onChange={(e) => setFkFieldDbName(e.target.value.replace(/\s/g, "_").toLowerCase())}
                        placeholder="@map name (optional)"
                        className="h-8 w-full rounded-md border border-slate-200 bg-slate-50 px-3 text-xs font-mono text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-violet-400"
                      />
                    </div>
                  ) : null}
                </div>

                {/* ── Target references grid ─────────────────────────────── */}
                <div>
                  <div className="mb-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                      Target References
                    </p>
                    <p className="mt-0.5 text-xs font-medium text-slate-400">
                      {draft.targetModel
                        ? <><span className="font-semibold text-slate-600">@id</span> and <span className="font-semibold text-slate-600">@unique</span> fields on <span className="font-semibold text-slate-600">{draft.targetModel}</span></>
                        : "Select a target table first"}
                    </p>
                  </div>

                  {!draft.targetModel ? (
                    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 py-8 text-center text-sm font-medium text-slate-500">
                      Select a target table to see its reference fields.
                    </div>
                  ) : targetFieldsQuery.isLoading ? (
                    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 py-8 text-center text-sm font-medium text-slate-500">
                      Loading target fields…
                    </div>
                  ) : selectableTargetFields.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 py-8 text-center text-sm font-medium text-slate-500">
                      No <code className="rounded bg-slate-200 px-1 font-mono text-xs">@id</code> or <code className="rounded bg-slate-200 px-1 font-mono text-xs">@unique</code> fields found on <strong>{draft.targetModel}</strong>.
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                      {selectableTargetFields.map((field) => {
                        const isChecked = draft.references === field.name;
                        return (
                          <button
                            key={field.key}
                            type="button"
                            onClick={() => updateDraft({ references: isChecked ? "" : field.name })}
                            className={classNames(
                              "flex flex-col items-start gap-1.5 rounded-lg border p-3 text-left transition",
                              isChecked
                                ? "border-cyan-400 bg-cyan-50 shadow-sm ring-1 ring-cyan-300"
                                : "border-slate-200 bg-white hover:border-cyan-300 hover:bg-cyan-50/40",
                            )}
                          >
                            <div className="flex w-full items-start justify-between gap-1">
                              <span className={classNames(
                                "truncate text-sm font-bold",
                                isChecked ? "text-cyan-900" : "text-slate-950",
                              )}>
                                {field.name}
                              </span>
                              <span className={classNames(
                                "mt-0.5 shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-bold",
                                isChecked
                                  ? "border-cyan-300 bg-cyan-100 text-cyan-700"
                                  : "border-slate-200 bg-slate-50 text-slate-500",
                              )}>
                                {field.type}
                              </span>
                            </div>
                            <span className={classNames(
                              "rounded px-1.5 py-0.5 text-[10px] font-bold",
                              field.isId
                                ? "bg-violet-100 text-violet-700"
                                : "bg-emerald-100 text-emerald-700",
                            )}>
                              {field.isId ? "PRIMARY KEY" : "UNIQUE"}
                            </span>
                            {field.comment ? (
                              <span className="line-clamp-2 text-[11px] leading-4 text-slate-500">
                                {field.comment}
                              </span>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* ── Relation Type ──────────────────────────────────────── */}
                <div>
                  <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Relation Type
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {/* One to One */}
                    <button
                      type="button"
                      onClick={() => updateDraft({ cardinality: "one-to-one" })}
                      className={classNames(
                        "flex flex-col gap-3 rounded-lg border-2 p-5 text-left transition",
                        draft.cardinality === "one-to-one"
                          ? "border-violet-400 bg-violet-50"
                          : "border-slate-200 bg-white hover:border-violet-200 hover:bg-violet-50/30",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className={classNames(
                          "text-base font-bold",
                          draft.cardinality === "one-to-one" ? "text-violet-900" : "text-slate-800",
                        )}>
                          One to One
                        </span>
                        {draft.cardinality === "one-to-one" ? (
                          <span className="rounded-full bg-violet-600 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                            Selected
                          </span>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2 font-mono text-sm">
                        <span className={classNames(
                          "rounded border px-2 py-1 font-semibold",
                          draft.cardinality === "one-to-one"
                            ? "border-violet-300 bg-white text-violet-800"
                            : "border-slate-200 bg-slate-50 text-slate-600",
                        )}>
                          {selectedModelName || "A"}
                        </span>
                        <span className={draft.cardinality === "one-to-one" ? "text-violet-400" : "text-slate-300"}>
                          ────
                        </span>
                        <span className={classNames(
                          "rounded border px-2 py-1 font-semibold",
                          draft.cardinality === "one-to-one"
                            ? "border-violet-300 bg-white text-violet-800"
                            : "border-slate-200 bg-slate-50 text-slate-600",
                        )}>
                          {draft.targetModel || "B"}
                        </span>
                      </div>
                      <p className="text-xs font-medium text-slate-500">
                        Each record in <strong>{selectedModelName || "A"}</strong> links to exactly one record in <strong>{draft.targetModel || "B"}</strong>. Prisma adds <code className="rounded bg-slate-100 px-1 font-mono">@unique</code> automatically.
                      </p>
                    </button>

                    {/* One to Many */}
                    <button
                      type="button"
                      onClick={() => updateDraft({ cardinality: "one-to-many" })}
                      className={classNames(
                        "flex flex-col gap-3 rounded-lg border-2 p-5 text-left transition",
                        draft.cardinality === "one-to-many"
                          ? "border-emerald-400 bg-emerald-50"
                          : "border-slate-200 bg-white hover:border-emerald-200 hover:bg-emerald-50/30",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className={classNames(
                          "text-base font-bold",
                          draft.cardinality === "one-to-many" ? "text-emerald-900" : "text-slate-800",
                        )}>
                          One to Many
                        </span>
                        {draft.cardinality === "one-to-many" ? (
                          <span className="rounded-full bg-emerald-600 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                            Selected
                          </span>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2 font-mono text-sm">
                        <span className={classNames(
                          "rounded border px-2 py-1 font-semibold",
                          draft.cardinality === "one-to-many"
                            ? "border-emerald-300 bg-white text-emerald-800"
                            : "border-slate-200 bg-slate-50 text-slate-600",
                        )}>
                          {draft.targetModel || "B"}
                        </span>
                        <span className={draft.cardinality === "one-to-many" ? "text-emerald-400" : "text-slate-300"}>
                          ──────{"<"}
                        </span>
                        <span className={classNames(
                          "rounded border px-2 py-1 font-semibold",
                          draft.cardinality === "one-to-many"
                            ? "border-emerald-300 bg-white text-emerald-800"
                            : "border-slate-200 bg-slate-50 text-slate-600",
                        )}>
                          {selectedModelName || "A"}
                        </span>
                      </div>
                      <p className="text-xs font-medium text-slate-500">
                        One record in <strong>{draft.targetModel || "B"}</strong> can own many records in <strong>{selectedModelName || "A"}</strong>. The back reference field will be a list.
                      </p>
                    </button>
                  </div>
                </div>

                {/* ── Nullable + Cascade cards ───────────────────────────── */}
                {(() => {
                  const cascadeOptions: Array<{ value: string; label: string }> = [
                    { value: "NoAction", label: "No Action"},
                    { value: "Cascade",  label: "Cascade"  },
                    { value: "Restrict", label: "Restrict" },
                    { value: "SetNull",  label: "Set Null" },
                  ];

                  const CascadeGrid = ({ field, value, onChange }: {
                    field: string;
                    value: string;
                    onChange: (v: string) => void;
                  }) => (
                    <div>
                      <p className="mb-2 text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">{field}</p>
                      <div className="grid grid-cols-4 gap-1.5">
                        {cascadeOptions.map((opt) => {
                          const isSelected = value === opt.value;
                          const isDisabled = opt.value === "SetNull" && !draft.nullable;
                          return (
                            <button
                              key={opt.value || "default"}
                              type="button"
                              disabled={isDisabled}
                              onClick={() => onChange(opt.value)}
                              className={classNames(
                                "rounded-md border-2 px-2 py-1.5 text-center text-xs font-semibold transition",
                                isDisabled
                                  ? "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300"
                                  : isSelected
                                    ? "border-violet-400 bg-violet-50 text-violet-800"
                                    : "border-slate-200 bg-white text-slate-600 hover:border-violet-200 hover:text-violet-700",
                              )}
                            >
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );

                  return (
                    <div className="space-y-5">
                      <div className="space-y-2">
                        <p className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">Nullable</p>
                        <button
                          type="button"
                          onClick={() => updateDraft({ nullable: !draft.nullable })}
                          className={classNames(
                            "h-12 w-full rounded-md border px-3 text-base font-semibold transition",
                            draft.nullable
                              ? "border-emerald-500 bg-emerald-500 text-white hover:bg-emerald-600"
                              : "border-amber-400 bg-amber-400 text-white hover:bg-amber-500",
                          )}
                        >
                          {draft.nullable ? "Nullable" : "Required"}
                        </button>
                      </div>
                      <CascadeGrid field="On Delete" value={draft.onDelete} onChange={(v) => updateDraft({ onDelete: v })} />
                      <CascadeGrid field="On Update" value={draft.onUpdate} onChange={(v) => updateDraft({ onUpdate: v })} />
                    </div>
                  );
                })()}

                {error ? (
                  <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
                    {error}
                  </p>
                ) : null}
              </div>
            </div>

          </div>
        </div>
      ) : null}

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
