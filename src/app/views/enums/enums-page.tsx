"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { IconPencil, IconTrash, IconCheck, IconX, IconPlus, IconGripVertical } from "@tabler/icons-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useTRPC } from "@/trpc/client";
import { useProjectInfo } from "../shared/project-info-context";
import { useVersionDiff, useVersionDiffLookup } from "../shared/use-version-diff";
import { useSchemaWarnings } from "../shared/use-schema-warnings";
import { VersionDiffBadge, ApproveWarningButton } from "../shared/version-diff-badge";

type EnumValue = { valueId: string; name: string };
type CanonicalEnum = { enumId: string; name: string; values: EnumValue[] };

const identifierPattern = /^[a-zA-Z][a-zA-Z0-9_]*$/;
const ENUM_NAME_MAX = 63;   // PostgreSQL NAMEDATALEN − 1 (also a sane cap for MySQL/Prisma)
const ENUM_VALUE_MAX = 63;  // Same cap; MySQL allows 255 but Postgres limits to 63 bytes

function validateEnumName(value: string): string | null {
  const v = value.trim();
  if (!v) return "Enum name is required.";
  if (!identifierPattern.test(v))
    return "Must start with a letter and contain only letters, numbers, or underscores. No spaces, hyphens, or special characters.";
  if (v.length > ENUM_NAME_MAX)
    return `Enum name must be ${ENUM_NAME_MAX} characters or fewer (PostgreSQL limit).`;
  return null;
}

function validateEnumValue(value: string): string | null {
  const v = value.trim();
  if (!v) return "Value is required.";
  if (!identifierPattern.test(v))
    return "Must start with a letter and contain only letters, numbers, or underscores. No spaces, hyphens, or special characters.";
  if (v.length > ENUM_VALUE_MAX)
    return `Value must be ${ENUM_VALUE_MAX} characters or fewer (PostgreSQL limit).`;
  return null;
}

function InlineRenameValue({
  value,
  onSave,
  onCancel,
}: {
  value: EnumValue;
  onSave: (valueId: string, newName: string) => void;
  onCancel: () => void;
}) {
  const [input, setInput] = useState(value.name);
  const [error, setError] = useState("");

  const save = () => {
    const err = validateEnumValue(input);
    if (err) { setError(err); return; }
    onSave(value.valueId, input.trim());
  };

  return (
    <div className="flex items-center gap-1.5">
      <input
        autoFocus
        value={input}
        onChange={(e) => { setInput(e.target.value); setError(""); }}
        onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") onCancel(); }}
        className="h-7 min-w-0 flex-1 rounded border border-indigo-400 bg-white px-2 text-xs font-semibold text-slate-950 outline-none"
      />
      <button
        type="button"
        onClick={save}
        className="flex h-7 w-7 items-center justify-center rounded border border-indigo-300 bg-white text-indigo-700 transition hover:bg-indigo-50"
        aria-label="Save"
      >
        <IconCheck size={12} stroke={2.5} />
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="flex h-7 w-7 items-center justify-center rounded border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50"
        aria-label="Cancel"
      >
        <IconX size={12} stroke={2.5} />
      </button>
      {error && <span className="text-xs font-semibold text-rose-600">{error}</span>}
    </div>
  );
}

