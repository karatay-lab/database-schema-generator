"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { useProjectInfo } from "../shared/project-info-context";
import { classNames } from "../shared/dashboard-data";
import type {
  PrismaField,
  PrismaFieldInput,
  PrismaModel,
} from "@/lib/schema-store";
import type { FieldTemplate } from "@/lib/field-template-store";

type FieldsResponse = {
  fields?: PrismaField[];
  enumTypes?: string[];
  scalarTypes?: string[];
  error?: string;
};

type TemplatesResponse = {
  templates?: FieldTemplate[];
  fields?: FieldTemplate[];
  error?: string;
};

const defaultFieldTypes = [
  "String",
  "Int",
  "BigInt",
  "Float",
  "Decimal",
  "Boolean",
  "DateTime",
  "Timestamp",
  "Json",
  "Bytes",
];

const emptyFieldInput: PrismaFieldInput = {
  name: "",
  type: "String",
  nullable: false,
  unique: false,
  defaultValue: "",
  comment: "",
};

function typeBadgeClass(type: string) {
  if (type === "Int") return "bg-blue-50 text-blue-700";
  if (type === "String") return "bg-green-50 text-green-700";
  if (type === "DateTime") return "bg-orange-50 text-orange-700";
  if (type === "Uuid") return "bg-purple-50 text-purple-700";
  if (type === "BigInt") return "bg-rose-50 text-rose-700";
  return "bg-slate-100 text-slate-600";
}

function templateTypeLabel(template: FieldTemplate) {
  return template.type === "DateTime" &&
    template.nativeAttribute?.name === "Timestamptz"
    ? "DateTime (Timestamp)"
    : template.type;
}

function toSnakeCaseName(fieldName: string) {
  return fieldName
    .trim()
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2")
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[\s-]+/g, "_")
    .replace(/_+/g, "_")
    .toLowerCase();
}

function getSnakeCaseSuggestion(fieldName: string) {
  const suggestion = toSnakeCaseName(fieldName);

  return suggestion && suggestion !== fieldName.trim() ? suggestion : "";
}

function FieldNameSuggestion({
  suggestion,
  onUse,
}: {
  suggestion: string;
  onUse: () => void;
}) {
  if (!suggestion) {
    return null;
  }

  return (
    <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs font-semibold normal-case tracking-normal text-amber-800">
      Use snake_case:{" "}
      <button
        type="button"
        onClick={onUse}
        className="font-bold underline underline-offset-2"
      >
        {suggestion}
      </button>
    </div>
  );
}

function fieldToInput(field: PrismaField): PrismaFieldInput {
  return {
    name: field.name,
    type: field.type,
    nullable: field.nullable,
    unique: field.unique,
    defaultValue: field.defaultValue,
    comment: field.comment,
    nativeAttribute: field.nativeAttribute,
    updatedAtAttribute: field.updatedAtAttribute,
    isId: field.isId,
  };
}

function templateToInput(template: FieldTemplate): PrismaFieldInput {
  return {
    name: template.name,
    type: template.type,
    nullable: template.nullable,
    unique: template.unique,
    defaultValue: template.defaultValue,
    comment: template.comment,
    nativeAttribute: template.nativeAttribute,
    updatedAtAttribute: template.updatedAtAttribute,
    isId: template.isId,
  };
}

