"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { useProjectInfo } from "../shared/project-info-context";
import { useVersionDiffLookup } from "../shared/use-version-diff";
import { useSchemaWarnings } from "../shared/use-schema-warnings";
import { VersionDiffBadge, FieldDiffTooltip, ApproveWarningButton } from "../shared/version-diff-badge";
import type { FieldDiff } from "@/lib/version-diff/detect-changes";
import { classNames } from "../shared/dashboard-data";
import { IconCheck, IconChevronDown, IconChevronLeft, IconChevronRight, IconPlus, IconTrash } from "@tabler/icons-react";
import type {
  PrismaField,
  PrismaFieldInput,
  PrismaModel,
} from "@/lib/schema-store";
import type { FieldTemplate, FieldTemplateInput } from "@/lib/field-template-store";
import { providers as allProviders } from "../shared/dashboard-data";

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

function makeEmptyTemplateInput(provider: string): FieldTemplateInput {
  return { name: "", type: "String", nullable: false, unique: false, defaultValue: "", comment: "", provider };
}

function suggestDefault(type: string, provider: string): string {
  if (type === "Int" || type === "BigInt" || type === "Float" || type === "Decimal") return "0";
  if (type === "Boolean") return "false";
  if (type === "DateTime") return "now()";
  if (type === "Timestamp") {
    if (provider === "Postgres") return 'dbgenerated("now()")';
    if (provider === "MySQL") return "CURRENT_TIMESTAMP";
    if (provider === "SQLite") return "CURRENT_TIMESTAMP";
    return 'dbgenerated("now()")';
  }
  return "";
}

function typeBadgeClass(type: string) {
  if (type === "Int") return "bg-blue-50 text-blue-700";
  if (type === "String") return "bg-green-50 text-green-700";
  if (type === "DateTime") return "bg-orange-50 text-orange-700";
  if (type === "Uuid") return "bg-purple-50 text-purple-700";
  if (type === "BigInt") return "bg-rose-50 text-rose-700";
  return "bg-slate-100 text-slate-600";
}

function typeSelectClass(type: string) {
  if (type === "Int")                         return "border-blue-200 bg-blue-50 text-blue-800";
  if (type === "BigInt")                      return "border-rose-200 bg-rose-50 text-rose-800";
  if (type === "Float" || type === "Decimal") return "border-sky-200 bg-sky-50 text-sky-800";
  if (type === "String")                      return "border-green-200 bg-green-50 text-green-800";
  if (type === "Boolean")                     return "border-amber-200 bg-amber-50 text-amber-800";
  if (type === "DateTime")                    return "border-orange-200 bg-orange-50 text-orange-800";
  if (type === "Timestamp")                   return "border-orange-200 bg-orange-50 text-orange-800";
  if (type === "Json")                        return "border-violet-200 bg-violet-50 text-violet-800";
  if (type === "Uuid")                        return "border-purple-200 bg-purple-50 text-purple-800";
  if (type === "Bytes")                       return "border-slate-200 bg-slate-100 text-slate-600";
  return "border-slate-300 bg-white text-slate-950";
}

function templateTypeLabel(template: FieldTemplate) {
  return template.type === "DateTime" &&
    template.nativeAttribute?.name === "Timestamptz"
    ? "DateTime (Timestamp)"
    : template.type;
}