function SortableValueRow({
  value,
  isEditing,
  isDeleting,
  onEdit,
  onDelete,
  onSaveRename,
  onCancelRename,
}: {
  value: EnumValue;
  isEditing: boolean;
  isDeleting: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onSaveRename: (valueId: string, newName: string) => void;
  onCancelRename: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: value.valueId });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  if (isEditing) {
    return (
      <div ref={setNodeRef} style={style}>
        <InlineRenameValue value={value} onSave={onSaveRename} onCancel={onCancelRename} />
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2"
    >
      <div className="flex items-center gap-2 min-w-0">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="cursor-grab touch-none text-slate-300 transition hover:text-slate-500 active:cursor-grabbing"
          aria-label="Drag to reorder"
          tabIndex={-1}
        >
          <IconGripVertical size={14} stroke={2} />
        </button>
        <span className="font-mono text-sm font-semibold text-slate-900">{value.name}</span>
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onEdit}
          className="flex h-7 w-7 items-center justify-center rounded border border-indigo-200 bg-white text-indigo-600 transition hover:bg-indigo-50"
          aria-label={`Rename ${value.name}`}
        >
          <IconPencil size={12} stroke={2} />
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={isDeleting}
          className="flex h-7 w-7 items-center justify-center rounded border border-rose-200 bg-white text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label={`Delete ${value.name}`}
        >
          <IconTrash size={12} stroke={2} />
        </button>
      </div>
    </div>
  );
}

