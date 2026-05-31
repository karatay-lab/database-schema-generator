"use client";

import { useEffect, useMemo, useState } from "react";
import { useFieldTemplatesQuery, useFieldTemplateMutations } from "@/queries/field-templates";
import { useFieldMutations } from "@/queries/fields";
import { useProjectInfo } from "@/app/views/shared/project-info-context";
import type { PrismaField } from "@/lib/schema-store";
import type { FieldTemplate, FieldTemplateInput } from "@/lib/field-template-store";

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
    return 'dbgenerated("now()")';
  }
  return "";
}

function templateToInput(template: FieldTemplate): FieldTemplateInput {
  return {
    name: template.name, type: template.type, nullable: template.nullable,
    unique: template.unique, defaultValue: template.defaultValue, comment: template.comment,
    nativeAttribute: template.nativeAttribute, updatedAtAttribute: template.updatedAtAttribute,
    isId: template.isId, provider: template.provider ?? "All",
  };
}

type UseFieldTemplatesParams = {
  selectedModelName: string;
  selectedModelKey: string;
  fields: PrismaField[];
  invalidateFields: () => void;
};

export function useFieldTemplates({
  selectedModelName, selectedModelKey, fields, invalidateFields,
}: UseFieldTemplatesParams) {
  const { projectName, version, provider: projectProvider } = useProjectInfo();
  const templatesPerPage = 15;

  // ── State ─────────────────────────────────────────────────────────────────

  const [templateField, setTemplateField] = useState<FieldTemplateInput>(() => makeEmptyTemplateInput(projectProvider || "All"));
  const [editDraft, setEditDraft] = useState<FieldTemplateInput | null>(null);
  const [templateProviderFilter, setTemplateProviderFilter] = useState("relevant");
  const [templateTypeFilter, setTemplateTypeFilter] = useState("All");
  const [templatePage, setTemplatePage] = useState(1);
  const [templateOverrideNames, setTemplateOverrideNames] = useState<Record<string, string>>({});
  const [editingTemplateId, setEditingTemplateId] = useState("");
  const [addingTemplateToTable, setAddingTemplateToTable] = useState("");
  const [savingTemplateFieldId, setSavingTemplateFieldId] = useState("");
  const [deletingTemplateFieldId, setDeletingTemplateFieldId] = useState("");
  const [templateError, setTemplateError] = useState("");

  // ── Query ─────────────────────────────────────────────────────────────────

  const templatesQuery = useFieldTemplatesQuery();
  const templates: FieldTemplate[] = (templatesQuery.data ?? []) as FieldTemplate[];
  const { invalidate: invalidateTemplates, create: createTemplateMutation_, update: updateTemplateMutation_, delete: deleteTemplateMutation_ } =
    useFieldTemplateMutations();
  const { create: addTemplateToTableMutation_ } = useFieldMutations(projectName, version, selectedModelName, selectedModelKey);

  // Sync override names when templates change
  useEffect(() => {
    setTemplateOverrideNames((cur) =>
      Object.fromEntries(templates.map((t) => [t.id, cur[t.id] || t.name])),
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templatesQuery.data]);

  useEffect(() => { setTemplatePage(1); }, [templateTypeFilter]);
  useEffect(() => { setTemplatePage((p) => Math.min(p, templatePageCount)); }, []);

  const createTemplateMutation = createTemplateMutation_;
  const updateTemplateMutation = updateTemplateMutation_;
  const deleteTemplateMutation = deleteTemplateMutation_;
  const addTemplateToTableMutation = addTemplateToTableMutation_;

  // ── Derived ───────────────────────────────────────────────────────────────

  const usedTemplateNames = useMemo(() => new Set(fields.map((f) => f.name)), [fields]);

  const filteredTemplates = useMemo(() => {
    return templates.filter((t) => {
      const typeMatch = templateTypeFilter === "All" || t.type === templateTypeFilter;
      const providerMatch = templateProviderFilter === "all" || t.provider === "All" || t.provider === projectProvider;
      return typeMatch && providerMatch;
    });
  }, [templateTypeFilter, templateProviderFilter, templates, projectProvider]);

  const templateTypeOptions = useMemo(
    () => Array.from(new Set(templates.map((t) => t.type))).sort(),
    [templates],
  );

  const templatePageCount = Math.max(1, Math.ceil(filteredTemplates.length / templatesPerPage));
  const paginatedTemplates = filteredTemplates.slice(
    (templatePage - 1) * templatesPerPage,
    templatePage * templatesPerPage,
  );

  const templateDuplicateSuggestion = (() => {
    const name = templateField.name.trim();
    if (!name) return "";
    const existing = new Set(templates.filter((t) => t.id !== editingTemplateId).map((t) => t.name));
    if (!existing.has(name)) return "";
    let i = 2;
    while (existing.has(`${name}${i}`)) i++;
    return `${name}${i}`;
  })();

  // ── Handlers ──────────────────────────────────────────────────────────────

  const updateTemplateField = (patch: Partial<FieldTemplateInput>) => {
    setTemplateField((f) => {
      const next = { ...f, ...patch, unique: patch.type === "Boolean" ? false : patch.unique ?? f.unique };
      if (patch.type !== undefined && patch.type !== f.type) next.defaultValue = suggestDefault(patch.type, next.provider);
      else if (patch.provider !== undefined && patch.provider !== f.provider) {
        const old = suggestDefault(f.type, f.provider);
        if (!f.defaultValue.trim() || f.defaultValue === old) next.defaultValue = suggestDefault(f.type, patch.provider);
      }
      return next;
    });
    setTemplateError("");
  };

  const createTemplateField = () => {
    if (templateDuplicateSuggestion) { setTemplateError("A template field with this name already exists."); return; }
    setTemplateError("");
    createTemplateMutation.mutate(templateField, {
      onSuccess: () => { void invalidateTemplates(); setTemplateField(makeEmptyTemplateInput(projectProvider || "All")); setEditingTemplateId(""); setSavingTemplateFieldId(""); },
      onError: (err) => { setTemplateError(err.message); setSavingTemplateFieldId(""); },
    });
  };

  const updateEditDraft = (patch: Partial<FieldTemplateInput>) => {
    setEditDraft((d) => {
      if (!d) return d;
      const next = { ...d, ...patch, unique: patch.type === "Boolean" ? false : patch.unique ?? d.unique };
      if (patch.type !== undefined && patch.type !== d.type) next.defaultValue = suggestDefault(patch.type, next.provider);
      return next;
    });
    setTemplateError("");
  };

  const editTemplateField = (template: FieldTemplate) => {
    setEditingTemplateId(template.id);
    setEditDraft(templateToInput(template));
    setTemplateError("");
  };

  const cancelTemplateEdit = () => { setEditingTemplateId(""); setEditDraft(null); setTemplateError(""); };

  const saveTemplateField = () => {
    if (!editingTemplateId || !editDraft) return;
    setSavingTemplateFieldId(editingTemplateId);
    setTemplateError("");
    updateTemplateMutation.mutate({ id: editingTemplateId, ...editDraft }, {
      onSuccess: () => { void invalidateTemplates(); setEditingTemplateId(""); setEditDraft(null); setSavingTemplateFieldId(""); },
      onError: (err) => { setTemplateError(err.message); setSavingTemplateFieldId(""); },
    });
  };

  const deleteTemplateField = (template: FieldTemplate) => {
    setDeletingTemplateFieldId(template.id);
    setTemplateError("");
    deleteTemplateMutation.mutate({ id: template.id }, {
      onSuccess: () => { void invalidateTemplates(); setDeletingTemplateFieldId(""); },
      onError: (err) => { setTemplateError(err.message); setDeletingTemplateFieldId(""); },
    });
    if (editingTemplateId === template.id) { setEditingTemplateId(""); setEditDraft(null); }
  };

  const addTemplateToTable = (template: FieldTemplate) => () => {
    const overrideName = (templateOverrideNames[template.id] || template.name).trim();
    if (!selectedModelName || usedTemplateNames.has(overrideName)) return;
    setAddingTemplateToTable(template.id);
    addTemplateToTableMutation.mutate(
      { projectName, version, modelKey: selectedModelKey, modelName: selectedModelName, name: overrideName, type: template.type, nullable: template.nullable, unique: template.type === "Boolean" ? false : template.unique, defaultValue: template.defaultValue, comment: template.comment, nativeAttribute: template.nativeAttribute, updatedAtAttribute: template.updatedAtAttribute, isId: template.isId },
      { onSuccess: () => { void invalidateFields(); setAddingTemplateToTable(""); }, onError: () => setAddingTemplateToTable("") },
    );
  };

  return {
    // state
    templateField, editDraft, templateProviderFilter, templateTypeFilter, templatePage,
    templateOverrideNames, editingTemplateId, addingTemplateToTable,
    savingTemplateFieldId, deletingTemplateFieldId, templateError,
    // query
    templates, isLoading: templatesQuery.isLoading,
    // derived
    filteredTemplates, templateTypeOptions, templatePageCount, paginatedTemplates,
    usedTemplateNames, templateDuplicateSuggestion,
    // mutations pending
    isCreating: createTemplateMutation.isPending,
    // handlers
    updateTemplateField, createTemplateField, updateEditDraft,
    editTemplateField, cancelTemplateEdit, saveTemplateField, deleteTemplateField,
    addTemplateToTable,
    setTemplateProviderFilter, setTemplateTypeFilter, setTemplatePage, setTemplateOverrideNames,
  };
}