function fieldToInput(field: PrismaField): PrismaFieldInput {
  return {
    name: field.name,
    dbName: field.dbName,
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

function templateToInput(template: FieldTemplate): FieldTemplateInput {
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
    provider: template.provider ?? "All",
  };
}

export function SchemaPageContent() {
  const { projectName, version, versions, hasProject, provider: projectProvider, projectId } = useProjectInfo();
  const { diffByFieldKey, diffByTableKey } = useVersionDiffLookup(projectName, version);
  const versionIdx = versions.indexOf(version);
  const previousVersion = versionIdx > 0 ? versions[versionIdx - 1]! : "";
  const { getWarning, approve, unapprove } = useSchemaWarnings(projectId, previousVersion, version);
  const activeProject = hasProject;
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [selectedModelName, setSelectedModelName] = useState(
    () => searchParams.get("table") ?? "",
  );
  const [tableSearch, setTableSearch] = useState("");
  const [fieldDrafts, setFieldDrafts] = useState<Record<string, PrismaFieldInput>>({});
  const [newFieldDrafts, setNewFieldDrafts] = useState<Array<{id: string; input: PrismaFieldInput}>>([]);
  const [savingNewCardId, setSavingNewCardId] = useState("");
  const savingNewCardIdRef = useRef("");
  const [savingFieldKey, setSavingFieldKey] = useState("");
  const [isFieldLegendOpen, setIsFieldLegendOpen] = useState(true);
  const [deletingFieldKey, setDeletingFieldKey] = useState("");
  const [error, setError] = useState("");
  const [fieldTypeFilter, setFieldTypeFilter] = useState("All");
  const [fieldPage, setFieldPage] = useState(1);
  const [isTableSelectorOpen, setIsTableSelectorOpen] = useState(false);
  const [isTemplatesOpen, setIsTemplatesOpen] = useState(false);
  const [isTemplateDropdownOpen, setIsTemplateDropdownOpen] = useState(false);
  const [templateDropdownSearch, setTemplateDropdownSearch] = useState("");
  const templateDropdownRef = useRef<HTMLDivElement>(null);
  const [templateTypeFilter, setTemplateTypeFilter] = useState("All");
  const [templatePage, setTemplatePage] = useState(1);
  const [templateOverrideNames, setTemplateOverrideNames] = useState<Record<string, string>>({});
  const [templateField, setTemplateField] = useState<FieldTemplateInput>(() => makeEmptyTemplateInput(projectProvider || "All"));
  const [editDraft, setEditDraft] = useState<FieldTemplateInput | null>(null);
  const [templateProviderFilter, setTemplateProviderFilter] = useState("relevant");
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

  const removedFieldDiffs = useMemo(() => {
    const td = selectedModelKey ? diffByTableKey.get(selectedModelKey) : null;
    return (td?.fieldDiffs ?? []).filter((fd) => fd.changeKind === "removed" && !fd.isPk);
  }, [selectedModelKey, diffByTableKey]);

  const fieldsQuery = useQuery(
    trpc.fields.list.queryOptions(
      { projectName, version, modelName: selectedModelName, modelKey: selectedModelKey },
      { enabled: !!selectedModelName },
    ),
  );
  const fields: PrismaField[] = fieldsQuery.data?.fields ?? [];
  const enumTypes: string[] = fieldsQuery.data?.enumTypes ?? [];
  const scalarTypes: string[] = fieldsQuery.data?.scalarTypes ?? [];

  const enumsListQuery = useQuery(
    trpc.enums.list.queryOptions(
      { projectName, version },
      { enabled: !!projectName && !!version },
    ),
  );
  const enumsList = enumsListQuery.data ?? [];

  const getEnumValues = (enumName: string) =>
    enumsList.find((e) => e.name === enumName)?.values ?? [];

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
    onSuccess: () => {
      void invalidateFields();
      const id = savingNewCardIdRef.current;
      if (id) {
        setNewFieldDrafts(prev => prev.filter(d => d.id !== id));
        savingNewCardIdRef.current = "";
      }
      setSavingNewCardId("");
    },
    onError: (err) => { setError(err.message); setSavingNewCardId(""); savingNewCardIdRef.current = ""; },
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
    onSuccess: () => { void invalidateTemplates(); setTemplateField(makeEmptyTemplateInput(projectProvider || "All")); setEditingTemplateId(""); setSavingTemplateFieldId(""); },
    onError: (err) => { setTemplateError(err.message); setSavingTemplateFieldId(""); },
  });
  const updateTemplateMutation = useMutation({
    ...trpc.fieldTemplates.update.mutationOptions(),
    onSuccess: () => { void invalidateTemplates(); setEditingTemplateId(""); setEditDraft(null); setSavingTemplateFieldId(""); },
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

  const scalarTypeOptions = useMemo(
    () => Array.from(new Set([...defaultFieldTypes, ...scalarTypes])),
    [scalarTypes],
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
    return templates.filter((template) => {
      const typeMatch = templateTypeFilter === "All" || template.type === templateTypeFilter;
      const providerMatch =
        templateProviderFilter === "all" ||
        template.provider === "All" ||
        template.provider === projectProvider;
      return typeMatch && providerMatch;
    });
  }, [templateTypeFilter, templateProviderFilter, templates, projectProvider]);

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

  const relevantDropdownTemplates = useMemo(() => {
    const search = templateDropdownSearch.toLowerCase();
    return templates.filter(
      (t) =>
        (t.provider === "All" || t.provider === projectProvider) &&
        !usedTemplateNames.has(t.name) &&
        (!search || t.name.toLowerCase().includes(search)),
    );
  }, [templates, projectProvider, templateDropdownSearch, usedTemplateNames]);

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
    setFieldPage(1);
    setFieldTypeFilter("All");
    setNewFieldDrafts([]);
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

  useEffect(() => {
    if (!isTemplateDropdownOpen) return;
    const onMouse = (e: MouseEvent) => {
      if (templateDropdownRef.current && !templateDropdownRef.current.contains(e.target as Node)) {
        setIsTemplateDropdownOpen(false);
        setTemplateDropdownSearch("");
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setIsTemplateDropdownOpen(false); setTemplateDropdownSearch(""); }
    };
    document.addEventListener("mousedown", onMouse);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onMouse); document.removeEventListener("keydown", onKey); };
  }, [isTemplateDropdownOpen]);

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

  const displayTypeToInputType: Record<string, string> = {
    String: "String", Int: "Int", Boolean: "Boolean", Float: "Float",
    BigInt: "BigInt", Decimal: "Decimal", DateTime: "DateTime",
    Uuid: "String", Json: "Json", Bytes: "Bytes",
  };

  const restoreRemovedField = (fd: FieldDiff) => {
    if (!selectedModelName) return;
    const type = displayTypeToInputType[fd.from] ?? "String";
    setError("");
    createFieldMutation.mutate({
      projectName, version,
      modelKey: selectedModelKey, modelName: selectedModelName,
      name: fd.fieldName, type, nullable: true, unique: false, defaultValue: "", comment: "",
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

  const selectModel = (modelName: string) => {
    setSelectedModelName(modelName);
    setIsTableSelectorOpen(false);
  };

  const addNewFieldCard = () => {
    setNewFieldDrafts(prev => [...prev, { id: crypto.randomUUID(), input: { ...emptyFieldInput } }]);
  };

  const updateNewFieldDraft = (draftId: string, patch: Partial<PrismaFieldInput>) => {
    setNewFieldDrafts(prev =>
      prev.map(d =>
        d.id === draftId
          ? { ...d, input: { ...d.input, ...patch, unique: patch.type === "Boolean" ? false : patch.unique ?? d.input.unique } }
          : d,
      ),
    );
    setError("");
  };

  const removeNewFieldDraft = (draftId: string) => {
    setNewFieldDrafts(prev => prev.filter(d => d.id !== draftId));
  };

  const saveNewFieldDraft = (draftId: string) => {
    const draft = newFieldDrafts.find(d => d.id === draftId);
    if (!draft || !selectedModelName) return;
    setSavingNewCardId(draftId);
    savingNewCardIdRef.current = draftId;
    setError("");
    createFieldMutation.mutate({
      projectName, version,
      modelKey: selectedModelKey, modelName: selectedModelName,
      ...draft.input,
    });
  };

  const updateTemplateField = (patch: Partial<FieldTemplateInput>) => {
    setTemplateField((field) => {
      const next = { ...field, ...patch, unique: patch.type === "Boolean" ? false : patch.unique ?? field.unique };
      if (patch.type !== undefined && patch.type !== field.type) {
        next.defaultValue = suggestDefault(patch.type, next.provider);
      } else if (patch.provider !== undefined && patch.provider !== field.provider) {
        const oldSuggestion = suggestDefault(field.type, field.provider);
        if (!field.defaultValue.trim() || field.defaultValue === oldSuggestion) {
          next.defaultValue = suggestDefault(field.type, patch.provider);
        }
      }
      return next;
    });
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

  const updateEditDraft = (patch: Partial<FieldTemplateInput>) => {
    setEditDraft((d) => {
      if (!d) return d;
      const next = { ...d, ...patch, unique: patch.type === "Boolean" ? false : patch.unique ?? d.unique };
      if (patch.type !== undefined && patch.type !== d.type) {
        next.defaultValue = suggestDefault(patch.type, next.provider);
      }
      return next;
    });
    setTemplateError("");
  };

  const editTemplateField = (template: FieldTemplate) => {
    setEditingTemplateId(template.id);
    setEditDraft(templateToInput(template));
    setTemplateError("");
  };

  const cancelTemplateEdit = () => {
    setEditingTemplateId("");
    setEditDraft(null);
    setTemplateError("");
  };

  const saveTemplateField = () => {
    if (!editingTemplateId || !editDraft) return;
    setSavingTemplateFieldId(editingTemplateId);
    setTemplateError("");
    updateTemplateMutation.mutate({ id: editingTemplateId, ...editDraft });
  };

  const deleteTemplateField = (template: FieldTemplate) => {
    setDeletingTemplateFieldId(template.id);
    setTemplateError("");
    deleteTemplateMutation.mutate({ id: template.id });
    if (editingTemplateId === template.id) {
      setEditingTemplateId("");
      setEditDraft(null);
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
              {selectedModelName ? (
                <div className="relative flex" ref={templateDropdownRef}>
                  <button
                    type="button"
                    onClick={addNewFieldCard}
                    className="flex h-9 items-center gap-1.5 rounded-l-md border border-r-0 border-cyan-300 bg-white px-3 text-xs font-semibold text-cyan-600 transition hover:bg-cyan-50"
                  >
                    <IconPlus size={14} stroke={2} />
                    New Field
                  </button>
                  <button
                    type="button"
                    onClick={() => { setIsTemplateDropdownOpen((o) => !o); setTemplateDropdownSearch(""); }}
                    className="flex h-9 items-center rounded-r-md border border-cyan-300 bg-white px-2 text-cyan-600 transition hover:bg-cyan-50"
                    title="Add from template"
                  >
                    <IconChevronDown size={14} stroke={2} />
                  </button>

                  {isTemplateDropdownOpen ? (
                    <div className="absolute right-0 top-full z-30 mt-1 w-72 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
                      <div className="border-b border-slate-100 p-2">
                        <input
                          type="text"
                          value={templateDropdownSearch}
                          onChange={(e) => setTemplateDropdownSearch(e.target.value)}
                          placeholder="Search templates..."
                          autoFocus
                          className="h-8 w-full rounded-md border border-slate-300 bg-white px-2.5 text-xs font-medium text-slate-950 outline-none placeholder:text-slate-400 focus:border-cyan-600"
                        />
                      </div>
                      <div className="max-h-64 overflow-y-auto">
                        {relevantDropdownTemplates.length === 0 ? (
                          <div className="px-3 py-5 text-center text-xs font-medium text-slate-500">
                            {templates.length === 0 ? "No templates yet." : "No matches."}
                          </div>
                        ) : (
                          relevantDropdownTemplates.map((template) => {
                            const isBusy = addingTemplateToTable === template.id;
                            return (
                              <button
                                key={template.id}
                                type="button"
                                onClick={() => {
                                  setIsTemplateDropdownOpen(false);
                                  setTemplateDropdownSearch("");
                                  addTemplateToTable(template)();
                                }}
                                disabled={isBusy}
                                className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left transition hover:bg-slate-50 disabled:opacity-40"
                              >
                                <span className="min-w-0 truncate text-xs font-semibold text-slate-950">
                                  {template.name}
                                </span>
                                <span className={classNames("shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold", typeBadgeClass(template.type))}>
                                  {template.type}
                                </span>
                              </button>
                            );
                          })
                        )}
                      </div>
                      <div className="border-t border-slate-100 px-3 py-2">
                        <button
                          type="button"
                          onClick={() => { setIsTemplateDropdownOpen(false); setIsTemplatesOpen(true); }}
                          className="text-xs font-semibold text-emerald-600 transition hover:underline"
                        >
                          Open full Templates →
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
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
              <div>
                  <div className="mb-3 flex flex-col gap-3 2xl:flex-row 2xl:items-center 2xl:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                        Selected Table
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <h4 className="text-lg font-semibold text-slate-950">
                          {selectedModelName}
                        </h4>
                        {(() => {
                          const td = selectedModelKey ? diffByTableKey.get(selectedModelKey) : null;
                          return td ? (
                            <VersionDiffBadge
                              severity={td.severity}
                              title={td.message}
                            />
                          ) : null;
                        })()}
                      </div>
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
                      <button
                        type="button"
                        onClick={() => setIsFieldLegendOpen((o) => !o)}
                        className={classNames(
                          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold transition",
                          isFieldLegendOpen
                            ? "border-cyan-300 bg-cyan-50 text-cyan-700"
                            : "border-slate-300 bg-white text-slate-500 hover:border-cyan-200 hover:text-cyan-600",
                        )}
                        title="Field legend"
                      >
                        ?
                      </button>
                    </div>
                  </div>

                  {isFieldLegendOpen ? (
                    <div className="mb-4 grid grid-cols-2 gap-x-6 gap-y-2 rounded-lg border border-cyan-100 bg-cyan-50/60 px-4 py-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                      {[
                        { label: "Name", desc: "Prisma field name — camelCase, used in generated code and queries." },
                        { label: "Type", desc: "Scalar type written into the Prisma schema (String, Int, Boolean…)." },
                        { label: "Enum (indigo)", desc: "Project-defined enum type — select \"Enum\" in Type to reveal the enum picker. Values are shown as chips below." },
                        { label: "Default", desc: "Default value expression in the schema, e.g. now(), false, 0." },
                        { label: "Comment", desc: "Free-text note stored as a Prisma comment (/// …) above the field." },
                        { label: "Nullable (green)", desc: "Field is optional — Prisma adds ? suffix, column accepts NULL." },
                        { label: "Required (amber)", desc: "Field is required — column cannot be NULL, Prisma enforces presence." },
                        { label: "Unique (violet)", desc: "Adds @unique — no two rows can share this value." },
                        { label: "Multiple (sky)", desc: "No unique constraint — duplicate values across rows are allowed." },
                        { label: "✓ Save", desc: "Persist unsaved edits to this field into the schema." },
                        { label: "🗑 Delete", desc: "Remove this field from the table entirely (shown when no edits are pending)." },
                      ].map(({ label, desc }) => (
                        <div key={label}>
                          <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-cyan-700">{label}</p>
                          <p className="mt-0.5 text-[11px] leading-relaxed text-slate-600">{desc}</p>
                        </div>
                      ))}
                    </div>
                  ) : null}

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
                      {newFieldDrafts.length > 0 ? (
                        <div className="grid gap-3 xl:grid-cols-2 2xl:grid-cols-3">
                          {newFieldDrafts.map((draft) => {
                            const hasName = draft.input.name.trim().length > 0;
                            return (
                              <div
                                key={draft.id}
                                className="rounded-lg border border-cyan-200 bg-white p-3 shadow-sm"
                              >
                                <div className="flex gap-3">
                                  <div className="min-w-0 flex-1 grid gap-2">
                                    <div className={classNames("grid gap-2", enumTypes.includes(draft.input.type) ? "grid-cols-[1fr_minmax(0,120px)_minmax(0,140px)_1fr]" : "grid-cols-[1fr_minmax(0,140px)_1fr]")}>
                                      <label className="block text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                                        Name
                                        <input
                                          value={draft.input.name}
                                          onChange={(event) => updateNewFieldDraft(draft.id, { name: event.target.value })}
                                          className="mt-1 h-8 w-full rounded-md border border-slate-300 bg-white px-2.5 text-xs font-medium normal-case tracking-normal text-slate-950 outline-none transition focus:border-cyan-600"
                                          autoFocus
                                        />
                                      </label>
                                      <label className="block text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                                        Type
                                        <select
                                          value={enumTypes.includes(draft.input.type) ? "Enum" : draft.input.type}
                                          onChange={(event) => {
                                            const val = event.target.value;
                                            if (val === "Enum") {
                                              updateNewFieldDraft(draft.id, { type: enumTypes[0] ?? draft.input.type });
                                            } else {
                                              updateNewFieldDraft(draft.id, { type: val });
                                            }
                                          }}
                                          className={classNames("mt-1 h-8 w-full rounded-md border px-2.5 text-xs font-medium normal-case tracking-normal outline-none transition focus:border-cyan-600", enumTypes.includes(draft.input.type) ? "border-indigo-200 bg-indigo-50 text-indigo-800" : typeSelectClass(draft.input.type))}
                                        >
                                          {scalarTypeOptions.map((type) => (
                                            <option key={type} value={type}>{type}</option>
                                          ))}
                                          <option value="Enum" disabled={enumTypes.length === 0}>Enum</option>
                                        </select>
                                      </label>
                                      {enumTypes.includes(draft.input.type) ? (
                                        <label className="block text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                                          Enum
                                          <select
                                            value={draft.input.type}
                                            onChange={(event) => updateNewFieldDraft(draft.id, { type: event.target.value })}
                                            className="mt-1 h-8 w-full rounded-md border border-indigo-200 bg-indigo-50 px-2.5 text-xs font-medium normal-case tracking-normal text-indigo-800 outline-none transition focus:border-indigo-400"
                                          >
                                            {enumTypes.map((enumName) => (
                                              <option key={enumName} value={enumName}>{enumName}</option>
                                            ))}
                                          </select>
                                        </label>
                                      ) : null}
                                      <label className="block text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                                        Default
                                        <input
                                          value={draft.input.defaultValue}
                                          readOnly={enumTypes.includes(draft.input.type)}
                                          onChange={(event) => {
                                            if (!enumTypes.includes(draft.input.type)) updateNewFieldDraft(draft.id, { defaultValue: event.target.value });
                                          }}
                                          className={classNames(
                                            "mt-1 h-8 w-full rounded-md border px-2.5 text-xs font-medium normal-case tracking-normal text-slate-950 outline-none transition",
                                            enumTypes.includes(draft.input.type)
                                              ? "cursor-default border-indigo-100 bg-indigo-50/60 text-indigo-700"
                                              : "border-slate-300 bg-white placeholder:text-slate-400 focus:border-cyan-600",
                                          )}
                                          placeholder={enumTypes.includes(draft.input.type) ? "Pick a value ↓" : "Default value"}
                                        />
                                      </label>
                                    </div>
                                    {enumTypes.includes(draft.input.type) ? (
                                      <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-indigo-100 bg-indigo-50/70 px-2.5 py-1.5">
                                        <span className="mr-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-indigo-400">Values</span>
                                        {getEnumValues(draft.input.type).length === 0 ? (
                                          <span className="text-[10px] font-medium text-indigo-300">No values defined</span>
                                        ) : (
                                          <>
                                            {getEnumValues(draft.input.type).slice(0, 12).map((v) => {
                                              const isActive = draft.input.defaultValue === `"${v.name}"`;
                                              return (
                                                <button
                                                  key={v.valueId}
                                                  type="button"
                                                  onClick={() => updateNewFieldDraft(draft.id, { defaultValue: isActive ? "" : `"${v.name}"` })}
                                                  className={classNames(
                                                    "rounded px-1.5 py-0.5 text-[10px] font-semibold transition",
                                                    isActive ? "bg-indigo-600 text-white" : "bg-indigo-100 text-indigo-700 hover:bg-indigo-200",
                                                  )}
                                                >
                                                  {v.name}
                                                </button>
                                              );
                                            })}
                                            {getEnumValues(draft.input.type).length > 12 ? (
                                              <span className="text-[10px] font-medium text-indigo-400">+{getEnumValues(draft.input.type).length - 12} more</span>
                                            ) : null}
                                          </>
                                        )}
                                      </div>
                                    ) : null}
                                    <label className="block text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                                      Comment
                                      <input
                                        value={draft.input.comment}
                                        onChange={(event) => updateNewFieldDraft(draft.id, { comment: event.target.value })}
                                        className="mt-1 h-8 w-full rounded-md border border-slate-300 bg-white px-2.5 text-xs font-medium normal-case tracking-normal text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-cyan-600"
                                        placeholder="FK companies"
                                      />
                                    </label>
                                  </div>
                                  <div className="flex w-1/5 min-w-0 flex-col gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => updateNewFieldDraft(draft.id, { nullable: !draft.input.nullable })}
                                      className={classNames(
                                        "h-8 rounded-md border px-2.5 text-[11px] font-semibold transition",
                                        draft.input.nullable
                                          ? "border-emerald-500 bg-emerald-500 text-white hover:bg-emerald-600"
                                          : "border-amber-400 bg-amber-400 text-white hover:bg-amber-500",
                                      )}
                                    >
                                      {draft.input.nullable ? "Nullable" : "Required"}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => updateNewFieldDraft(draft.id, { unique: !draft.input.unique })}
                                      disabled={draft.input.type === "Boolean"}
                                      className={classNames(
                                        "h-8 rounded-md border px-2.5 text-[11px] font-semibold transition",
                                        draft.input.unique
                                          ? "border-violet-500 bg-violet-500 text-white hover:bg-violet-600"
                                          : "border-sky-400 bg-sky-400 text-white hover:bg-sky-500",
                                        draft.input.type === "Boolean" && "cursor-not-allowed opacity-30",
                                      )}
                                    >
                                      {draft.input.unique ? "Unique" : "Multiple"}
                                    </button>
                                    <div className="mt-auto">
                                      {hasName ? (
                                        <button
                                          type="button"
                                          onClick={() => saveNewFieldDraft(draft.id)}
                                          disabled={savingNewCardId === draft.id}
                                          className="flex h-8 w-full items-center justify-center rounded-md border border-cyan-300 bg-white text-cyan-600 transition hover:bg-cyan-50 disabled:cursor-not-allowed disabled:opacity-40"
                                          title="Save"
                                        >
                                          <IconCheck size={15} stroke={2.5} />
                                        </button>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() => removeNewFieldDraft(draft.id)}
                                          className="flex h-8 w-full items-center justify-center rounded-md border border-rose-200 bg-white text-rose-500 transition hover:bg-rose-50"
                                          title="Cancel"
                                        >
                                          <IconTrash size={15} stroke={2} />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : null}
                      <div className="grid gap-3 xl:grid-cols-2 2xl:grid-cols-3">
                        {paginatedFields.map((field) => {
                          const draft = fieldDrafts[field.key] ?? fieldToInput(field);
                          const hasChanges =
                            draft.name !== field.name ||
                            draft.type !== field.type ||
                            draft.nullable !== field.nullable ||
                            draft.unique !== field.unique ||
                            (draft.defaultValue ?? "") !== (field.defaultValue ?? "") ||
                            (draft.comment ?? "") !== (field.comment ?? "");
                          const fieldDiff = diffByFieldKey.get(field.key);
                          const cardBorder = fieldDiff
                            ? fieldDiff.severity === "breaking" ? "border-red-300"
                              : fieldDiff.severity === "warning" ? "border-amber-300"
                              : "border-sky-300"
                            : "border-slate-200";

                          return (
                            <div
                              key={field.key}
                              className={classNames("rounded-lg border bg-white p-3 shadow-sm", cardBorder)}
                            >
                              <div className="flex gap-3">
                                <div className="min-w-0 flex-1 grid gap-2">
                                  <div className={classNames("grid gap-2", enumTypes.includes(draft.type) ? "grid-cols-[1fr_minmax(0,120px)_minmax(0,140px)_1fr]" : "grid-cols-[1fr_minmax(0,140px)_1fr]")}>
                                    <label className="block text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                                      Name
                                      <input
                                        value={draft.name}
                                        onChange={(event) => updateDraft(field.key, { name: event.target.value })}
                                        className="mt-1 h-8 w-full rounded-md border border-slate-300 bg-white px-2.5 text-xs font-medium normal-case tracking-normal text-slate-950 outline-none transition focus:border-cyan-600"
                                      />
                                    </label>
                                    <label className="block text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                                      Type
                                      <select
                                        value={enumTypes.includes(draft.type) ? "Enum" : draft.type}
                                        onChange={(event) => {
                                          const val = event.target.value;
                                          if (val === "Enum") {
                                            updateDraft(field.key, { type: enumTypes[0] ?? draft.type });
                                          } else {
                                            updateDraft(field.key, { type: val });
                                          }
                                        }}
                                        className={classNames("mt-1 h-8 w-full rounded-md border px-2.5 text-xs font-medium normal-case tracking-normal outline-none transition focus:border-cyan-600", enumTypes.includes(draft.type) ? "border-indigo-200 bg-indigo-50 text-indigo-800" : typeSelectClass(draft.type))}
                                      >
                                        {scalarTypeOptions.map((type) => (
                                          <option key={type} value={type}>{type}</option>
                                        ))}
                                        <option value="Enum" disabled={enumTypes.length === 0}>Enum</option>
                                      </select>
                                      {fieldDiff && fieldDiff.from && fieldDiff.to && fieldDiff.from !== fieldDiff.to && (
                                        <span className="mt-0.5 block font-semibold normal-case tracking-normal text-amber-600">
                                          was: {fieldDiff.from}
                                        </span>
                                      )}
                                    </label>
                                    {enumTypes.includes(draft.type) ? (
                                      <label className="block text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                                        Enum
                                        <select
                                          value={draft.type}
                                          onChange={(event) => updateDraft(field.key, { type: event.target.value })}
                                          className="mt-1 h-8 w-full rounded-md border border-indigo-200 bg-indigo-50 px-2.5 text-xs font-medium normal-case tracking-normal text-indigo-800 outline-none transition focus:border-indigo-400"
                                        >
                                          {enumTypes.map((enumName) => (
                                            <option key={enumName} value={enumName}>{enumName}</option>
                                          ))}
                                        </select>
                                      </label>
                                    ) : null}
                                    <label className="block text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                                      Default
                                      <input
                                        value={draft.defaultValue}
                                        readOnly={enumTypes.includes(draft.type)}
                                        onChange={(event) => {
                                          if (!enumTypes.includes(draft.type)) updateDraft(field.key, { defaultValue: event.target.value });
                                        }}
                                        className={classNames(
                                          "mt-1 h-8 w-full rounded-md border px-2.5 text-xs font-medium normal-case tracking-normal text-slate-950 outline-none transition",
                                          enumTypes.includes(draft.type)
                                            ? "cursor-default border-indigo-100 bg-indigo-50/60 text-indigo-700"
                                            : "border-slate-300 bg-white placeholder:text-slate-400 focus:border-cyan-600",
                                        )}
                                        placeholder={enumTypes.includes(draft.type) ? "Pick a value ↓" : "Default value"}
                                      />
                                    </label>
                                  </div>
                                  {enumTypes.includes(draft.type) ? (
                                    <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-indigo-100 bg-indigo-50/70 px-2.5 py-1.5">
                                      <span className="mr-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-indigo-400">Values</span>
                                      {getEnumValues(draft.type).length === 0 ? (
                                        <span className="text-[10px] font-medium text-indigo-300">No values defined</span>
                                      ) : (
                                        <>
                                          {getEnumValues(draft.type).slice(0, 12).map((v) => {
                                            const isActive = draft.defaultValue === `"${v.name}"`;
                                            return (
                                              <button
                                                key={v.valueId}
                                                type="button"
                                                onClick={() => updateDraft(field.key, { defaultValue: isActive ? "" : `"${v.name}"` })}
                                                className={classNames(
                                                  "rounded px-1.5 py-0.5 text-[10px] font-semibold transition",
                                                  isActive ? "bg-indigo-600 text-white" : "bg-indigo-100 text-indigo-700 hover:bg-indigo-200",
                                                )}
                                              >
                                                {v.name}
                                              </button>
                                            );
                                          })}
                                          {getEnumValues(draft.type).length > 12 ? (
                                            <span className="text-[10px] font-medium text-indigo-400">+{getEnumValues(draft.type).length - 12} more</span>
                                          ) : null}
                                        </>
                                      )}
                                    </div>
                                  ) : null}
                                  <label className="block text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                                    Comment
                                    <input
                                      value={draft.comment}
                                      onChange={(event) => updateDraft(field.key, { comment: event.target.value })}
                                      className="mt-1 h-8 w-full rounded-md border border-slate-300 bg-white px-2.5 text-xs font-medium normal-case tracking-normal text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-cyan-600"
                                      placeholder="FK companies"
                                    />
                                  </label>
                                  {fieldDiff ? (
                                    <div className="flex items-start gap-2">
                                      <div className="flex-1">
                                        <FieldDiffTooltip diff={fieldDiff} />
                                      </div>
                                      <ApproveWarningButton
                                        warning={getWarning("field", fieldDiff.fieldId, fieldDiff.changeKind)}
                                        onApprove={approve}
                                        onUnapprove={unapprove}
                                      />
                                    </div>
                                  ) : null}
                                </div>
                                <div className="flex w-1/5 min-w-0 flex-col gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => updateDraft(field.key, { nullable: !draft.nullable })}
                                    className={classNames(
                                      "h-8 rounded-md border px-2.5 text-[11px] font-semibold transition",
                                      draft.nullable
                                        ? "border-emerald-500 bg-emerald-500 text-white hover:bg-emerald-600"
                                        : "border-amber-400 bg-amber-400 text-white hover:bg-amber-500",
                                    )}
                                  >
                                    {draft.nullable ? "Nullable" : "Required"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => updateDraft(field.key, { unique: !draft.unique })}
                                    disabled={draft.type === "Boolean"}
                                    className={classNames(
                                      "h-8 rounded-md border px-2.5 text-[11px] font-semibold transition",
                                      draft.unique
                                        ? "border-violet-500 bg-violet-500 text-white hover:bg-violet-600"
                                        : "border-sky-400 bg-sky-400 text-white hover:bg-sky-500",
                                      draft.type === "Boolean" && "cursor-not-allowed opacity-30",
                                    )}
                                  >
                                    {draft.unique ? "Unique" : "Multiple"}
                                  </button>
                                  <div className="mt-auto">
                                    {hasChanges ? (
                                      <button
                                        type="button"
                                        onClick={() => saveField(field)}
                                        disabled={savingFieldKey === field.key}
                                        className="flex h-8 w-full items-center justify-center rounded-md border border-cyan-300 bg-white text-cyan-600 transition hover:bg-cyan-50 disabled:cursor-not-allowed disabled:opacity-40"
                                        title="Save"
                                      >
                                        <IconCheck size={15} stroke={2.5} />
                                      </button>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => deleteField(field)}
                                        disabled={deletingFieldKey === field.key}
                                        className="flex h-8 w-full items-center justify-center rounded-md border border-rose-200 bg-white text-rose-500 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40"
                                        title="Delete"
                                      >
                                        <IconTrash size={15} stroke={2} />
                                      </button>
                                    )}
                                  </div>
                                </div>
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
                            className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 transition hover:border-cyan-200 hover:text-cyan-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <IconChevronLeft size={15} stroke={2} />
                          </button>
                          <span className="text-sm font-semibold text-slate-600">
                            {fieldPage} / {fieldPageCount}
                          </span>
                          <button
                            type="button"
                            onClick={() => setFieldPage((page) => Math.min(fieldPageCount, page + 1))}
                            disabled={fieldPage === fieldPageCount}
                            className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 transition hover:border-cyan-200 hover:text-cyan-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <IconChevronRight size={15} stroke={2} />
                          </button>
                        </div>
                      ) : null}
                    </div>
                  )}
              </div>

              {removedFieldDiffs.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-red-600">
                      Removed since previous version
                    </p>
                    <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-700">
                      {removedFieldDiffs.length}
                    </span>
                  </div>
                  <div className="grid gap-3 xl:grid-cols-2 2xl:grid-cols-3">
                    {removedFieldDiffs.map((fd) => (
                      <div
                        key={fd.fieldId}
                        className="rounded-lg border border-dashed border-red-200 bg-red-50/40 p-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-red-500">
                              Removed field
                            </p>
                            <p className="mt-0.5 font-semibold text-slate-800">{fd.fieldName}</p>
                            <div className="mt-1 flex items-center gap-1.5">
                              <span className={classNames("rounded px-1.5 py-0.5 text-[10px] font-semibold", typeBadgeClass(fd.from))}>
                                {fd.from}
                              </span>
                            </div>
                            <p className="mt-1.5 text-[10px] leading-relaxed text-slate-500">{fd.message}</p>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-1.5">
                            <ApproveWarningButton
                              warning={getWarning("field", fd.fieldId, fd.changeKind)}
                              onApprove={approve}
                              onUnapprove={unapprove}
                            />
                            <button
                              type="button"
                              onClick={() => restoreRemovedField(fd)}
                              disabled={createFieldMutation.isPending}
                              className="rounded-md border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:border-red-300 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Restore
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

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
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-3"
          onClick={() => setIsTemplatesOpen(false)}
        >
          <div
            className="flex h-[96vh] w-[98vw] flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
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
              <div className="flex min-h-full flex-col xl:h-full xl:min-h-0">
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
                      Provider
                      <select
                        value={templateProviderFilter}
                        onChange={(event) => setTemplateProviderFilter(event.target.value)}
                        className="h-8 min-w-36 rounded-md border border-slate-300 bg-white px-2.5 text-xs font-semibold normal-case tracking-normal text-slate-700 outline-none transition focus:border-cyan-600"
                      >
                        <option value="relevant">Relevant ({projectProvider || "—"})</option>
                        <option value="all">All providers</option>
                      </select>
                    </label>
                    <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                      Type
                      <select
                        value={templateTypeFilter}
                        onChange={(event) => setTemplateTypeFilter(event.target.value)}
                        className="h-8 min-w-36 rounded-md border border-slate-300 bg-white px-2.5 text-xs font-semibold normal-case tracking-normal text-slate-700 outline-none transition focus:border-cyan-600"
                      >
                        <option value="All">All types</option>
                        {templateTypeOptions.map((type) => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                    </label>
                    <span className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600">
                      {filteredTemplates.length} / {templates.length} templates
                    </span>
                    {!selectedModelName ? (
                      <button
                        type="button"
                        onClick={() => { setIsTemplatesOpen(false); setIsTableSelectorOpen(true); }}
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

                {templateError ? (
                  <div className="mb-3 shrink-0 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
                    {templateError}
                  </div>
                ) : null}

                {templatesQuery.isLoading ? (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-8 text-center text-sm font-medium text-slate-500">
                    Loading templates...
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-lg border border-slate-200 bg-white xl:flex xl:min-h-0 xl:flex-1 xl:flex-col">
                    <div className="overflow-auto xl:min-h-0 xl:flex-1">
                      <table className="min-w-[1300px] w-full border-collapse text-left text-sm">
                        <thead className="sticky top-0 bg-slate-50 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                          <tr>
                            <th className="border-b border-slate-200 px-3 py-3">Name</th>
                            <th className="border-b border-slate-200 px-3 py-3">Provider</th>
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
                          {/* Inline add row */}
                          <tr className={classNames("align-middle border-b-2", editingTemplateId ? "border-slate-200 bg-slate-50/50" : "border-emerald-200 bg-emerald-50/30")}>
                            {editingTemplateId ? (
                              <td colSpan={10} className="px-3 py-2.5 text-xs font-medium text-slate-400">
                                Save or cancel the row being edited to add a new template.
                              </td>
                            ) : (
                              <>
                                <td className="px-2 py-2">
                                  <input
                                    value={templateField.name}
                                    onChange={(e) => updateTemplateField({ name: e.target.value })}
                                    placeholder="field_name"
                                    className={classNames("h-8 w-full rounded-md border bg-white px-2.5 text-xs font-medium text-slate-950 outline-none placeholder:text-slate-400 focus:border-cyan-600", templateDuplicateSuggestion ? "border-rose-400" : "border-slate-300")}
                                  />
                                  {templateDuplicateSuggestion ? (
                                    <p className="mt-1 text-[10px] font-semibold text-rose-600">
                                      Taken — use{" "}
                                      <button type="button" onClick={() => updateTemplateField({ name: templateDuplicateSuggestion })} className="underline underline-offset-1">{templateDuplicateSuggestion}</button>?
                                    </p>
                                  ) : null}
                                </td>
                                <td className="px-2 py-2">
                                  <select value={templateField.provider} onChange={(e) => updateTemplateField({ provider: e.target.value })} className="h-8 w-full rounded-md border border-slate-300 bg-white px-2 text-xs font-medium text-slate-950 outline-none focus:border-cyan-600">
                                    <option value="All">All</option>
                                    {allProviders.map((p) => <option key={p} value={p}>{p}</option>)}
                                  </select>
                                </td>
                                <td className="px-2 py-2">
                                  <select value={templateField.type} onChange={(e) => updateTemplateField({ type: e.target.value })} className={classNames("h-8 w-full rounded-md border px-2 text-xs font-medium outline-none focus:border-cyan-600", typeSelectClass(templateField.type))}>
                                    {fieldTypeOptions.map((t) => <option key={t} value={t}>{t}</option>)}
                                  </select>
                                </td>
                                <td className="px-2 py-2">
                                  <input value={templateField.defaultValue} onChange={(e) => updateTemplateField({ defaultValue: e.target.value })} placeholder="Default value" className="h-8 w-full rounded-md border border-slate-300 bg-white px-2.5 text-xs font-medium text-slate-950 outline-none placeholder:text-slate-400 focus:border-cyan-600" />
                                </td>
                                <td className="px-2 py-2">
                                  <button type="button" onClick={() => updateTemplateField({ nullable: !templateField.nullable })} className={classNames("h-8 w-20 rounded-md border text-xs font-semibold transition", templateField.nullable ? "border-emerald-500 bg-emerald-500 text-white" : "border-amber-400 bg-amber-400 text-white")}>
                                    {templateField.nullable ? "Yes" : "No"}
                                  </button>
                                </td>
                                <td className="px-2 py-2">
                                  {templateField.type === "Boolean" ? (
                                    <span className="text-xs font-semibold text-slate-400">N/A</span>
                                  ) : (
                                    <button type="button" onClick={() => updateTemplateField({ unique: !templateField.unique })} className={classNames("h-8 w-20 rounded-md border text-xs font-semibold transition", templateField.unique ? "border-violet-500 bg-violet-500 text-white" : "border-sky-400 bg-sky-400 text-white")}>
                                      {templateField.unique ? "Yes" : "No"}
                                    </button>
                                  )}
                                </td>
                                <td className="px-2 py-2">
                                  <input value={templateField.comment} onChange={(e) => updateTemplateField({ comment: e.target.value })} placeholder="Description" className="h-8 w-full rounded-md border border-slate-300 bg-white px-2.5 text-xs font-medium text-slate-950 outline-none placeholder:text-slate-400 focus:border-cyan-600" />
                                </td>
                                <td className="px-3 py-2 text-xs font-semibold text-slate-400">—</td>
                                <td className="px-3 py-2 text-xs font-semibold text-slate-400">—</td>
                                <td className="px-2 py-2">
                                  <button type="button" onClick={createTemplateField} disabled={!templateField.name.trim() || !!templateDuplicateSuggestion || createTemplateMutation.isPending} className="h-8 rounded-md border border-emerald-300 bg-white px-3 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-40">
                                    {createTemplateMutation.isPending ? "Adding..." : "Add"}
                                  </button>
                                </td>
                              </>
                            )}
                          </tr>

                          {filteredTemplates.length === 0 && templates.length > 0 ? (
                            <tr>
                              <td colSpan={10} className="px-3 py-6 text-center text-sm font-medium text-slate-500">
                                No templates match the selected filters.
                              </td>
                            </tr>
                          ) : (
                            paginatedTemplates.map((template) => {
                              const overrideName = (templateOverrideNames[template.id] || template.name).trim();
                              const isUsed = selectedModelName ? usedTemplateNames.has(overrideName) : false;
                              const canAdd = Boolean(selectedModelName) && !isUsed && Boolean(overrideName);
                              const isBusy = addingTemplateToTable === template.id || savingTemplateFieldId === template.id || deletingTemplateFieldId === template.id;
                              const isEditing = editingTemplateId === template.id;

                              if (isEditing && editDraft) {
                                return (
                                  <tr key={template.id} className="bg-cyan-50/60 align-middle">
                                    <td className="px-2 py-2">
                                      <input
                                        value={editDraft.name}
                                        onChange={(e) => updateEditDraft({ name: e.target.value })}
                                        className="h-8 w-full rounded-md border border-cyan-300 bg-white px-2.5 text-xs font-medium text-slate-950 outline-none focus:border-cyan-600"
                                        autoFocus
                                      />
                                    </td>
                                    <td className="px-2 py-2">
                                      <select
                                        value={editDraft.provider}
                                        onChange={(e) => updateEditDraft({ provider: e.target.value })}
                                        className="h-8 w-full rounded-md border border-slate-300 bg-white px-2 text-xs font-medium text-slate-950 outline-none focus:border-cyan-600"
                                      >
                                        <option value="All">All</option>
                                        {allProviders.map((p) => <option key={p} value={p}>{p}</option>)}
                                      </select>
                                    </td>
                                    <td className="px-2 py-2">
                                      <select
                                        value={editDraft.type}
                                        onChange={(e) => updateEditDraft({ type: e.target.value })}
                                        className={classNames("h-8 w-full rounded-md border px-2 text-xs font-medium outline-none focus:border-cyan-600", typeSelectClass(editDraft.type))}
                                      >
                                        {fieldTypeOptions.map((t) => <option key={t} value={t}>{t}</option>)}
                                      </select>
                                    </td>
                                    <td className="px-2 py-2">
                                      <input
                                        value={editDraft.defaultValue}
                                        onChange={(e) => updateEditDraft({ defaultValue: e.target.value })}
                                        placeholder="Default value"
                                        className="h-8 w-full rounded-md border border-slate-300 bg-white px-2.5 text-xs font-medium text-slate-950 outline-none placeholder:text-slate-400 focus:border-cyan-600"
                                      />
                                    </td>
                                    <td className="px-2 py-2 text-center">
                                      <button
                                        type="button"
                                        onClick={() => updateEditDraft({ nullable: !editDraft.nullable })}
                                        className={classNames("h-8 w-20 rounded-md border text-xs font-semibold transition", editDraft.nullable ? "border-emerald-500 bg-emerald-500 text-white" : "border-amber-400 bg-amber-400 text-white")}
                                      >
                                        {editDraft.nullable ? "Yes" : "No"}
                                      </button>
                                    </td>
                                    <td className="px-2 py-2 text-center">
                                      {editDraft.type === "Boolean" ? (
                                        <span className="text-xs font-semibold text-slate-400">N/A</span>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() => updateEditDraft({ unique: !editDraft.unique })}
                                          className={classNames("h-8 w-20 rounded-md border text-xs font-semibold transition", editDraft.unique ? "border-violet-500 bg-violet-500 text-white" : "border-sky-400 bg-sky-400 text-white")}
                                        >
                                          {editDraft.unique ? "Yes" : "No"}
                                        </button>
                                      )}
                                    </td>
                                    <td className="px-2 py-2">
                                      <input
                                        value={editDraft.comment}
                                        onChange={(e) => updateEditDraft({ comment: e.target.value })}
                                        placeholder="Description"
                                        className="h-8 w-full rounded-md border border-slate-300 bg-white px-2.5 text-xs font-medium text-slate-950 outline-none placeholder:text-slate-400 focus:border-cyan-600"
                                      />
                                    </td>
                                    <td className="px-3 py-2 text-xs font-semibold text-slate-400">—</td>
                                    <td className="px-3 py-2 text-xs font-semibold text-slate-400">—</td>
                                    <td className="px-2 py-2">
                                      <div className="flex gap-1.5">
                                        <button
                                          type="button"
                                          onClick={saveTemplateField}
                                          disabled={!editDraft.name.trim() || isBusy}
                                          className="h-8 rounded-md border border-cyan-300 bg-white px-2.5 text-xs font-semibold text-cyan-700 transition hover:bg-cyan-50 disabled:cursor-not-allowed disabled:opacity-40"
                                        >
                                          {savingTemplateFieldId === template.id ? "Saving..." : "Save"}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={cancelTemplateEdit}
                                          className="h-8 rounded-md border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                                        >
                                          Cancel
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              }

                              return (
                                <tr key={template.id} className="align-middle">
                                  <td className="px-3 py-3 font-semibold text-slate-950">{template.name}</td>
                                  <td className="px-3 py-3">
                                    <span className={classNames("rounded-md px-2 py-1 text-xs font-semibold", template.provider === "All" ? "bg-slate-100 text-slate-600" : template.provider === projectProvider ? "bg-violet-100 text-violet-700" : "bg-amber-100 text-amber-700")}>
                                      {template.provider}
                                    </span>
                                  </td>
                                  <td className="px-3 py-3">
                                    <span className={classNames("rounded-md px-2 py-1 text-xs font-semibold", typeBadgeClass(template.type))}>
                                      {templateTypeLabel(template)}
                                    </span>
                                  </td>
                                  <td className="max-w-48 truncate px-3 py-3 font-mono text-xs text-slate-600">{template.defaultValue || "—"}</td>
                                  <td className="px-3 py-3">
                                    <span className={classNames("rounded-md px-2 py-1 text-xs font-semibold", template.nullable ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700")}>
                                      {template.nullable ? "Yes" : "No"}
                                    </span>
                                  </td>
                                  <td className="px-3 py-3">
                                    {template.type === "Boolean" ? (
                                      <span className="text-xs font-semibold text-slate-400">N/A</span>
                                    ) : (
                                      <span className={classNames("rounded-md px-2 py-1 text-xs font-semibold", template.unique ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700")}>
                                        {template.unique ? "Yes" : "No"}
                                      </span>
                                    )}
                                  </td>
                                  <td className="max-w-56 px-3 py-3 text-slate-600">
                                    <span className="line-clamp-2">{template.comment || "—"}</span>
                                  </td>
                                  <td className="px-3 py-3">
                                    <span className={classNames("rounded-md px-2 py-1 text-xs font-semibold", !selectedModelName ? "bg-slate-100 text-slate-500" : isUsed ? "bg-emerald-100 text-emerald-700" : "bg-cyan-100 text-cyan-700")}>
                                      {!selectedModelName ? "No table" : isUsed ? "Used" : "Ready"}
                                    </span>
                                  </td>
                                  <td className="px-3 py-3">
                                    <input
                                      value={templateOverrideNames[template.id] ?? template.name}
                                      onChange={(e) => setTemplateOverrideNames((cur) => ({ ...cur, [template.id]: e.target.value }))}
                                      className="h-8 w-48 rounded-md border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-950 outline-none transition focus:border-cyan-600"
                                      placeholder={template.name}
                                    />
                                  </td>
                                  <td className="px-3 py-3">
                                    <div className="flex flex-wrap gap-1.5">
                                      <button type="button" onClick={() => editTemplateField(template)} disabled={isBusy || !!editingTemplateId} className="h-8 rounded-md border border-cyan-300 bg-white px-2.5 text-xs font-semibold text-cyan-700 transition hover:bg-cyan-50 disabled:cursor-not-allowed disabled:opacity-40">Edit</button>
                                      <button type="button" onClick={() => deleteTemplateField(template)} disabled={isBusy || !!editingTemplateId} className="h-8 rounded-md border border-rose-200 bg-white px-2.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40">
                                        {deletingTemplateFieldId === template.id ? "Deleting..." : "Delete"}
                                      </button>
                                      <button type="button" onClick={addTemplateToTable(template)} disabled={!canAdd || isBusy} className="h-8 min-w-24 rounded-md border border-emerald-300 bg-white px-3 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400 disabled:hover:bg-white">
                                        {addingTemplateToTable === template.id ? "Adding..." : isUsed ? "Used" : selectedModelName ? "Add to Table" : "Select Table"}
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })
                          )}

                        </tbody>
                      </table>
                    </div>
                    {templatePageCount > 1 ? (
                      <div className="flex shrink-0 items-center justify-center gap-2 border-t border-slate-200 bg-slate-50 px-3 py-3">
                        <button type="button" onClick={() => setTemplatePage((p) => Math.max(1, p - 1))} disabled={templatePage === 1} className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 transition hover:border-cyan-200 hover:text-cyan-700 disabled:cursor-not-allowed disabled:opacity-50">
                          <IconChevronLeft size={15} stroke={2} />
                        </button>
                        <span className="text-sm font-semibold text-slate-600">{templatePage} / {templatePageCount}</span>
                        <button type="button" onClick={() => setTemplatePage((p) => Math.min(templatePageCount, p + 1))} disabled={templatePage === templatePageCount} className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 transition hover:border-cyan-200 hover:text-cyan-700 disabled:cursor-not-allowed disabled:opacity-50">
                          <IconChevronRight size={15} stroke={2} />
                        </button>
                      </div>
                    ) : null}
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