function EnumEditPanel({
  enumEntry,
  projectName,
  version,
  onDone,
}: {
  enumEntry: CanonicalEnum;
  projectName: string;
  version: string;
  onDone: () => void;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [renameName, setRenameName] = useState(enumEntry.name);
  const [renameError, setRenameError] = useState("");
  const [newValue, setNewValue] = useState("");
  const [addError, setAddError] = useState("");
  const [editingValue, setEditingValue] = useState<EnumValue | null>(null);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: trpc.enums.list.queryOptions({ projectName, version }).queryKey });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const renameMutation = useMutation({
    ...trpc.enums.rename.mutationOptions(),
    onSuccess: (data) => {
      const updated = data?.find((e) => e.name === renameName.trim());
      if (updated) onDone();
    },
    onError: (err) => setRenameError(err.message),
  });

  const addValueMutation = useMutation({
    ...trpc.enums.addValue.mutationOptions(),
    onSuccess: () => { void invalidate(); setNewValue(""); setAddError(""); },
    onError: (err) => setAddError(err.message),
  });

  const renameValueMutation = useMutation({
    ...trpc.enums.renameValue.mutationOptions(),
    onSuccess: () => { void invalidate(); setEditingValue(null); },
  });

  const deleteValueMutation = useMutation({
    ...trpc.enums.deleteValue.mutationOptions(),
    onSuccess: () => void invalidate(),
  });

  const reorderValuesMutation = useMutation({
    ...trpc.enums.reorderValues.mutationOptions(),
    onSuccess: () => void invalidate(),
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = enumEntry.values.findIndex((v) => v.valueId === active.id);
    const newIndex = enumEntry.values.findIndex((v) => v.valueId === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(enumEntry.values, oldIndex, newIndex);
    reorderValuesMutation.mutate({
      projectName, version,
      enumName: currentEnumName,
      valueIds: reordered.map((v) => v.valueId),
    });
  };

  const saveRename = () => {
    const err = validateEnumName(renameName);
    if (err) { setRenameError(err); return; }
    setRenameError("");
    renameMutation.mutate({ projectName, version, oldName: enumEntry.name, newName: renameName.trim() });
    onDone();
  };

  const submitAddValue = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = newValue.trim();
    if (enumEntry.values.some((v) => v.name === trimmed)) {
      setAddError(`"${trimmed}" already exists in this enum.`);
      return;
    }
    const err = validateEnumValue(trimmed);
    if (err) { setAddError(err); return; }
    setAddError("");
    addValueMutation.mutate({ projectName, version, enumName: enumEntry.name, value: trimmed });
  };

  const currentEnumName = renameName.trim() || enumEntry.name;

  return (
    <div className="rounded-lg border border-indigo-200 bg-indigo-50/40 p-5">
      <div className="mb-5 flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-indigo-700">
          Edit Enum
        </p>
        <button
          type="button"
          onClick={onDone}
          className="flex h-8 w-8 items-center justify-center rounded-md border border-emerald-300 bg-white text-emerald-600 transition hover:bg-emerald-50"
          aria-label="Done"
        >
          <IconCheck size={16} stroke={2.5} />
        </button>
      </div>

      {/* Rename */}
      <div>
        <label htmlFor="edit-enum-name" className="block text-sm font-semibold text-slate-700">
          Enum name
        </label>
        <div className="mt-2 flex gap-2">
          <input
            id="edit-enum-name"
            value={renameName}
            onChange={(e) => { setRenameName(e.target.value); setRenameError(""); }}
            onKeyDown={(e) => { if (e.key === "Enter") saveRename(); }}
            className="h-10 flex-1 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-950 outline-none transition focus:border-indigo-600"
          />
          <button
            type="button"
            onClick={saveRename}
            disabled={renameMutation.isPending || renameName.trim() === enumEntry.name}
            className="h-10 rounded-md border border-indigo-300 bg-white px-4 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {renameMutation.isPending ? "Saving…" : "Rename"}
          </button>
        </div>
        {renameError ? <p className="mt-1.5 text-xs font-semibold text-rose-600">{renameError}</p> : null}
        <p className="mt-1.5 text-xs text-slate-500">
          Renaming updates all fields that use this enum as their type.
        </p>
      </div>

      {/* Values */}
      <div className="mt-6">
        <p className="text-sm font-semibold text-slate-700">
          Values
          {enumEntry.values.length > 0 && (
            <span className="ml-2 rounded-md border border-indigo-200 bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700">
              {enumEntry.values.length}
            </span>
          )}
        </p>

        {enumEntry.values.length === 0 ? (
          <div className="mt-3 rounded-lg border border-dashed border-indigo-200 bg-white p-4 text-center text-sm text-slate-500">
            No values yet. Add your first value below.
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={enumEntry.values.map((v) => v.valueId)} strategy={verticalListSortingStrategy}>
              <div className="mt-3 space-y-1.5">
                {enumEntry.values.map((v) => (
                  <SortableValueRow
                    key={v.valueId}
                    value={v}
                    isEditing={editingValue?.valueId === v.valueId}
                    isDeleting={deleteValueMutation.isPending}
                    onEdit={() => setEditingValue(v)}
                    onDelete={() => deleteValueMutation.mutate({ projectName, version, enumName: currentEnumName, valueId: v.valueId })}
                    onSaveRename={(valueId, newVal) =>
                      renameValueMutation.mutate({ projectName, version, enumName: currentEnumName, valueId, newValue: newVal })
                    }
                    onCancelRename={() => setEditingValue(null)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}

        {/* Add value */}
        <form onSubmit={submitAddValue} className="mt-3 flex gap-2">
          <input
            value={newValue}
            onChange={(e) => { setNewValue(e.target.value); setAddError(""); }}
            placeholder="PENDING"
            className="h-9 flex-1 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-950 outline-none transition placeholder:font-mono placeholder:text-slate-400 focus:border-indigo-600"
          />
          <button
            type="submit"
            disabled={addValueMutation.isPending || !newValue.trim()}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-indigo-600 px-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            <IconPlus size={14} stroke={2.5} />
            {addValueMutation.isPending ? "Adding…" : "Add"}
          </button>
        </form>
        {addError ? <p className="mt-1.5 text-xs font-semibold text-rose-600">{addError}</p> : null}
      </div>

    </div>
  );
}

export function EnumsPageContent() {
  const { projectName, version, versions, provider, hasProject, projectId } = useProjectInfo();
  const isSQLite = provider === "SQLite";
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const versionIdx = versions.indexOf(version);
  const previousVersion = versionIdx > 0 ? versions[versionIdx - 1]! : "";
  const { getWarning, approve } = useSchemaWarnings(projectId, previousVersion, version);

  const [enumName, setEnumName] = useState("");
  const [createError, setCreateError] = useState("");
  const [editingEnum, setEditingEnum] = useState<CanonicalEnum | null>(null);
  const [search, setSearch] = useState("");
  const [confirmDeleteName, setConfirmDeleteName] = useState("");

  const { data: versionDiff } = useVersionDiff(projectName, version);
  const { diffByEnumId } = useVersionDiffLookup(projectName, version);

  const listQuery = useQuery(
    trpc.enums.list.queryOptions(
      { projectName, version },
      { enabled: !!projectName && !!version },
    ),
  );
  const enums: CanonicalEnum[] = listQuery.data ?? [];

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: trpc.enums.list.queryOptions({ projectName, version }).queryKey });

  const createMutation = useMutation({
    ...trpc.enums.create.mutationOptions(),
    onSuccess: () => {
      void invalidate();
      setEnumName("");
      setCreateError("");
    },
    onError: (err) => setCreateError(err.message),
  });

  const deleteMutation = useMutation({
    ...trpc.enums.delete.mutationOptions(),
    onSuccess: () => { void invalidate(); setConfirmDeleteName(""); },
  });

  const submitCreate = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const err = validateEnumName(enumName);
    if (err) { setCreateError(err); return; }
    createMutation.mutate({ projectName, version, name: enumName.trim() });
  };

  // When the enum being edited is updated (e.g. value added), sync edit state
  const editingEnumLive = editingEnum
    ? (enums.find((e) => e.name === editingEnum.name) ?? editingEnum)
    : null;

  const filteredEnums = search
    ? enums.filter((e) => e.name.toLowerCase().includes(search.toLowerCase()))
    : enums;

  const removedEnumDiffs = versionDiff?.enumDiffs.filter((d) => d.changeKind === "removed") ?? [];

  if (!hasProject) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-8 text-center">
        <p className="text-slate-600">Select a project to manage enums.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {isSQLite && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
          <p className="text-sm font-semibold text-amber-800">SQLite does not support native enum types</p>
          <p className="mt-1 text-xs leading-5 text-amber-700">
            Prisma maps enum fields to plain <code className="rounded bg-amber-100 px-1 font-mono">String</code> columns on SQLite — the enum constraint is enforced at the Prisma Client layer only, not in the database.
            Enums defined here will appear in the schema but have no effect on the SQLite schema itself.
          </p>
        </div>
      )}
      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Main Window
              </p>
              <h3 className="mt-1 text-xl font-semibold text-slate-950">
                Enums workspace
              </h3>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-slate-500">
                {projectName}-{version}.prisma
              </span>
              <span className="rounded-md border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700">
                {enums.length} {enums.length === 1 ? "enum" : "enums"}
              </span>
            </div>
          </div>
        </div>

        <div className="grid gap-0 lg:grid-cols-[360px_minmax(0,1fr)]">
          {/* Left: Create form */}
          <form onSubmit={submitCreate} className="border-b border-slate-200 p-5 lg:border-b-0 lg:border-r">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              Add Enum
            </p>
            <p className="mt-1 text-sm text-slate-600">
              Define a custom enum type for use in model fields.
            </p>

            <label htmlFor="enum-name" className="mt-5 block text-sm font-semibold text-slate-700">
              Enum name
            </label>
            <input
              id="enum-name"
              value={enumName}
              onChange={(e) => { setEnumName(e.target.value); setCreateError(""); }}
              className="mt-2 h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-indigo-600"
              placeholder="OrderStatus"
            />
            <p className="mt-2 text-xs leading-5 text-slate-500">
              Use PascalCase. e.g.{" "}
              <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[11px] text-slate-700">
                OrderStatus
              </code>
              ,{" "}
              <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[11px] text-slate-700">
                UserRole
              </code>
            </p>

            {createError ? (
              <p className="mt-3 text-sm font-semibold text-rose-600">{createError}</p>
            ) : null}

            <button
              type="submit"
              disabled={createMutation.isPending}
              className="mt-5 h-10 w-full rounded-md bg-indigo-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {createMutation.isPending ? "Creating…" : "Add Enum"}
            </button>

            <div className="mt-5 rounded-md border border-slate-200 bg-slate-50 p-4 text-xs leading-5 text-slate-500 space-y-2">
              <p className="font-semibold text-slate-700">Naming rules</p>
              <ul className="space-y-1 list-none">
                <li>
                  <span className="font-semibold text-slate-600">Allowed:</span>{" "}
                  letters <code className="rounded bg-white px-1 font-mono text-slate-700">a–z A–Z</code>,
                  digits <code className="rounded bg-white px-1 font-mono text-slate-700">0–9</code>,
                  underscores <code className="rounded bg-white px-1 font-mono text-slate-700">_</code>
                </li>
                <li>
                  <span className="font-semibold text-slate-600">Must start with</span> a letter — not a digit or underscore
                </li>
                <li>
                  <span className="font-semibold text-slate-600">Not allowed:</span>{" "}
                  spaces, hyphens <code className="rounded bg-white px-1 font-mono text-slate-700">-</code>,
                  dots <code className="rounded bg-white px-1 font-mono text-slate-700">.</code>,
                  quotes, or any other special characters
                </li>
                <li>
                  <span className="font-semibold text-slate-600">Max 63 characters</span> — PostgreSQL NAMEDATALEN limit
                </li>
              </ul>
              <p className="pt-1 border-t border-slate-200">
                Convention: enum type names in <code className="rounded bg-white px-1 font-mono text-slate-700">PascalCase</code>, values in{" "}
                <code className="rounded bg-white px-1 font-mono text-slate-700">SCREAMING_SNAKE_CASE</code>
              </p>
            </div>
          </form>

          {/* Right: List or Edit */}
          <div className="p-5">
            {listQuery.isLoading ? (
              <div className="py-8 text-center text-sm text-slate-500">Loading…</div>
            ) : editingEnumLive ? (
              <EnumEditPanel
                enumEntry={editingEnumLive}
                projectName={projectName}
                version={version}
                onDone={() => setEditingEnum(null)}
              />
            ) : enums.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
                No enums yet. Add your first enum using the form.
              </div>
            ) : (
              <>
                <div className="mb-4">
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search enums…"
                    className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-indigo-600"
                  />
                </div>

                {removedEnumDiffs.length > 0 && (
                  <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-red-800">
                        {removedEnumDiffs.length} enum{removedEnumDiffs.length > 1 ? "s" : ""} removed since {versionDiff?.fromVersion}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {removedEnumDiffs.map((d) => (
                          <ApproveWarningButton
                            key={d.enumId}
                            warning={getWarning("enum", d.enumId, d.changeKind)}
                            onApprove={approve}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {removedEnumDiffs.map((d) => (
                        <span key={d.enumId} className="rounded border border-red-300 bg-white px-2 py-0.5 font-mono text-[11px] font-semibold text-red-700 line-through">
                          {d.enumName}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {filteredEnums.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
                    No enums match your search.
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {filteredEnums.map((enumEntry) => {
                      const enumDiff = diffByEnumId.get(enumEntry.enumId);
                      const addedValueNames = new Set(enumDiff?.addedValues ?? []);
                      const removedValueNames = enumDiff?.removedValues ?? [];
                      const cardBorder = enumDiff
                        ? enumDiff.severity === "breaking"
                          ? "border-red-300"
                          : enumDiff.severity === "warning"
                            ? "border-amber-300"
                            : "border-sky-300"
                        : "border-slate-200";
                      return (
                      <div
                        key={enumEntry.name}
                        className={`rounded-lg border bg-white p-4 transition hover:border-indigo-200 ${cardBorder}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <span className="block truncate font-semibold text-slate-950">
                              {enumEntry.name}
                            </span>
                            <div className="mt-1 flex flex-wrap items-center gap-1">
                              <span className="inline-flex items-center rounded border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700">
                                {enumEntry.values.length}{" "}
                                {enumEntry.values.length === 1 ? "value" : "values"}
                              </span>
                              {enumDiff?.changeKind === "added" && (
                                <VersionDiffBadge severity="info" label="new" />
                              )}
                              {removedValueNames.length > 0 && (
                                <VersionDiffBadge severity="breaking" label={`${removedValueNames.length} removed`} />
                              )}
                              {addedValueNames.size > 0 && enumDiff?.changeKind !== "added" && (
                                <VersionDiffBadge severity="warning" label={`${addedValueNames.size} added`} />
                              )}
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            {enumDiff && (enumDiff.changeKind === "removed" || (enumDiff.changeKind === "values_changed" && removedValueNames.length > 0)) && (
                              <ApproveWarningButton
                                warning={getWarning("enum", enumEntry.enumId, enumDiff.changeKind)}
                                onApprove={approve}
                              />
                            )}
                            <button
                              type="button"
                              onClick={() => setEditingEnum(enumEntry)}
                              className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition hover:border-indigo-200 hover:text-indigo-700"
                              aria-label={`Edit ${enumEntry.name}`}
                            >
                              <IconPencil size={14} stroke={1.8} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteName(enumEntry.name)}
                              className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition hover:border-rose-200 hover:text-rose-600"
                              aria-label={`Delete ${enumEntry.name}`}
                            >
                              <IconTrash size={14} stroke={1.8} />
                            </button>
                          </div>
                        </div>

                        {enumEntry.values.length > 0 ? (
                          <div className="mt-3 space-y-1.5">
                            <div className="flex flex-wrap gap-1.5">
                              {enumEntry.values.slice(0, 6).map((v) => (
                                <span
                                  key={v.valueId}
                                  className={
                                    addedValueNames.has(v.name)
                                      ? "rounded border border-sky-200 bg-sky-50 px-2 py-0.5 font-mono text-[11px] font-semibold text-sky-700"
                                      : "rounded border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-[11px] font-semibold text-slate-700"
                                  }
                                >
                                  {v.name}
                                </span>
                              ))}
                              {enumEntry.values.length > 6 && (
                                <span className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                                  +{enumEntry.values.length - 6} more
                                </span>
                              )}
                            </div>
                            {removedValueNames.length > 0 && (
                              <div className="flex flex-wrap gap-1.5">
                                {removedValueNames.slice(0, 4).map((v) => (
                                  <span key={v} className="rounded border border-red-200 bg-red-50 px-2 py-0.5 font-mono text-[11px] font-semibold text-red-500 line-through">
                                    {v}
                                  </span>
                                ))}
                                {removedValueNames.length > 4 && (
                                  <span className="rounded border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-500">
                                    +{removedValueNames.length - 4} removed
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setEditingEnum(enumEntry)}
                            className="mt-2 w-full rounded border border-dashed border-indigo-200 px-3 py-2 text-xs font-medium text-indigo-400 transition hover:border-indigo-400 hover:bg-indigo-50 hover:text-indigo-600"
                          >
                            + Add values
                          </button>
                        )}
                      </div>
                    );})}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </section>

      {confirmDeleteName ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"
          onClick={() => setConfirmDeleteName("")}
        >
          <div
            className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-base font-semibold text-slate-950">
              Are you sure you want to remove enum{" "}
              <code className="rounded bg-indigo-50 px-1.5 py-0.5 font-mono text-sm text-indigo-700">
                {confirmDeleteName}
              </code>
              ?
            </p>
            <p className="mt-2 text-sm text-slate-500">
              This cannot be undone. Fields typed as this enum will retain their type name but the enum definition will be gone.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteName("")}
                className="h-9 rounded-md border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => deleteMutation.mutate({ projectName, version, name: confirmDeleteName })}
                disabled={deleteMutation.isPending}
                className="h-9 rounded-md bg-rose-600 px-4 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {deleteMutation.isPending ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
