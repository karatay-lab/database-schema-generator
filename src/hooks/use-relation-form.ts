"use client";

import { useEffect, useRef, useState } from "react";
import { useRelationMutations } from "@/queries/relations";
import { useFieldMutations } from "@/queries/fields";
import { useProjectInfo } from "@/app/views/shared/project-info-context";
import type { PrismaModel, PrismaRelation } from "@/lib/schema-store";
import type { RelationDraft } from "@/types/relation";
import { emptyRelationDraft, csvToList, listToCsv, deriveBackReferenceName } from "@/constants/relations";

type UseRelationFormParams = {
  selectedModelName: string;
  selectedModelKey: string;
  models: PrismaModel[];
};

export function useRelationForm({
  selectedModelName, selectedModelKey, models,
}: UseRelationFormParams) {
  const { projectName, version } = useProjectInfo();
  const lastEditedKeyRef = useRef("");

  const [draft, setDraft] = useState<RelationDraft>(emptyRelationDraft);
  const [editingRelationKey, setEditingRelationKey] = useState("");
  const [isRelationFormOpen, setIsRelationFormOpen] = useState(false);
  const [modalTableSearch, setModalTableSearch] = useState("");
  const [modalTablePage, setModalTablePage] = useState(1);
  const [fkFieldType, setFkFieldType] = useState("String");
  const [fkFieldDbName, setFkFieldDbName] = useState("");
  const [deletingRelationKey, setDeletingRelationKey] = useState("");
  const [error, setError] = useState("");

  // ── Mutations ─────────────────────────────────────────────────────────────

  const { create: createFkFieldMutation } = useFieldMutations(projectName, version, selectedModelName, selectedModelKey);
  const { invalidate: invalidateRelations, create: createRelationMutation, update: updateRelationMutation, delete: deleteRelationMutation } =
    useRelationMutations(projectName, version, selectedModelName, selectedModelKey);

  const savingRelation = createFkFieldMutation.isPending || createRelationMutation.isPending || updateRelationMutation.isPending;

  // ── Effects ───────────────────────────────────────────────────────────────

  useEffect(() => {
    setDraft({ ...emptyRelationDraft });
    setEditingRelationKey("");
    setError("");
  }, [selectedModelName]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const updateDraft = (patch: Partial<RelationDraft>) => {
    setDraft((cur) => {
      const next = { ...cur, ...patch };
      if (patch.targetModel !== undefined) {
        const tm = models.find((m) => m.name === patch.targetModel);
        next.references = tm?.pkName || "id";
      }
      if (patch.name !== undefined || patch.targetModel !== undefined) {
        next.backReferenceName = deriveBackReferenceName(selectedModelName, next.name);
      }
      if (patch.name !== undefined) next.fields = patch.name ? `${patch.name}Id` : "";
      if (patch.nullable === false) {
        if (next.onDelete === "SetNull") next.onDelete = "NoAction";
        if (next.onUpdate === "SetNull") next.onUpdate = "NoAction";
      }
      return next;
    });
    setError("");
  };

  const resetDraft = () => {
    const scrollKey = lastEditedKeyRef.current;
    setDraft({ ...emptyRelationDraft });
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
      name: relation.name, targetModel: relation.targetModel,
      backReferenceName: relation.backReferenceName || deriveBackReferenceName(selectedModelName, relation.name),
      cardinality: relation.kind === "one-to-one" ? "one-to-one" : "one-to-many",
      fields: listToCsv(relation.fields), references: listToCsv(relation.references),
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
      projectName, version, modelKey: selectedModelKey, modelName: selectedModelName,
      name: draft.name, targetModel: draft.targetModel, backReferenceName: draft.backReferenceName,
      fields: csvToList(draft.fields), references: csvToList(draft.references),
      onDelete: draft.onDelete, onUpdate: draft.onUpdate,
      nullable: draft.nullable, isArray: false,
      backReferenceIsArray: draft.cardinality === "one-to-many",
    };
    const callbacks = { onSuccess: () => { void invalidateRelations(); resetDraft(); }, onError: (err: { message: string }) => setError(err.message) };
    if (editingRelationKey) {
      updateRelationMutation.mutate({ ...payload, relationKey: editingRelationKey }, callbacks);
    } else {
      createFkFieldMutation.mutate(
        { projectName, version, modelKey: selectedModelKey, modelName: selectedModelName, name: draft.fields.trim(), type: fkFieldType, nullable: draft.nullable, unique: false, defaultValue: "", comment: "" },
        { onSuccess: () => createRelationMutation.mutate(payload, callbacks), onError: (err) => setError(err.message) },
      );
    }
  };

  const deleteRelation = (relation: PrismaRelation) => {
    setDeletingRelationKey(relation.key);
    setError("");
    deleteRelationMutation.mutate(
      { projectName, version, modelKey: selectedModelKey, modelName: selectedModelName, relationKey: relation.key },
      { onSuccess: () => { void invalidateRelations(); setDeletingRelationKey(""); }, onError: (err) => { setError(err.message); setDeletingRelationKey(""); } },
    );
    if (editingRelationKey === relation.key) resetDraft();
  };

  return {
    draft, editingRelationKey, isRelationFormOpen, modalTableSearch, modalTablePage,
    fkFieldType, fkFieldDbName, deletingRelationKey, error, savingRelation,
    isDeleting: deleteRelationMutation.isPending,
    setFkFieldType, setFkFieldDbName, setModalTableSearch, setModalTablePage,
    setIsRelationFormOpen, setError,
    updateDraft, resetDraft, editRelation, saveRelation, deleteRelation,
  };
}
