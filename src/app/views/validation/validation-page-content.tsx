"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTablesQuery } from "@/queries/tables";
import { useFieldsQuery } from "@/queries/fields";
import { useZodSchemasQuery, useZodFileQuery, useZodMutations } from "@/queries/schema";
import { classNames } from "@/lib/utils";
import { fieldTypeBadgeClass } from "@/lib/badge-utils";
import { useProjectInfo } from "../shared/project-info-context";
import { IconCheck, IconCopy, IconEye, IconPencil, IconSettings2, IconTrash, IconX } from "@tabler/icons-react";
import type { PrismaField, PrismaModel } from "@/lib/schema-store";
import type { GenerateResponse } from "@/types/validation";
import { displayType } from "@/lib/display-utils";
import { GeneratedCodeDialog } from "@/components/validation/generated-code-dialog";
import { TableSelectorModal } from "@/features/table-selector";
import { EmptyState, InlineError, LoadingCard } from "@/components/built";

export function ValidationPageContent() {
  const { projectName, version: selectedVersion, hasProject } = useProjectInfo();
  const version = selectedVersion;
  const router = useRouter();
  const searchParams = useSearchParams();
  const generatorRef = useRef<HTMLElement>(null);
  const [pendingFieldKeys, setPendingFieldKeys] = useState<string[] | null>(null);

  const [selectedModelName, setSelectedModelName] = useState(
    () => searchParams.get("table") ?? "",
  );
  const [tableSearch, setTableSearch] = useState("");
  const [isTableSelectorOpen, setIsTableSelectorOpen] = useState(false);
  const [tablePage, setTablePage] = useState(1);
  const TABLE_PAGE_SIZE = 9;

  const tablesQuery = useTablesQuery(projectName, version);
  const models: PrismaModel[] = (tablesQuery.data ?? []) as PrismaModel[];

  const [selectedFieldKeys, setSelectedFieldKeys] = useState<Set<string>>(new Set());
  const [fieldSearch, setFieldSearch] = useState("");
  const [fieldTypeFilter, setFieldTypeFilter] = useState("all");
  const [fieldPage, setFieldPage] = useState(1);
  const FIELD_PAGE_SIZE = 30;

  const selectedModel = useMemo(
    () => models.find((m) => m.name === selectedModelName) ?? null,
    [models, selectedModelName],
  );
  const selectedModelKey = selectedModel?.key ?? "";

  const fieldsQuery = useFieldsQuery(projectName, version, selectedModelName, selectedModelKey);
  const fields: PrismaField[] = fieldsQuery.data?.fields ?? [];
  const enumTypes: string[] = fieldsQuery.data?.enumTypes ?? [];

  const [selectionHash, setSelectionHash] = useState<string | null>(null);
  const [dismissedHash, setDismissedHash] = useState<string | null>(null);
  const [generateError, setGenerateError] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogCode, setDialogCode] = useState("");
  const [dialogFilePath, setDialogFilePath] = useState("");
  const [dialogSchemaCount, setDialogSchemaCount] = useState(0);
  const [dialogEnumCount, setDialogEnumCount] = useState(0);
  const [dialogWarnings, setDialogWarnings] = useState<string[]>([]);
  const [dialogSchemaName, setDialogSchemaName] = useState("");
  const [dialogModelName, setDialogModelName] = useState("");
  const [dialogDate, setDialogDate] = useState("");
  const [copied, setCopied] = useState(false);

  const [viewingSchemaId, setViewingSchemaId] = useState<number | null>(null);
  const [editingSchemaId, setEditingSchemaId] = useState<number | null>(null);
  const [copiedRowPath, setCopiedRowPath] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingPath, setEditingPath] = useState("");
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [clearConfirmInput, setClearConfirmInput] = useState("");
  const [defaultPath, setDefaultPath] = useState(() =>
    typeof window !== "undefined" ? (localStorage.getItem("zod-default-path") ?? "") : ""
  );

  const listZodQuery = useZodSchemasQuery(projectName, version);
  const zodSchemas = listZodQuery.data ?? [];

  // Respects dismiss — used for banner + row blink
  const duplicateSchema = useMemo(
    () =>
      selectionHash && selectionHash !== dismissedHash && selectedModelName
        ? zodSchemas.find(
            (s) => s.fieldHash === selectionHash && s.modelName === selectedModelName && s.id !== editingSchemaId,
          ) ?? null
        : null,
    [selectionHash, dismissedHash, zodSchemas, selectedModelName, editingSchemaId],
  );

  // Ignores dismiss — used to block Convert regardless of whether banner was closed
  const hasDuplicate = useMemo(
    () =>
      selectionHash && selectedModelName
        ? zodSchemas.some(
            (s) => s.fieldHash === selectionHash && s.modelName === selectedModelName && s.id !== editingSchemaId,
          )
        : false,
    [selectionHash, zodSchemas, selectedModelName, editingSchemaId],
  );

  const readFileQuery = useZodFileQuery(viewingSchemaId);

  useEffect(() => {
    setTablePage(1);
  }, [tableSearch]);

  useEffect(() => {
    setFieldPage(1);
  }, [fieldSearch, fieldTypeFilter]);

  const selectableFields = useMemo(
    () =>
      fields.filter((field) => {
        if (field.isBackReference) return false;
        const matchesSearch = field.name.toLowerCase().includes(fieldSearch.toLowerCase());
        const matchesType = fieldTypeFilter === "all" || field.type === fieldTypeFilter;
        return matchesSearch && matchesType;
      }),
    [fields, fieldSearch, fieldTypeFilter],
  );

  const fieldTypes = useMemo(() => {
    const types = new Set(fields.map((f) => f.type));
    return Array.from(types).sort();
  }, [fields]);

  const paginatedFields = useMemo(() => {
    const start = (fieldPage - 1) * FIELD_PAGE_SIZE;
    return selectableFields.slice(start, start + FIELD_PAGE_SIZE);
  }, [selectableFields, fieldPage]);

  const totalFieldPages = Math.ceil(selectableFields.length / FIELD_PAGE_SIZE);

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

  // Reset field selection and editing context when model changes (unless restoring from edit)
  useEffect(() => {
    if (pendingFieldKeys === null) {
      setSelectedFieldKeys(new Set());
      setEditingSchemaId(null);
    }
  }, [selectedModelName]); // eslint-disable-line react-hooks/exhaustive-deps

  // Compute SHA-256 of sorted field UUIDs for duplicate detection
  useEffect(() => {
    if (selectedFieldKeys.size === 0) { setSelectionHash(null); return; }
    const sorted = Array.from(selectedFieldKeys).sort().join(",");
    setDismissedHash(null);
    crypto.subtle
      .digest("SHA-256", new TextEncoder().encode(sorted))
      .then((buf) => {
        setSelectionHash(Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join(""));
      });
  }, [selectedFieldKeys]);

  // Restore field selection after fields load (triggered by Edit button)
  useEffect(() => {
    if (!pendingFieldKeys || fieldsQuery.isLoading || fields.length === 0) return;
    const validKeys = new Set(fields.map((f) => f.key));
    setSelectedFieldKeys(new Set(pendingFieldKeys.filter((k) => validKeys.has(k))));
    setPendingFieldKeys(null);
  }, [fields, fieldsQuery.isLoading, pendingFieldKeys]);

  useEffect(() => {
    if (!readFileQuery.data || viewingSchemaId === null) return;
    const schema = zodSchemas.find((s) => s.id === viewingSchemaId);
    const displayPath = schema
      ? (resolvedPath(schema) ?? `${schema.schemaName.toLowerCase()}.ts`)
      : "schema.ts";
    setDialogCode(readFileQuery.data.code);
    setDialogFilePath(displayPath);
    setDialogSchemaCount(schema?.schemaCount ?? 0);
    setDialogEnumCount(schema?.enumCount ?? 0);
    setDialogWarnings([]);
    setDialogSchemaName(schema?.schemaName ?? schema?.modelName ?? "");
    setDialogModelName(schema?.modelName ?? "");
    setDialogDate(schema?.generatedAt.slice(0, 10) ?? "");
    setDialogOpen(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readFileQuery.data]);

  function resolvedPath(schema: { schemaName?: string; modelName: string; targetPath: string | null }) {
    const base = schema.targetPath?.trim().replace(/\/+$/, "");
    const filename = (schema.schemaName ?? schema.modelName).toLowerCase().replace(/\s+/g, "-");
    return base ? `${base}/${filename}.ts` : null;
  }

  const handleCopyRowPath = async (schema: { modelName: string; targetPath: string | null }) => {
    const text = resolvedPath(schema);
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.cssText = "position:fixed;opacity:0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopiedRowPath(schema.modelName);
    setTimeout(() => setCopiedRowPath(null), 1500);
  };

  const handleEditSchema = (schema: { id: number; modelName: string; selectedFieldKeys: string[] }) => {
    setPendingFieldKeys(schema.selectedFieldKeys);
    setSelectedModelName(schema.modelName);
    setEditingSchemaId(schema.id);
    setFieldSearch("");
    setFieldTypeFilter("all");
    setGenerateError("");
    setTimeout(() => generatorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  const selectModel = (modelName: string) => {
    setSelectedModelName(modelName);
    setTableSearch("");
    setFieldSearch("");
    setIsTableSelectorOpen(false);
    setGenerateError("");
    setTablePage(1);
  };

  const toggleField = (fieldKey: string) => {
    setSelectedFieldKeys((prev) => {
      const next = new Set(prev);
      if (next.has(fieldKey)) {
        next.delete(fieldKey);
      } else {
        next.add(fieldKey);
      }
      return next;
    });
    setGenerateError("");
  };

  const selectAll = () => {
    setSelectedFieldKeys(new Set(fields.filter((f) => !f.isBackReference).map((f) => f.key)));
    setGenerateError("");
  };

  const clearAll = () => {
    setSelectedFieldKeys(new Set());
    setGenerateError("");
  };

  const {
    invalidate: invalidateZodSchemas,
    setPath: setPathMutation,
    rename: renameMutation,
    delete: deleteMutation,
    clear: clearMutation,
    generate: generateMutation,
  } = useZodMutations(projectName, version);


  const handleConvert = () => {
    if (selectedFieldKeys.size === 0) { setGenerateError("Select at least one field."); return; }
    setGenerateError("");
    generateMutation.mutate(
      { projectName, version, modelName: selectedModelName, modelKey: selectedModelKey, selectedFieldKeys: Array.from(selectedFieldKeys), schemaId: editingSchemaId ?? undefined, defaultPath: editingSchemaId ? undefined : (defaultPath.trim() || undefined) },
      {
        onSuccess: (data) => {
          const d = data as GenerateResponse | undefined;
          const existingSchema = editingSchemaId ? zodSchemas.find((s) => s.id === editingSchemaId) : null;
          setDialogCode(d?.code ?? ""); setDialogFilePath(""); setDialogSchemaCount(d?.schemaCount ?? 0);
          setDialogEnumCount(d?.enumCount ?? 0); setDialogWarnings(d?.warnings ?? []);
          setDialogSchemaName(existingSchema?.schemaName ?? selectedModelName);
          setDialogModelName(selectedModelName); setDialogDate(new Date().toISOString().slice(0, 10));
          setViewingSchemaId(null); setEditingSchemaId(null); setDialogOpen(true);
          void invalidateZodSchemas();
        },
        onError: (err) => setGenerateError(err.message),
      },
    );
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(dialogCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: create textarea and copy
      const textarea = document.createElement("textarea");
      textarea.value = dialogCode;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setCopied(false);
    setViewingSchemaId(null);
  };

  if (!hasProject) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-8 text-center">
        <p className="text-slate-600">Select a project to generate validation schemas.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-4">
            <div className="shrink-0">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Saved Schemas
              </p>
              <h3 className="mt-1 text-xl font-semibold text-slate-950">
                Generated Schemas
              </h3>
            </div>
            <input
              type="text"
              value={defaultPath}
              onChange={(e) => {
                setDefaultPath(e.target.value);
                localStorage.setItem("zod-default-path", e.target.value);
              }}
              placeholder="Default project path (e.g. /home/user/myapp/src/validators)"
              className="h-10 flex-1 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-amber-500"
            />
            <div className="flex shrink-0 items-center gap-2">
              <span className="rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">
                {selectedModelName
                  ? `${zodSchemas.filter((s) => s.modelName === selectedModelName).length} of ${zodSchemas.length}`
                  : `${zodSchemas.length} ${zodSchemas.length === 1 ? "schema" : "schemas"}`}
              </span>
              {zodSchemas.length > 0 && (
                <button
                  type="button"
                  onClick={() => { setClearConfirmOpen(true); setClearConfirmInput(""); }}
                  className="h-9 rounded-md border border-rose-200 bg-white px-4 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
                >
                  Clear All
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="p-5 space-y-3">
          {listZodQuery.isLoading ? (
            <LoadingCard className="p-6" />
          ) : zodSchemas.length === 0 ? (
            <EmptyState message="No schemas generated yet for this version." />
          ) : (
            <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
              {zodSchemas.filter((s) => !selectedModelName || s.modelName === selectedModelName).map((schema) => {
                const fullPath = resolvedPath(schema);
                const isCopied = copiedRowPath === schema.modelName;
                const isViewing = viewingSchemaId === schema.id && readFileQuery.isFetching;
                const isEditing = editingId === schema.id;
                const isBeingEdited = editingSchemaId === schema.id;
                const isDuplicate = duplicateSchema?.id === schema.id;

                return (
                  <div key={schema.id} className={classNames("px-4 py-3 space-y-2 transition-colors", isBeingEdited ? "bg-amber-50/50" : "", isDuplicate ? "animate-pulse bg-amber-50" : "")}>
                    <div className="flex items-center gap-3">
                      <div className="min-w-0 flex-1 flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-slate-950 shrink-0">
                          {schema.schemaName}
                        </span>
                        {isBeingEdited && (
                          <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-700">
                            editing
                          </span>
                        )}
                        {schema.schemaName !== schema.modelName && (
                          <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-500">
                            {schema.modelName}
                          </span>
                        )}
                        <span className="shrink-0 rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                          v{schema.generatedAt.slice(0, 10)}
                        </span>
                        {schema.schemaCount > 0 && (
                          <span className="shrink-0 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                            {schema.schemaCount} schema{schema.schemaCount !== 1 ? "s" : ""}
                            {schema.enumCount > 0 ? ` · ${schema.enumCount} enum${schema.enumCount !== 1 ? "s" : ""}` : ""}
                          </span>
                        )}
                        {fullPath ? (
                          <span className="min-w-0 truncate text-xs font-medium text-slate-500" title={fullPath}>
                            {fullPath}
                          </span>
                        ) : (
                          <span className="shrink-0 text-xs font-medium text-slate-400 italic">
                            No path set
                          </span>
                        )}
                      </div>

                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleCopyRowPath(schema)}
                          disabled={!fullPath}
                          title={fullPath ? "Copy resolved path" : "Set a project path first"}
                          className="flex h-7 w-7 items-center justify-center rounded border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {isCopied ? (
                            <IconCheck size={14} stroke={2.5} className="text-emerald-600" />
                          ) : (
                            <IconCopy size={14} stroke={2} />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => setViewingSchemaId(schema.id)}
                          disabled={isViewing}
                          title="View code"
                          className="flex h-7 w-7 items-center justify-center rounded border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-700 disabled:cursor-wait"
                        >
                          <IconEye size={14} stroke={2} />
                        </button>
                        <button
                          type="button"
                          title="Re-generate this schema"
                          onClick={() => handleEditSchema(schema)}
                          className="flex h-7 w-7 items-center justify-center rounded border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
                        >
                          <IconPencil size={14} stroke={2} />
                        </button>
                        <button
                          type="button"
                          title="Schema settings"
                          onClick={() => {
                            if (isEditing) {
                              setEditingId(null);
                            } else {
                              setEditingId(schema.id);
                              setEditingName(schema.schemaName);
                              setEditingPath(schema.targetPath ?? "");
                            }
                          }}
                          className={classNames(
                            "flex h-7 w-7 items-center justify-center rounded border bg-white transition",
                            isEditing || schema.targetPath
                              ? "border-amber-300 text-amber-600 hover:bg-amber-50"
                              : "border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700",
                          )}
                        >
                          <IconSettings2 size={14} stroke={2} />
                        </button>
                        <button
                          type="button"
                          title="Delete this schema"
                          onClick={() => deleteMutation.mutate({ id: schema.id }, { onSuccess: (_, vars) => { void invalidateZodSchemas(); if (editingSchemaId === vars.id) setEditingSchemaId(null); if (viewingSchemaId === vars.id) setViewingSchemaId(null); } })}
                          disabled={deleteMutation.isPending}
                          className="flex h-7 w-7 items-center justify-center rounded border border-slate-200 bg-white text-slate-400 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 disabled:cursor-wait"
                        >
                          <IconTrash size={14} stroke={2} />
                        </button>
                      </div>
                    </div>

                    {isEditing && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50/30 p-3 space-y-3">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                              Schema label
                            </label>
                            <input
                              autoFocus
                              type="text"
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              onKeyDown={(e) => { if (e.key === "Escape") setEditingId(null); }}
                              placeholder={schema.modelName}
                              className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-xs font-medium text-slate-950 outline-none placeholder:text-slate-400 focus:border-amber-500"
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                              Path in your project
                            </label>
                            <input
                              type="text"
                              value={editingPath}
                              onChange={(e) => setEditingPath(e.target.value)}
                              onKeyDown={(e) => { if (e.key === "Escape") setEditingId(null); }}
                              placeholder="/home/user/myapp/src/validators"
                              className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-xs font-medium text-slate-950 outline-none placeholder:text-slate-400 focus:border-amber-500"
                            />
                          </div>
                        </div>
                        {editingPath.trim() && (
                          <p className="text-[11px] text-slate-500">
                            Resolves to: <span className="font-medium text-slate-700">{editingPath.trim().replace(/\/+$/, "")}/{(editingName.trim() || schema.schemaName).toLowerCase().replace(/\s+/g, "-")}.ts</span>
                          </p>
                        )}
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="h-8 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const name = editingName.trim() || schema.modelName;
                              const targetPath = editingPath.trim() || null;
                              if (name !== schema.schemaName) renameMutation.mutate({ id: schema.id, schemaName: name }, { onSuccess: () => void invalidateZodSchemas() });
                              if (targetPath !== schema.targetPath) setPathMutation.mutate({ id: schema.id, targetPath }, { onSuccess: () => void invalidateZodSchemas() });
                              setEditingId(null);
                            }}
                            disabled={setPathMutation.isPending || renameMutation.isPending}
                            className="h-8 rounded-md bg-amber-600 px-4 text-xs font-semibold text-white transition hover:bg-amber-700 disabled:opacity-60"
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {clearConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
          <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white shadow-2xl">
            <div className="border-b border-slate-200 px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-500">
                Destructive Action
              </p>
              <h3 className="mt-1 text-lg font-semibold text-slate-950">
                Clear All Generated Schemas
              </h3>
            </div>
            <div className="px-5 py-4 space-y-3">
              <p className="text-sm text-slate-600">
                This will permanently remove all <span className="font-semibold">{zodSchemas.length} Zod schema{zodSchemas.length !== 1 ? "s" : ""}</span> for version <span className="font-semibold">{version}</span> from the database. This cannot be undone.
              </p>
              <p className="text-sm text-slate-600">
                To confirm, type the project name: <span className="font-mono font-semibold text-slate-950">{projectName}</span>
              </p>
              <input
                autoFocus
                type="text"
                value={clearConfirmInput}
                onChange={(e) => setClearConfirmInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && clearConfirmInput === projectName) {
                    clearMutation.mutate({ projectName, version }, { onSuccess: () => { void invalidateZodSchemas(); setClearConfirmOpen(false); setClearConfirmInput(""); } });
                  }
                }}
                placeholder={projectName}
                className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-rose-400"
              />
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-4">
              <button
                type="button"
                onClick={() => { setClearConfirmOpen(false); setClearConfirmInput(""); }}
                className="h-9 rounded-md border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => clearMutation.mutate({ projectName, version })}
                disabled={clearConfirmInput !== projectName || clearMutation.isPending}
                className="h-9 rounded-md bg-rose-600 px-5 text-xs font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {clearMutation.isPending ? "Removing..." : "Remove All"}
              </button>
            </div>
          </div>
        </div>
      )}

      <section ref={generatorRef} className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Main Window
              </p>
              <h3 className="mt-1 text-xl font-semibold text-slate-950">
                Zod Schema Generator
              </h3>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-medium text-slate-500">
                {projectName}-{version}
              </span>
              <span className="rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">
                {selectedModel ? selectedModel.name : "No table selected"}
              </span>
              <button
                type="button"
                onClick={() => setIsTableSelectorOpen(true)}
                className="h-9 min-w-36 rounded-md border border-amber-300 bg-white px-5 text-xs font-semibold text-amber-700 transition hover:bg-amber-50"
              >
                Select Table
              </button>
            </div>
          </div>
        </div>

        <div className="p-5">
          {!selectedModelName ? (
            <EmptyState
              message="Select a table to generate a Zod schema."
              action={{ label: "Select Table", onClick: () => setIsTableSelectorOpen(true), tone: "slate" }}
            />
          ) : fieldsQuery.isLoading ? (
            <LoadingCard message="Loading fields…" />
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm font-semibold text-slate-950">{selectedModelName}</span>
                  <span className="text-xs font-medium text-slate-400">
                    {fields.filter((f) => !f.isBackReference).length} fields
                    {enumTypes.length > 0 ? ` · ${enumTypes.length} enum${enumTypes.length !== 1 ? "s" : ""}` : ""}
                  </span>
                </div>
                <div className="h-4 w-px bg-slate-200 shrink-0" />
                <button
                  type="button"
                  onClick={selectAll}
                  className="shrink-0 h-8 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={clearAll}
                  className="shrink-0 h-8 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Clear
                </button>
                <div className="h-4 w-px bg-slate-200 shrink-0" />
                <input
                  type="text"
                  value={fieldSearch}
                  onChange={(event) => setFieldSearch(event.target.value)}
                  placeholder="Search fields..."
                  className="h-8 min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-3 text-xs font-medium text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-amber-600"
                />
                <select
                  value={fieldTypeFilter}
                  onChange={(event) => setFieldTypeFilter(event.target.value)}
                  className="shrink-0 h-8 rounded-md border border-slate-300 bg-white px-3 text-xs font-medium text-slate-950 outline-none transition focus:border-amber-600"
                >
                  <option value="all">All Types</option>
                  {fieldTypes.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              <div className="flex-1 grid grid-cols-2 gap-2 overflow-y-auto rounded-md border border-slate-200 bg-white p-2 sm:grid-cols-3 lg:grid-cols-4">
                {selectableFields.length === 0 ? (
                  <div className="col-span-full py-8 text-center text-sm font-medium text-slate-500">
                    {fieldSearch ? "No fields match your search." : "No fields available."}
                  </div>
                ) : (
                  paginatedFields.map((field) => {
                    const isSelected = selectedFieldKeys.has(field.key);
                    const isEnum = enumTypes.includes(field.type);
                    const displayFieldType = displayType(field, enumTypes);

                    return (
                      <div
                        key={field.key}
                        onClick={() => toggleField(field.key)}
                        className={classNames(
                          "cursor-pointer rounded-md border p-3 transition",
                          isSelected
                            ? "border-amber-400 bg-amber-50"
                            : "border-slate-200 bg-white hover:border-amber-300 hover:bg-amber-50/50",
                        )}
                      >
                        <div className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-slate-950">
                            {field.name}
                          </span>
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            <span
                              className={classNames(
                                "inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold",
                                fieldTypeBadgeClass(displayFieldType),
                              )}
                            >
                              {displayFieldType}
                            </span>
                            {field.nullable && (
                              <span className="inline-flex rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                                nullable
                              </span>
                            )}
                            {field.isArray && (
                              <span className="inline-flex rounded-md bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-700">
                                array
                              </span>
                            )}
                            {isEnum && (
                              <span className="inline-flex rounded-md bg-indigo-100 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">
                                enum
                              </span>
                            )}
                            {field.isRelation && (
                              <span className="inline-flex rounded-md bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                                relation
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              {totalFieldPages > 1 && (
                <div className="flex items-center justify-center gap-4 py-3">
                  <button
                    type="button"
                    onClick={() => setFieldPage((p) => Math.max(1, p - 1))}
                    disabled={fieldPage === 1}
                    className="h-9 rounded-md border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100"
                  >
                    Previous
                  </button>
                  <span className="text-sm font-medium text-slate-600">
                    Page {fieldPage} of {totalFieldPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setFieldPage((p) => Math.min(totalFieldPages, p + 1))}
                    disabled={fieldPage === totalFieldPages}
                    className="h-9 rounded-md border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100"
                  >
                    Next
                  </button>
                </div>
              )}

              <InlineError message={generateError} />

              {duplicateSchema && (
                <div className="flex items-start justify-between gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  <span>
                    <span className="font-semibold">Duplicate detected</span> — this exact field set was already generated as{" "}
                    <span className="font-semibold">{duplicateSchema.schemaName}</span>. Change the field selection to convert.
                  </span>
                  <button
                    type="button"
                    onClick={() => setDismissedHash(selectionHash)}
                    className="shrink-0 rounded p-0.5 text-amber-600 hover:bg-amber-100 hover:text-amber-800"
                    title="Dismiss"
                  >
                    <IconX size={14} stroke={2} />
                  </button>
                </div>
              )}

              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-500">
                  {selectedFieldKeys.size} of {fields.filter((f) => !f.isBackReference).length} fields selected
                </p>
                <button
                  type="button"
                  onClick={() => handleConvert()}
                  disabled={
                    generateMutation.isPending ||
                    selectedFieldKeys.size === 0 ||
                    hasDuplicate
                  }
                  className="h-10 min-w-36 rounded-md bg-amber-600 px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {generateMutation.isPending ? "Generating..." : "Generate Schema"}
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      <TableSelectorModal
        isOpen={isTableSelectorOpen}
        models={models}
        selectedModelName={selectedModelName}
        search={tableSearch}
        isLoading={tablesQuery.isLoading}
        tone="amber"
        page={tablePage}
        pageSize={TABLE_PAGE_SIZE}
        onSearch={setTableSearch}
        onSelect={selectModel}
        onClose={() => setIsTableSelectorOpen(false)}
        onPageChange={setTablePage}
        typeBadgeClass={fieldTypeBadgeClass}
      />

      <GeneratedCodeDialog
        isOpen={dialogOpen}
        code={dialogCode}
        filePath={dialogFilePath}
        schemaName={dialogSchemaName}
        modelName={dialogModelName}
        date={dialogDate}
        schemaCount={dialogSchemaCount}
        enumCount={dialogEnumCount}
        warnings={dialogWarnings}
        copied={copied}
        onCopy={handleCopy}
        onClose={closeDialog}
      />
    </div>
  );
}
