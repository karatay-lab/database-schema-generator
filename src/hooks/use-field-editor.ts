"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { defaultFieldTypes } from "@/constants/schema";
import type { FieldDiff } from "@/lib/version-diff/detect-changes";
import type { PrismaField, PrismaFieldInput } from "@/lib/schema-store";

const FIELDS_PER_PAGE = 12;

const emptyFieldInput: PrismaFieldInput = {
  name: "", type: "String", nullable: false, unique: false, defaultValue: "", comment: "",
};

function fieldToInput(field: PrismaField): PrismaFieldInput {
  return {
    name: field.name, dbName: field.dbName, type: field.type, nullable: field.nullable,
    unique: field.unique, defaultValue: field.defaultValue, comment: field.comment,
    nativeAttribute: field.nativeAttribute, updatedAtAttribute: field.updatedAtAttribute,
    isId: field.isId,
  };
}

const displayTypeToInputType: Record<string, string> = {
  String: "String", Int: "Int", Boolean: "Boolean", Float: "Float",
  BigInt: "BigInt", Decimal: "Decimal", DateTime: "DateTime",
  Uuid: "String", Json: "Json", Bytes: "Bytes",
};

export function useFieldEditor({
  projectName,
  version,
  selectedModelName,
  selectedModelKey,
  fields,
  enumTypes,
  scalarTypes,
}: {
  projectName: string;
  version: string;
  selectedModelName: string;
  selectedModelKey: string;
  fields: PrismaField[];
  enumTypes: string[];
  scalarTypes: string[];
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [fieldDrafts, setFieldDrafts] = useState<Record<string, PrismaFieldInput>>({});
  const [newFieldDrafts, setNewFieldDrafts] = useState<Array<{ id: string; input: PrismaFieldInput }>>([]);
  const [savingNewCardId, setSavingNewCardId] = useState("");
  const savingNewCardIdRef = useRef("");
  const [savingFieldKey, setSavingFieldKey] = useState("");
  const [deletingFieldKey, setDeletingFieldKey] = useState("");
  const [error, setError] = useState("");
  const [fieldTypeFilter, setFieldTypeFilter] = useState("All");
  const [fieldPage, setFieldPage] = useState(1);

  const invalidateFields = () =>
    queryClient.invalidateQueries({
      queryKey: trpc.fields.list.queryOptions({
        projectName, version, modelName: selectedModelName, modelKey: selectedModelKey,
      }).queryKey,
    });

  // Sync drafts when server fields change
  useEffect(() => {
    setFieldDrafts(
      Object.fromEntries(fields.filter((f) => f.isEditable).map((f) => [f.key, fieldToInput(f)])),
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields]);

  // Reset page/filter/new-cards when model changes
  useEffect(() => {
    setFieldPage(1);
    setFieldTypeFilter("All");
    setNewFieldDrafts([]);
  }, [selectedModelName]);

  useEffect(() => { setFieldPage(1); }, [fieldTypeFilter, selectedModelName]);

  const createFieldMutation = useMutation({
    ...trpc.fields.create.mutationOptions(),
    onSuccess: () => {
      void invalidateFields();
      const id = savingNewCardIdRef.current;
      if (id) { setNewFieldDrafts((prev) => prev.filter((d) => d.id !== id)); savingNewCardIdRef.current = ""; }
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

  // ── derived ────────────────────────────────────────────────────────────────

  const fieldTypeOptions = useMemo(
    () => Array.from(new Set([...defaultFieldTypes, ...scalarTypes, ...enumTypes])),
    [enumTypes, scalarTypes],
  );
  const scalarTypeOptions = useMemo(
    () => Array.from(new Set([...defaultFieldTypes, ...scalarTypes])),
    [scalarTypes],
  );
  const editableFields  = useMemo(() => fields.filter((f) => f.isEditable && !f.isId), [fields]);
  const preservedFieldCount = fields.length - editableFields.length;
  const fieldFilterOptions  = useMemo(() => Array.from(new Set(editableFields.map((f) => f.type))).sort(), [editableFields]);
  const filteredFields  = useMemo(
    () => fieldTypeFilter === "All" ? editableFields : editableFields.filter((f) => f.type === fieldTypeFilter),
    [editableFields, fieldTypeFilter],
  );
  const fieldPageCount  = Math.max(1, Math.ceil(filteredFields.length / FIELDS_PER_PAGE));
  const paginatedFields = filteredFields.slice((fieldPage - 1) * FIELDS_PER_PAGE, fieldPage * FIELDS_PER_PAGE);

  // Clamp page when count shrinks
  useEffect(() => { setFieldPage((p) => Math.min(p, fieldPageCount)); }, [fieldPageCount]);

  // ── handlers ───────────────────────────────────────────────────────────────

  const updateDraft = (fieldKey: string, patch: Partial<PrismaFieldInput>) => {
    setFieldDrafts((d) => ({
      ...d,
      [fieldKey]: {
        ...d[fieldKey],
        ...patch,
        unique: patch.type === "Boolean" ? false : patch.unique ?? d[fieldKey]?.unique ?? false,
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
      projectName, version, modelKey: selectedModelKey, modelName: selectedModelName,
      fieldKey: field.key, oldFieldName: field.name, ...draft,
    });
  };

  const deleteField = (field: PrismaField) => {
    if (!selectedModelName) return;
    setDeletingFieldKey(field.key);
    setError("");
    deleteFieldMutation.mutate({
      projectName, version, modelKey: selectedModelKey, modelName: selectedModelName,
      fieldKey: field.key, fieldName: field.name,
    });
  };

  const restoreRemovedField = (fd: FieldDiff) => {
    if (!selectedModelName) return;
    const type = displayTypeToInputType[fd.from] ?? "String";
    setError("");
    createFieldMutation.mutate({
      projectName, version, modelKey: selectedModelKey, modelName: selectedModelName,
      name: fd.fieldName, type, nullable: true, unique: false, defaultValue: "", comment: "",
    });
  };

  const addNewFieldCard = () =>
    setNewFieldDrafts((prev) => [...prev, { id: crypto.randomUUID(), input: { ...emptyFieldInput } }]);

  const updateNewFieldDraft = (draftId: string, patch: Partial<PrismaFieldInput>) => {
    setNewFieldDrafts((prev) =>
      prev.map((d) =>
        d.id === draftId
          ? { ...d, input: { ...d.input, ...patch, unique: patch.type === "Boolean" ? false : patch.unique ?? d.input.unique } }
          : d,
      ),
    );
    setError("");
  };

  const removeNewFieldDraft = (draftId: string) =>
    setNewFieldDrafts((prev) => prev.filter((d) => d.id !== draftId));

  const saveNewFieldDraft = (draftId: string) => {
    const draft = newFieldDrafts.find((d) => d.id === draftId);
    if (!draft || !selectedModelName) return;
    setSavingNewCardId(draftId);
    savingNewCardIdRef.current = draftId;
    setError("");
    createFieldMutation.mutate({
      projectName, version, modelKey: selectedModelKey, modelName: selectedModelName, ...draft.input,
    });
  };

  return {
    // state
    fieldDrafts, newFieldDrafts, savingNewCardId, savingFieldKey, deletingFieldKey, error,
    fieldTypeFilter, setFieldTypeFilter, fieldPage, setFieldPage,
    // derived
    fieldTypeOptions, scalarTypeOptions, editableFields, preservedFieldCount,
    filteredFields, fieldFilterOptions, fieldPageCount, paginatedFields,
    // mutation state
    isCreatingField: createFieldMutation.isPending,
    // handlers
    updateDraft, saveField, deleteField, restoreRemovedField,
    addNewFieldCard, updateNewFieldDraft, removeNewFieldDraft, saveNewFieldDraft,
    // expose for RemovedFieldsSection
    invalidateFields,
  };
}