export function SchemaPageContent() {
  const { projectName, version, hasProject } = useProjectInfo();
  const activeProject = hasProject;
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [selectedModelName, setSelectedModelName] = useState("");
  const [tableSearch, setTableSearch] = useState("");
  const [fieldDrafts, setFieldDrafts] = useState<Record<string, PrismaFieldInput>>({});
  const [newField, setNewField] = useState<PrismaFieldInput>(emptyFieldInput);
  const [savingFieldKey, setSavingFieldKey] = useState("");
  const [deletingFieldKey, setDeletingFieldKey] = useState("");
  const [error, setError] = useState("");
  const [fieldTypeFilter, setFieldTypeFilter] = useState("All");
  const [fieldPage, setFieldPage] = useState(1);
  const [isTableSelectorOpen, setIsTableSelectorOpen] = useState(false);
  const [isTemplatesOpen, setIsTemplatesOpen] = useState(false);
  const [templateTypeFilter, setTemplateTypeFilter] = useState("All");
  const [templatePage, setTemplatePage] = useState(1);
  const [templateOverrideNames, setTemplateOverrideNames] = useState<Record<string, string>>({});
  const [templateField, setTemplateField] = useState<PrismaFieldInput>(emptyFieldInput);
  const [editingTemplateId, setEditingTemplateId] = useState("");
  const [addingTemplateToTable, setAddingTemplateToTable] = useState("");
  const [savingTemplateFieldId, setSavingTemplateFieldId] = useState("");
  const [deletingTemplateFieldId, setDeletingTemplateFieldId] = useState("");
  const [templateError, setTemplateError] = useState("");
  const fieldsPerPage = 12;
  const templatesPerPage = 15;

  // ── Queries ──────────────────────────────────────────────────────────────────

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
    trpc.fields.list.queryOptions(
      { projectName, version, modelName: selectedModelName, modelKey: selectedModelKey },
      { enabled: !!selectedModelName },
    ),
  );
  const fields: PrismaField[] = fieldsQuery.data?.fields ?? [];
  const enumTypes: string[] = fieldsQuery.data?.enumTypes ?? [];
  const scalarTypes: string[] = fieldsQuery.data?.scalarTypes ?? [];

  const templatesQuery = useQuery(trpc.fieldTemplates.list.queryOptions());
  const templates: FieldTemplate[] = (templatesQuery.data ?? []) as FieldTemplate[];

  // Sync fieldDrafts whenever the server fields change
  useEffect(() => {
    setFieldDrafts(
      Object.fromEntries(
        fields.filter((f) => f.isEditable).map((f) => [f.key, fieldToInput(f)]),
      ),
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fieldsQuery.data]);

  // Sync templateOverrideNames whenever templates change
  useEffect(() => {
    setTemplateOverrideNames((cur) =>
      Object.fromEntries(templates.map((t) => [t.id, cur[t.id] || t.name])),
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templatesQuery.data]);

  // ── Invalidators ─────────────────────────────────────────────────────────────

  const invalidateFields = () =>
    queryClient.invalidateQueries({
      queryKey: trpc.fields.list.queryOptions({ projectName, version, modelName: selectedModelName, modelKey: selectedModelKey }).queryKey,
    });
  const invalidateTemplates = () =>
    queryClient.invalidateQueries({ queryKey: trpc.fieldTemplates.list.queryOptions().queryKey });

  // ── Mutations ─────────────────────────────────────────────────────────────────

  const createFieldMutation = useMutation({
    ...trpc.fields.create.mutationOptions(),
    onSuccess: () => { void invalidateFields(); setNewField(emptyFieldInput); setSavingFieldKey(""); },
    onError: (err) => { setError(err.message); setSavingFieldKey(""); },
  });
  const updateFieldMutation = useMutation({
    ...trpc.fields.update.mutationOptions(),
    onSuccess: () => { void invalidateFields(); setSavingFieldKey(""); },
    onError: (err) => { setError(err.message); setSavingFieldKey(""); },
  });
  const deleteFieldMutation = useMutation({
    ...trpc.fields.delete.mutationOptions(),
    onSuccess: () => { void invalidateFields(); setDeletingFieldKey(""); },
    onError: (err) => { setError(err.message); setDeletingFieldKey(""); },
  });
  const createTemplateMutation = useMutation({
    ...trpc.fieldTemplates.create.mutationOptions(),
    onSuccess: () => { void invalidateTemplates(); setTemplateField(emptyFieldInput); setEditingTemplateId(""); setSavingTemplateFieldId(""); },
    onError: (err) => { setTemplateError(err.message); setSavingTemplateFieldId(""); },
  });
  const updateTemplateMutation = useMutation({
    ...trpc.fieldTemplates.update.mutationOptions(),
    onSuccess: () => { void invalidateTemplates(); setEditingTemplateId(""); setTemplateField(emptyFieldInput); setSavingTemplateFieldId(""); },
    onError: (err) => { setTemplateError(err.message); setSavingTemplateFieldId(""); },
  });
  const deleteTemplateMutation = useMutation({
    ...trpc.fieldTemplates.delete.mutationOptions(),
    onSuccess: () => { void invalidateTemplates(); setDeletingTemplateFieldId(""); },
    onError: (err) => { setTemplateError(err.message); setDeletingTemplateFieldId(""); },
  });
  const addTemplateToTableMutation = useMutation({
    ...trpc.fields.create.mutationOptions(),
    onSuccess: () => { void invalidateFields(); setAddingTemplateToTable(""); },
    onError: () => setAddingTemplateToTable(""),
  });

  // ── Derived field type options ────────────────────────────────────────────────

  const fieldTypeOptions = useMemo(
    () => Array.from(new Set([...defaultFieldTypes, ...scalarTypes, ...enumTypes])),
    [enumTypes, scalarTypes],
  );

  const editableFields = useMemo(
    () => fields.filter((field) => field.isEditable && !field.isId),
    [fields],
  );

  const usedTemplateNames = useMemo(
    () => new Set(fields.map((field) => field.name)),
    [fields],
  );

  const filteredTemplates = useMemo(() => {
    return templates.filter(
      (template) =>
        templateTypeFilter === "All" || template.type === templateTypeFilter,
    );
  }, [templateTypeFilter, templates]);

  const templateTypeOptions = useMemo(
    () => Array.from(new Set(templates.map((template) => template.type))).sort(),
    [templates],
  );

  const templatePageCount = Math.max(
    1,
    Math.ceil(filteredTemplates.length / templatesPerPage),
  );
  const paginatedTemplates = filteredTemplates.slice(
    (templatePage - 1) * templatesPerPage,
    templatePage * templatesPerPage,
  );

  const preservedFieldCount = fields.length - editableFields.length;

  const fieldFilterOptions = useMemo(
    () => Array.from(new Set(editableFields.map((field) => field.type))).sort(),
    [editableFields],
  );

  const filteredFields = useMemo(
    () =>
      fieldTypeFilter === "All"
        ? editableFields
        : editableFields.filter((field) => field.type === fieldTypeFilter),
    [editableFields, fieldTypeFilter],
  );

  const fieldPageCount = Math.max(1, Math.ceil(filteredFields.length / fieldsPerPage));
  const paginatedFields = filteredFields.slice(
    (fieldPage - 1) * fieldsPerPage,
    fieldPage * fieldsPerPage,
  );

  // Deselect model if it disappears from the list
  useEffect(() => {
    if (selectedModelName && models.length > 0 && !models.some((m) => m.name === selectedModelName)) {
      setSelectedModelName("");
    }
  }, [models, selectedModelName]);

  useEffect(() => {
    setFieldPage(1);
    setFieldTypeFilter("All");
  }, [selectedModelName]);

  useEffect(() => {
    setFieldPage(1);
  }, [fieldTypeFilter, selectedModelName]);

  useEffect(() => {
    setFieldPage((page) => Math.min(page, fieldPageCount));
  }, [fieldPageCount]);

  useEffect(() => {
    setTemplatePage(1);
  }, [templateTypeFilter]);

  useEffect(() => {
    setTemplatePage((page) => Math.min(page, templatePageCount));
  }, [templatePageCount]);

  const updateDraft = (
    fieldKey: string,
    patch: Partial<PrismaFieldInput>,
  ) => {
    setFieldDrafts((currentDrafts) => ({
      ...currentDrafts,
      [fieldKey]: {
        ...currentDrafts[fieldKey],
        ...patch,
        unique:
          patch.type === "Boolean"
            ? false
            : patch.unique ?? currentDrafts[fieldKey]?.unique ?? false,
      },
    }));
    setError("");
  };

  const saveField = (field: PrismaField) => {
    const draft = fieldDrafts[field.key];
    if (!selectedModelName || !draft) return;
    setSavingFieldKey(field.key);
    setError("");
    updateFieldMutation.mutate({
      projectName, version,
      modelKey: selectedModelKey, modelName: selectedModelName,
      fieldKey: field.key, oldFieldName: field.name,
      ...draft,
    });
  };

  const deleteField = (field: PrismaField) => {
    if (!selectedModelName) return;
    setDeletingFieldKey(field.key);
    setError("");
    deleteFieldMutation.mutate({
      projectName, version,
      modelKey: selectedModelKey, modelName: selectedModelName,
      fieldKey: field.key, fieldName: field.name,
    });
  };

  const createField = () => {
    if (!selectedModelName) return;
    setError("");
    createFieldMutation.mutate({
      projectName, version,
      modelKey: selectedModelKey, modelName: selectedModelName,
      ...newField,
    });
  };

  const filteredModels = models.filter((model) =>
    model.name.toLowerCase().includes(tableSearch.toLowerCase()),
  );

  const getDuplicateSuggestion = (fieldName: string, existingFieldNames: string[]) => {
    const trimmedName = fieldName.trim();

    if (!trimmedName) {
      return "";
    }

    const existingNames = new Set(existingFieldNames);

    if (!existingNames.has(trimmedName)) {
      return "";
    }

    const baseName = trimmedName.replace(/\d+$/, "") || trimmedName;
    let index = 2;
    let suggestion = `${baseName}${index}`;

    while (existingNames.has(suggestion)) {
      index += 1;
      suggestion = `${baseName}${index}`;
    }

    return suggestion;
  };

  const templateDuplicateSuggestion = getDuplicateSuggestion(
    templateField.name,
    templates
      .filter((template) => template.id !== editingTemplateId)
      .map((template) => template.name),
  );
  const newFieldNameSuggestion = getSnakeCaseSuggestion(newField.name);
  const templateNameSuggestion = getSnakeCaseSuggestion(templateField.name);

  const selectModel = (modelName: string) => {
    setSelectedModelName(modelName);
    setIsTableSelectorOpen(false);
  };

  const updateNewField = (patch: Partial<PrismaFieldInput>) => {
    setNewField((field) => ({
      ...field,
      ...patch,
      unique:
        patch.type === "Boolean"
          ? false
          : patch.unique ?? field.unique,
    }));
  };

  const updateTemplateField = (patch: Partial<PrismaFieldInput>) => {
    setTemplateField((field) => ({
      ...field,
      ...patch,
      unique:
        patch.type === "Boolean"
          ? false
          : patch.unique ?? field.unique,
    }));
    setTemplateError("");
  };

  const createTemplateField = () => {
    if (templateDuplicateSuggestion) {
      setTemplateError("A template field with this name already exists.");
      return;
    }
    setTemplateError("");
    createTemplateMutation.mutate(templateField);
  };

  const editTemplateField = (template: FieldTemplate) => {
    setEditingTemplateId(template.id);
    setTemplateField(templateToInput(template));
    setTemplateError("");
  };

  const cancelTemplateEdit = () => {
    setEditingTemplateId("");
    setTemplateField(emptyFieldInput);
    setTemplateError("");
  };

  const saveTemplateField = () => {
    if (!editingTemplateId) return;
    setSavingTemplateFieldId(editingTemplateId);
    setTemplateError("");
    updateTemplateMutation.mutate({ id: editingTemplateId, ...templateField });
  };

  const submitTemplateField = () => {
    if (editingTemplateId) { saveTemplateField(); return; }
    createTemplateField();
  };

  const deleteTemplateField = (template: FieldTemplate) => {
    setDeletingTemplateFieldId(template.id);
    setTemplateError("");
    deleteTemplateMutation.mutate({ id: template.id });
    if (editingTemplateId === template.id) {
      setEditingTemplateId("");
      setTemplateField(emptyFieldInput);
    }
  };

  const addTemplateToTable = (template: FieldTemplate) => () => {
    const overrideName = (templateOverrideNames[template.id] || template.name).trim();
    if (!selectedModelName || usedTemplateNames.has(overrideName)) return;
    setAddingTemplateToTable(template.id);
    addTemplateToTableMutation.mutate({
      projectName, version,
      modelKey: selectedModelKey, modelName: selectedModelName,
      name: overrideName,
      type: template.type,
      nullable: template.nullable,
      unique: template.type === "Boolean" ? false : template.unique,
      defaultValue: template.defaultValue,
      comment: template.comment,
      nativeAttribute: template.nativeAttribute,
      updatedAtAttribute: template.updatedAtAttribute,
      isId: template.isId,
    });
  };

  return (
    <div className="space-y-5">
      {!activeProject ? (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center">
          <p className="text-slate-600">Select a project to manage schema fields.</p>
          <button
            type="button"
            onClick={() => setIsTemplatesOpen(true)}
            className="mt-4 h-9 rounded-md border border-emerald-300 bg-white px-5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50"
          >
            Field Templates
          </button>
        </div>
      ) : (
      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Main Window
              </p>
              <h3 className="mt-1 text-xl font-semibold text-slate-950">
                Schema workspace
              </h3>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xs font-medium text-slate-400">
                  {projectName}-{version}.prisma
                </span>
                <span className="text-slate-300">·</span>
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Table:</span>
                <span className="text-base font-bold text-cyan-700">
                  {selectedModel ? selectedModel.name : "—"}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setIsTemplatesOpen(true)}
                className="h-9 min-w-32 rounded-md border border-emerald-300 bg-white px-4 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50"
              >
                Templates
              </button>
              <button
                type="button"
                onClick={() => setIsTableSelectorOpen(true)}
                className="h-9 min-w-36 rounded-md border border-cyan-300 bg-white px-5 text-xs font-semibold text-cyan-700 transition hover:bg-cyan-50"
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
                Select a table to edit its fields.
              </p>
              <button
                type="button"
                onClick={() => setIsTableSelectorOpen(true)}
                className="mt-4 h-10 min-w-44 rounded-md bg-cyan-600 px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-cyan-700"
              >
                Select Table
              </button>
            </div>
          ) : fieldsQuery.isLoading ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-8 text-center text-sm font-medium text-slate-500">
              Loading fields...
            </div>
          ) : (
            <div className="space-y-5">
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
                <div>
                  <div className="mb-3 flex flex-col gap-3 2xl:flex-row 2xl:items-center 2xl:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                        Selected Table
                      </p>
                      <h4 className="mt-1 text-lg font-semibold text-slate-950">
                        {selectedModelName}
                      </h4>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                        Type
                        <select
                          value={fieldTypeFilter}
                          onChange={(event) => setFieldTypeFilter(event.target.value)}
                          className="h-9 min-w-36 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold normal-case tracking-normal text-slate-700 outline-none transition focus:border-cyan-600"
                        >
                          <option value="All">All fields</option>
                          {fieldFilterOptions.map((type) => (
                            <option key={type} value={type}>
                              {type}
                            </option>
                          ))}
                        </select>
                      </label>
                      <span className="text-xs font-semibold text-slate-500">
                        {filteredFields.length} shown / {editableFields.length} editable / {preservedFieldCount} preserved
                      </span>
                    </div>
                  </div>

                  {editableFields.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm font-medium text-slate-500">
                      No editable scalar fields found.
                    </div>
                  ) : filteredFields.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm font-medium text-slate-500">
                      No fields match the selected type filter.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid gap-3 xl:grid-cols-2 2xl:grid-cols-3">
                        {paginatedFields.map((field) => {
                          const draft = fieldDrafts[field.key] ?? fieldToInput(field);
                          const draftNameSuggestion = getSnakeCaseSuggestion(draft.name);

                          return (
                            <div
                              key={field.key}
                              className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
                            >
                              <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
                                <div className="flex min-w-0 items-center gap-2">
                                  <p className="truncate text-xs font-semibold text-slate-950">
                                    {field.name}
                                  </p>
                                  <span className={classNames("rounded-md px-2 py-0.5 text-[11px] font-semibold", typeBadgeClass(field.type))}>
                                    {field.type}
                                  </span>
                                  {field.isId ? (
                                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                                      @id
                                    </span>
                                  ) : null}
                                </div>
                                <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => updateDraft(field.key, { nullable: !draft.nullable })}
                                    className={classNames(
                                      "h-8 rounded-md border px-2.5 text-[11px] font-semibold transition",
                                      draft.nullable
                                        ? "border-emerald-500 bg-emerald-500 text-white hover:bg-emerald-600"
                                        : "border-rose-500 bg-rose-500 text-white hover:bg-rose-600",
                                    )}
                                  >
                                    Nullable
                                  </button>
                                  {draft.type !== "Boolean" ? (
                                    <button
                                      type="button"
                                      onClick={() => updateDraft(field.key, { unique: !draft.unique })}
                                      className={classNames(
                                        "h-8 rounded-md border px-2.5 text-[11px] font-semibold transition",
                                        draft.unique
                                          ? "border-emerald-500 bg-emerald-500 text-white hover:bg-emerald-600"
                                          : "border-rose-500 bg-rose-500 text-white hover:bg-rose-600",
                                      )}
                                    >
                                      Unique
                                    </button>
                                  ) : null}
                                  <button
                                    type="button"
                                    onClick={() => saveField(field)}
                                    disabled={savingFieldKey === field.key || deletingFieldKey === field.key}
                                    className="h-8 rounded-md border border-cyan-300 bg-white px-2.5 text-xs font-semibold text-cyan-700 transition hover:bg-cyan-50 disabled:cursor-not-allowed disabled:text-slate-400"
                                  >
                                    {savingFieldKey === field.key ? "Saving..." : "Save"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => deleteField(field)}
                                    disabled={savingFieldKey === field.key || deletingFieldKey === field.key}
                                    className="h-8 rounded-md border border-rose-200 bg-white px-2.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:text-slate-400"
                                  >
                                    {deletingFieldKey === field.key ? "Deleting..." : "Delete"}
                                  </button>
                                </div>
                              </div>

                              <div className="mt-2 grid gap-2">
                                <div className="grid gap-2 lg:grid-cols-[minmax(0,0.85fr)_minmax(240px,1.35fr)_minmax(0,1fr)]">
                                  <label className="block text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                                    Name
                                    <input
                                      value={draft.name}
                                      onChange={(event) => updateDraft(field.key, { name: event.target.value })}
                                      className="mt-1 h-8 w-full rounded-md border border-slate-300 bg-white px-2.5 text-xs font-medium normal-case tracking-normal text-slate-950 outline-none transition focus:border-cyan-600"
                                    />
                                    <FieldNameSuggestion
                                      suggestion={draftNameSuggestion}
                                      onUse={() =>
                                        updateDraft(field.key, { name: draftNameSuggestion })
                                      }
                                    />
                                  </label>
                                  <label className="block text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                                    Type
                                    <div className="mt-1 flex flex-col gap-1.5 sm:flex-row sm:items-center">
                                      <select
                                        value={draft.type}
                                        onChange={(event) => updateDraft(field.key, { type: event.target.value })}
                                        className="h-8 min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-2.5 text-xs font-medium normal-case tracking-normal text-slate-950 outline-none transition focus:border-cyan-600"
                                      >
                                        {fieldTypeOptions.map((type) => (
                                          <option key={type} value={type}>
                                            {type}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                  </label>
                                  <label className="block text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                                    Default
                                    <input
                                      value={draft.defaultValue}
                                      onChange={(event) => updateDraft(field.key, { defaultValue: event.target.value })}
                                      className="mt-1 h-8 w-full rounded-md border border-slate-300 bg-white px-2.5 text-xs font-medium normal-case tracking-normal text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-cyan-600"
                                      placeholder="now()"
                                    />
                                  </label>
                                </div>
                                <label className="block text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                                  Comment
                                  <input
                                    value={draft.comment}
                                    onChange={(event) => updateDraft(field.key, { comment: event.target.value })}
                                    className="mt-1 h-8 w-full rounded-md border border-slate-300 bg-white px-2.5 text-xs font-medium normal-case tracking-normal text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-cyan-600"
                                    placeholder="FK companies"
                                  />
                                </label>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {fieldPageCount > 1 ? (
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => setFieldPage((page) => Math.max(1, page - 1))}
                            disabled={fieldPage === 1}
                            className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-sm font-semibold text-slate-600 transition hover:border-cyan-200 hover:text-cyan-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {"<"}
                          </button>
                          <span className="text-sm font-semibold text-slate-600">
                            {fieldPage} / {fieldPageCount}
                          </span>
                          <button
                            type="button"
                            onClick={() => setFieldPage((page) => Math.min(fieldPageCount, page + 1))}
                            disabled={fieldPage === fieldPageCount}
                            className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-sm font-semibold text-slate-600 transition hover:border-cyan-200 hover:text-cyan-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {">"}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Add Field
                  </p>
                  <div className="mt-4 space-y-3">
                    <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                      Name
                      <input
                        value={newField.name}
                        onChange={(event) => updateNewField({ name: event.target.value })}
                        className="mt-2 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-medium normal-case tracking-normal text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-cyan-600"
                        placeholder="email"
                      />
                      <FieldNameSuggestion
                        suggestion={newFieldNameSuggestion}
                        onUse={() => updateNewField({ name: newFieldNameSuggestion })}
                      />
                    </label>
                    <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                      Type
                      <div className="mt-2 space-y-2">
                        <select
                          value={newField.type}
                          onChange={(event) => updateNewField({ type: event.target.value })}
                          className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-medium normal-case tracking-normal text-slate-950 outline-none transition focus:border-cyan-600"
                        >
                          {fieldTypeOptions.map((type) => (
                            <option key={type} value={type}>
                              {type}
                            </option>
                          ))}
                        </select>
                        <div className="flex flex-wrap gap-4">
                          <label className="inline-flex items-center gap-2 text-sm font-semibold normal-case tracking-normal text-slate-700">
                            <input
                              type="checkbox"
                              checked={newField.nullable}
                              onChange={(event) => updateNewField({ nullable: event.target.checked })}
                              className="h-4 w-4 rounded border-slate-300 text-cyan-600"
                            />
                            Nullable
                          </label>
                          {newField.type !== "Boolean" ? (
                            <label className="inline-flex items-center gap-2 text-sm font-semibold normal-case tracking-normal text-slate-700">
                              <input
                                type="checkbox"
                                checked={newField.unique}
                                onChange={(event) => updateNewField({ unique: event.target.checked })}
                                className="h-4 w-4 rounded border-slate-300 text-cyan-600"
                              />
                              Unique
                            </label>
                          ) : null}
                        </div>
                      </div>
                    </label>
                    <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                      Default
                      <input
                        value={newField.defaultValue}
                        onChange={(event) => updateNewField({ defaultValue: event.target.value })}
                        className="mt-2 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-medium normal-case tracking-normal text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-cyan-600"
                        placeholder='"draft"'
                      />
                    </label>
                    <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                      Comment
                      <input
                        value={newField.comment}
                        onChange={(event) => updateNewField({ comment: event.target.value })}
                        className="mt-2 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-medium normal-case tracking-normal text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-cyan-600"
                        placeholder="Public label"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={createField}
                      disabled={createFieldMutation.isPending}
                      className="h-10 w-full rounded-md bg-cyan-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      {createFieldMutation.isPending ? "Creating..." : "Add Field"}
                    </button>
                  </div>
                </div>
              </div>

              {error ? (
                <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
                  {error}
                </p>
              ) : null}
            </div>
          )}
        </div>
      </section>
      )}

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
                  <span className="rounded-md border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-xs font-semibold text-cyan-700">
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
                  className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-cyan-600"
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
                          key={model.name}
                          type="button"
                          onClick={() => selectModel(model.name)}
                          className={classNames(
                            "flex min-h-16 items-center justify-between rounded-lg border p-4 text-left transition",
                            isSelected
                              ? "border-cyan-400 bg-cyan-50 shadow-sm"
                              : "border-slate-200 bg-white hover:border-cyan-300",
                          )}
                        >
                          <span className="min-w-0 truncate font-semibold text-slate-950">
                            {model.name}
                          </span>
                          <span className={classNames("ml-3 inline-flex shrink-0 items-center rounded-md px-2 py-1 text-xs font-medium", typeBadgeClass(model.pkType))}>
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

      {isTemplatesOpen ? (
        <div className="fixed inset-0 z-50 bg-white">
          <div className="flex h-screen w-screen flex-col overflow-hidden bg-white">
            <div className="shrink-0 border-b border-slate-200 px-5 py-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Templates
                  </p>
                  <h3 className="mt-1 text-xl font-semibold text-slate-950">
                    Field templates
                  </h3>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                    {selectedModelName || "No table selected"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsTemplatesOpen(false)}
                    className="h-9 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-5 xl:overflow-hidden">
              <div className="grid min-h-full gap-5 xl:h-full xl:min-h-0 xl:grid-cols-[minmax(0,1fr)_380px]">
                <div className="min-w-0 xl:flex xl:min-h-0 xl:flex-col">
                  <div className="mb-4 shrink-0 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                        Reusable Templates
                      </p>
                      <p className="mt-1 text-sm font-medium text-slate-600">
                        Stored in SQLite — apply to any table in any project
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                        Type
                        <select
                          value={templateTypeFilter}
                          onChange={(event) => setTemplateTypeFilter(event.target.value)}
                          className="h-8 min-w-36 rounded-md border border-slate-300 bg-white px-2.5 text-xs font-semibold normal-case tracking-normal text-slate-700 outline-none transition focus:border-cyan-600"
                        >
                          <option value="All">All types</option>
                          {templateTypeOptions.map((type) => (
                            <option key={type} value={type}>
                              {type}
                            </option>
                          ))}
                        </select>
                      </label>
                      <span className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600">
                        {filteredTemplates.length} / {templates.length} templates
                      </span>
                      {!selectedModelName ? (
                        <button
                          type="button"
                          onClick={() => {
                            setIsTemplatesOpen(false);
                            setIsTableSelectorOpen(true);
                          }}
                          className="h-8 rounded-md bg-cyan-600 px-3 text-xs font-semibold text-white transition hover:bg-cyan-700"
                        >
                          Select Table
                        </button>
                      ) : null}
                    </div>
                  </div>

                  {!selectedModelName ? (
                    <div className="mb-4 shrink-0 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
                      Select a table to see Used status and apply templates.
                    </div>
                  ) : null}

                  {templatesQuery.isLoading ? (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-8 text-center text-sm font-medium text-slate-500">
                      Loading templates...
                    </div>
                  ) : templates.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm font-medium text-slate-500">
                      No templates yet. Create the first reusable field from the form.
                    </div>
                  ) : filteredTemplates.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm font-medium text-slate-500">
                      No templates found in this group.
                    </div>
                  ) : (
                    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white xl:flex xl:min-h-0 xl:flex-1 xl:flex-col">
                      <div className="max-h-[64vh] overflow-auto xl:min-h-0 xl:flex-1 xl:max-h-none">
                        <table className="min-w-[1160px] border-collapse text-left text-sm">
                          <thead className="sticky top-0 bg-slate-50 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                            <tr>
                              <th className="border-b border-slate-200 px-3 py-3">Name</th>
                              <th className="border-b border-slate-200 px-3 py-3">Type</th>
                              <th className="border-b border-slate-200 px-3 py-3">Default</th>
                              <th className="border-b border-slate-200 px-3 py-3">Nullable</th>
                              <th className="border-b border-slate-200 px-3 py-3">Unique</th>
                              <th className="border-b border-slate-200 px-3 py-3">Comment</th>
                              <th className="border-b border-slate-200 px-3 py-3">Status</th>
                              <th className="border-b border-slate-200 px-3 py-3">Override Name</th>
                              <th className="border-b border-slate-200 px-3 py-3">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {paginatedTemplates.map((template) => {
                              const overrideName = (templateOverrideNames[template.id] || template.name).trim();
                              const overrideNameSuggestion =
                                getSnakeCaseSuggestion(overrideName);
                              const isUsed = selectedModelName
                                ? usedTemplateNames.has(overrideName)
                                : false;
                              const canAdd = Boolean(selectedModelName) && !isUsed && Boolean(overrideName);
                              const isBusy =
                                addingTemplateToTable === template.id ||
                                savingTemplateFieldId === template.id ||
                                deletingTemplateFieldId === template.id;

                              return (
                                <tr key={template.id} className="align-top">
                                  <td className="px-3 py-3 font-semibold text-slate-950">
                                    {template.name}
                                  </td>
                                  <td className="px-3 py-3">
                                    <span className={classNames("rounded-md px-2 py-1 text-xs font-semibold", typeBadgeClass(template.type))}>
                                      {templateTypeLabel(template)}
                                    </span>
                                  </td>
                                  <td className="max-w-56 truncate px-3 py-3 font-mono text-xs text-slate-600">
                                    {template.defaultValue || "-"}
                                  </td>
                                  <td className="px-3 py-3">
                                    <span
                                      className={classNames(
                                        "rounded-md px-2 py-1 text-xs font-semibold",
                                        template.nullable
                                          ? "bg-emerald-100 text-emerald-700"
                                          : "bg-rose-100 text-rose-700",
                                      )}
                                    >
                                      {template.nullable ? "Yes" : "No"}
                                    </span>
                                  </td>
                                  <td className="px-3 py-3">
                                    {template.type === "Boolean" ? (
                                      <span className="text-xs font-semibold text-slate-400">N/A</span>
                                    ) : (
                                      <span
                                        className={classNames(
                                          "rounded-md px-2 py-1 text-xs font-semibold",
                                          template.unique
                                            ? "bg-emerald-100 text-emerald-700"
                                            : "bg-rose-100 text-rose-700",
                                        )}
                                      >
                                        {template.unique ? "Yes" : "No"}
                                      </span>
                                    )}
                                  </td>
                                  <td className="max-w-64 px-3 py-3 text-slate-600">
                                    <span className="line-clamp-2">
                                      {template.comment || "-"}
                                    </span>
                                  </td>
                                  <td className="px-3 py-3">
                                    <span
                                      className={classNames(
                                        "rounded-md px-2 py-1 text-xs font-semibold",
                                        !selectedModelName
                                          ? "bg-slate-100 text-slate-500"
                                          : isUsed
                                            ? "bg-emerald-100 text-emerald-700"
                                            : "bg-cyan-100 text-cyan-700",
                                      )}
                                    >
                                      {!selectedModelName ? "No table" : isUsed ? "Used" : "Ready"}
                                    </span>
                                  </td>
                                  <td className="px-3 py-3">
                                    <input
                                      value={templateOverrideNames[template.id] ?? template.name}
                                      onChange={(event) =>
                                        setTemplateOverrideNames((currentNames) => ({
                                          ...currentNames,
                                          [template.id]: event.target.value,
                                        }))
                                      }
                                      className="h-8 w-64 rounded-md border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-cyan-600"
                                      placeholder={template.name}
                                    />
                                    <FieldNameSuggestion
                                      suggestion={overrideNameSuggestion}
                                      onUse={() =>
                                        setTemplateOverrideNames((currentNames) => ({
                                          ...currentNames,
                                          [template.id]: overrideNameSuggestion,
                                        }))
                                      }
                                    />
                                  </td>
                                  <td className="px-3 py-3">
                                    <div className="flex flex-wrap gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => editTemplateField(template)}
                                        disabled={isBusy}
                                        className="h-8 rounded-md border border-cyan-300 bg-white px-2.5 text-xs font-semibold text-cyan-700 transition hover:bg-cyan-50 disabled:cursor-not-allowed disabled:text-slate-400"
                                      >
                                        {editingTemplateId === template.id ? "Editing" : "Update"}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => deleteTemplateField(template)}
                                        disabled={isBusy}
                                        className="h-8 rounded-md border border-rose-200 bg-white px-2.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:text-slate-400"
                                      >
                                        {deletingTemplateFieldId === template.id ? "Deleting..." : "Delete"}
                                      </button>
                                    <button
                                      type="button"
                                      onClick={addTemplateToTable(template)}
                                      disabled={!canAdd || isBusy}
                                      className="h-8 min-w-24 rounded-md border border-emerald-300 bg-white px-3 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400 disabled:hover:bg-white"
                                    >
                                      {addingTemplateToTable === template.id
                                        ? "Adding..."
                                        : isUsed
                                          ? "Used"
                                          : selectedModelName
                                            ? "Add to Table"
                                            : "Select Table"}
                                    </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      {templatePageCount > 1 ? (
                        <div className="flex shrink-0 items-center justify-center gap-2 border-t border-slate-200 bg-slate-50 px-3 py-3">
                          <button
                            type="button"
                            onClick={() => setTemplatePage((page) => Math.max(1, page - 1))}
                            disabled={templatePage === 1}
                            className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-sm font-semibold text-slate-600 transition hover:border-cyan-200 hover:text-cyan-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {"<"}
                          </button>
                          <span className="text-sm font-semibold text-slate-600">
                            {templatePage} / {templatePageCount}
                          </span>
                          <button
                            type="button"
                            onClick={() => setTemplatePage((page) => Math.min(templatePageCount, page + 1))}
                            disabled={templatePage === templatePageCount}
                            className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-sm font-semibold text-slate-600 transition hover:border-cyan-200 hover:text-cyan-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {">"}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 xl:min-h-0 xl:overflow-y-auto">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                      {editingTemplateId ? "Update Template" : "Add Template"}
                    </p>
                    {editingTemplateId ? (
                      <button
                        type="button"
                        onClick={cancelTemplateEdit}
                        className="h-8 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                    ) : null}
                  </div>
                  <div className="mt-4 space-y-3">
                    <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                      Name
                      <input
                        value={templateField.name}
                        onChange={(event) => updateTemplateField({ name: event.target.value })}
                        className="mt-2 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-medium normal-case tracking-normal text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-cyan-600"
                        placeholder="email"
                      />
                      <FieldNameSuggestion
                        suggestion={templateNameSuggestion}
                        onUse={() => updateTemplateField({ name: templateNameSuggestion })}
                      />
                    </label>

                    {templateDuplicateSuggestion ? (
                      <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
                        Template name already exists.
                        {!editingTemplateId ? (
                          <>
                            {" "}Use{" "}
                            <button
                              type="button"
                              onClick={() => updateTemplateField({ name: templateDuplicateSuggestion })}
                              className="underline underline-offset-2"
                            >
                              {templateDuplicateSuggestion}
                            </button>
                            ?
                          </>
                        ) : null}
                      </div>
                    ) : null}

                    <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                      Type
                      <select
                        value={templateField.type}
                        onChange={(event) => updateTemplateField({ type: event.target.value })}
                        className="mt-2 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-medium normal-case tracking-normal text-slate-950 outline-none transition focus:border-cyan-600"
                      >
                        {fieldTypeOptions.map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                      Default
                      <input
                        value={templateField.defaultValue}
                        onChange={(event) => updateTemplateField({ defaultValue: event.target.value })}
                        className="mt-2 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-medium normal-case tracking-normal text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-cyan-600"
                        placeholder='"draft"'
                      />
                    </label>

                    <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                      Comment
                      <input
                        value={templateField.comment}
                        onChange={(event) => updateTemplateField({ comment: event.target.value })}
                        className="mt-2 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-medium normal-case tracking-normal text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-cyan-600"
                        placeholder="Public label"
                      />
                    </label>

                    <div className="flex flex-wrap gap-4">
                      <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
                        <input
                          type="checkbox"
                          checked={templateField.nullable}
                          onChange={(event) => updateTemplateField({ nullable: event.target.checked })}
                          className="h-4 w-4 rounded border-slate-300 text-cyan-600"
                        />
                        Nullable
                      </label>
                      {templateField.type !== "Boolean" ? (
                        <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
                          <input
                            type="checkbox"
                            checked={templateField.unique}
                            onChange={(event) => updateTemplateField({ unique: event.target.checked })}
                            className="h-4 w-4 rounded border-slate-300 text-cyan-600"
                          />
                          Unique
                        </label>
                      ) : null}
                    </div>

                    {templateError ? (
                      <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
                        {templateError}
                      </p>
                    ) : null}

                    <button
                      type="button"
                      onClick={submitTemplateField}
                      disabled={
                        createTemplateMutation.isPending ||
                        Boolean(templateDuplicateSuggestion) ||
                        Boolean(savingTemplateFieldId)
                      }
                      className="h-10 w-full rounded-md bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      {editingTemplateId
                        ? savingTemplateFieldId
                          ? "Updating..."
                          : "Update Template"
                        : createTemplateMutation.isPending
                          ? "Adding..."
                          : "Add Template"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

    </div>
  );
}
