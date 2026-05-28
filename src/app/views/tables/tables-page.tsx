"use client";

import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { useTRPC } from "@/trpc/client";
import { useProjectInfo } from "../shared/project-info-context";
import { useVersionDiffLookup } from "../shared/use-version-diff";
import { TableDiffSummary, TableDiffDetailModal } from "../shared/version-diff-badge";
import type { TableDiff } from "@/lib/version-diff/detect-changes";
import type { PrismaModel } from "@/lib/schema-store";

type ProviderKey = "postgresql" | "mysql" | "sqlite";
type PkTypeValue = "String" | "Int" | "BigInt" | "DateTime" | "Uuid";
type HelpDialog = "primaryKeys" | "naming" | null;

const pkTypeDetails: Record<
  PkTypeValue,
  {
    label: string;
    summary: string;
    badgeClass: string;
  }
> = {
  String: {
    label: "String (cuid)",
    summary: "App-generated string ID with @default(cuid()).",
    badgeClass: "bg-green-50 text-green-700",
  },
  Int: {
    label: "Int (autoincrement)",
    summary: "Database-generated integer ID.",
    badgeClass: "bg-blue-50 text-blue-700",
  },
  BigInt: {
    label: "BigInt (autoincrement)",
    summary: "Database-generated large integer ID.",
    badgeClass: "bg-rose-50 text-rose-700",
  },
  DateTime: {
    label: "DateTime (now)",
    summary: "Timestamp ID. Use only for legacy schemas.",
    badgeClass: "bg-orange-50 text-orange-700",
  },
  Uuid: {
    label: "Uuid",
    summary: "Provider-aware UUID ID.",
    badgeClass: "bg-purple-50 text-purple-700",
  },
};

const providerPkTypes: Record<ProviderKey, PkTypeValue[]> = {
  postgresql: ["Int", "BigInt", "Uuid", "String", "DateTime"],
  mysql: ["Int", "BigInt", "Uuid", "String"],
  sqlite: ["Int", "Uuid", "String"],
};

const defaultPkType = "Int";
const prismaIdentifierPattern = /^[a-zA-Z][a-zA-Z0-9_]*$/;

function providerKey(provider: string): ProviderKey {
  if (provider === "MySQL") return "mysql";
  if (provider === "SQLite") return "sqlite";
  return "postgresql";
}

function providerLabel(key: ProviderKey) {
  if (key === "mysql") return "MySQL";
  if (key === "sqlite") return "SQLite";
  return "Postgres";
}

function pkOptionsForProvider(key: ProviderKey) {
  return providerPkTypes[key].map((value) => ({
    value,
    ...pkTypeDetails[value],
  }));
}

function pkExampleLine(pkName: string, pkType: string, key: ProviderKey) {
  const name = prismaIdentifierPattern.test(pkName.trim()) ? pkName.trim() : "id";

  if (pkType === "Int") return `${name} Int @id @default(autoincrement())`;
  if (pkType === "BigInt") return `${name} BigInt @id @default(autoincrement())`;
  if (pkType === "Uuid") {
    return key === "postgresql"
      ? `${name} String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid`
      : `${name} String @id @default(uuid())`;
  }
  if (pkType === "DateTime") return `${name} DateTime @id @default(now())`;
  return `${name} String @id @default(cuid())`;
}

function fieldTypeBadgeClass(type: string) {
  return pkTypeDetails[type as PkTypeValue]?.badgeClass ?? "bg-slate-100 text-slate-600";
}

function HelpIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="9" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.25a2.35 2.35 0 0 1 4.48 1c0 1.8-2.23 1.95-2.23 3.35" />
      <path strokeLinecap="round" d="M12 17.25h.01" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="m6 6 12 12M18 6 6 18" />
    </svg>
  );
}

export function TablesPageContent() {
  const { projectName, version, versions, provider, hasProject } = useProjectInfo();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { diffByTableKey } = useVersionDiffLookup(projectName, version);
  const [diffDetail, setDiffDetail] = useState<TableDiff | null>(null);
  const versionIdx = versions.indexOf(version);
  const previousVersion = versionIdx > 0 ? versions[versionIdx - 1]! : "";

  const listQuery = useQuery(
    trpc.tables.list.queryOptions(
      { projectName, version },
      { enabled: !!projectName && !!version },
    ),
  );
  const models: PrismaModel[] = (listQuery.data ?? []) as PrismaModel[];

  const invalidateTables = () =>
    queryClient.invalidateQueries({ queryKey: trpc.tables.list.queryOptions({ projectName, version }).queryKey });

  const [modelName, setModelName] = useState("");
  const [pkName, setPkName] = useState("id");
  const [pkType, setPkType] = useState(defaultPkType);
  const [createError, setCreateError] = useState("");
  const [selectedModel, setSelectedModel] = useState<PrismaModel | null>(null);
  const [editModelName, setEditModelName] = useState("");
  const [editPkName, setEditPkName] = useState("");
  const [editPkType, setEditPkType] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [updateError, setUpdateError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 32;
  const [searchTerm, setSearchTerm] = useState("");
  const [helpDialog, setHelpDialog] = useState<HelpDialog>(null);

  const activeProvider = providerKey(provider);
  const providerDisplay = providerLabel(activeProvider);
  const pkTypes = useMemo(() => pkOptionsForProvider(activeProvider), [activeProvider]);
  const effectivePkType = pkTypes.some((type) => type.value === pkType) ? pkType : pkTypes[0]?.value ?? defaultPkType;
  const selectedPkSummary = pkTypeDetails[effectivePkType as PkTypeValue]?.summary ?? "Primary key field.";
  const selectedEditPkSummary = pkTypeDetails[editPkType as PkTypeValue]?.summary ?? "Primary key field.";

  const createMutation = useMutation({
    ...trpc.tables.create.mutationOptions(),
    onSuccess: () => {
      void invalidateTables();
      setModelName("");
      setPkName("id");
      setPkType(defaultPkType);
      setCurrentPage(1);
      setCreateError("");
    },
    onError: (err) => setCreateError(err.message),
  });

  const updateMutation = useMutation({
    ...trpc.tables.update.mutationOptions(),
    onSuccess: () => {
      void invalidateTables();
      cancelEdit();
    },
    onError: (err) => setUpdateError(err.message),
  });

  const deleteMutation = useMutation({
    ...trpc.tables.delete.mutationOptions(),
    onSuccess: () => {
      void invalidateTables();
      setCurrentPage(1);
      cancelEdit();
    },
    onError: (err) => setUpdateError(err.message),
  });

  const submitModel = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = modelName.trim();
    if (!trimmedName) { setCreateError("Model name is required."); return; }
    if (!pkName.trim()) { setCreateError("Primary key name is required."); return; }
    if (!prismaIdentifierPattern.test(pkName.trim())) {
      setCreateError("Primary key name must start with a letter and contain only letters, numbers, and underscores.");
      return;
    }
    if (!effectivePkType) { setCreateError("Primary key type is required."); return; }
    if (!prismaIdentifierPattern.test(trimmedName)) {
      setCreateError("Model name must start with a letter and contain only letters, numbers, and underscores.");
      return;
    }
    if (models.some((m) => m.name === trimmedName)) {
      setCreateError("A model with this name already exists.");
      return;
    }
    setCreateError("");
    createMutation.mutate({ projectName, version, modelName: trimmedName, pkName: pkName.trim(), pkType: effectivePkType as "String" | "Int" | "BigInt" | "DateTime" | "Uuid" });
  };

  const startEdit = (model: PrismaModel) => {
    setSelectedModel(model);
    setEditModelName(model.name);
    setEditPkName(model.pkName || "id");
    setEditPkType(model.pkType || "Int");
    setIsEditing(true);
    setUpdateError("");
  };

  const cancelEdit = () => {
    setSelectedModel(null);
    setEditModelName("");
    setEditPkName("");
    setEditPkType("");
    setIsEditing(false);
    setUpdateError("");
  };

  const saveEdit = () => {
    if (!selectedModel) return;
    const trimmedName = editModelName.trim();
    if (!trimmedName) { setUpdateError("Model name is required."); return; }
    if (!editPkName.trim()) { setUpdateError("Primary key name is required."); return; }
    if (!prismaIdentifierPattern.test(editPkName.trim())) {
      setUpdateError("Primary key name must start with a letter and contain only letters, numbers, and underscores.");
      return;
    }
    if (!editPkType) { setUpdateError("Primary key type is required."); return; }
    setUpdateError("");
    updateMutation.mutate({
      projectName,
      version,
      modelKey: selectedModel.key,
      oldModelName: selectedModel.name,
      newModelName: trimmedName,
      pkName: editPkName.trim(),
      pkType: editPkType as "String" | "Int" | "BigInt" | "DateTime" | "Uuid",
    });
  };

  const deleteSelectedModel = () => {
    if (!selectedModel) return;
    const confirmed = window.confirm(`Delete ${selectedModel.name}? This will also remove its fields and relations.`);
    if (!confirmed) return;

    setUpdateError("");
    deleteMutation.mutate({
      projectName,
      version,
      modelName: selectedModel.name,
      modelKey: selectedModel.key,
    });
  };

  if (!hasProject) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-8 text-center">
        <p className="text-slate-600">Select a project to manage tables.</p>
      </div>
    );
  }

  return (
    <div>
      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Main Window
              </p>
              <h3 className="mt-1 text-xl font-semibold text-slate-950">
                Tables workspace
              </h3>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-slate-500">
                {projectName}-{version}.prisma
              </span>
              <span className="rounded-md border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-xs font-semibold text-cyan-700">
                {models.length} tables
              </span>
            </div>
          </div>
        </div>

        <div className="grid gap-0 lg:grid-cols-[360px_minmax(0,1fr)]">
          <form onSubmit={submitModel} className="border-b border-slate-200 p-5 lg:border-b-0 lg:border-r">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              Add Table
            </p>
            <p className="mt-1 text-sm text-slate-600">
              Create a new model in the Prisma schema.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setHelpDialog("primaryKeys")}
                className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:border-cyan-200 hover:text-cyan-700"
                aria-label="Open primary key rules"
              >
                <HelpIcon />
                <span>Primary Keys</span>
              </button>
              <button
                type="button"
                onClick={() => setHelpDialog("naming")}
                className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:border-cyan-200 hover:text-cyan-700"
                aria-label="Open naming convention rules"
              >
                <HelpIcon />
                <span>Naming</span>
              </button>
            </div>

            <label htmlFor="table-name" className="mt-5 block text-sm font-semibold text-slate-700">
              Model name
            </label>
            <input
              id="table-name"
              value={modelName}
              onChange={(e) => {
                setModelName(e.target.value);
                setCreateError("");
              }}
              className="mt-2 h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-cyan-600"
              placeholder="Customer"
            />

            <label htmlFor="table-pk-name" className="mt-5 block text-sm font-semibold text-slate-700">
              Primary Key Name
            </label>
            <input
              id="table-pk-name"
              value={pkName}
              onChange={(e) => {
                setPkName(e.target.value);
                setCreateError("");
              }}
              className="mt-2 h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-cyan-600"
              placeholder="id"
            />
            <p className="mt-2 text-xs leading-5 text-slate-500">
              Use a Prisma field name. The conventional choice is <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[11px] text-slate-700">id</code>.
            </p>

            <label htmlFor="table-pk-type" className="mt-5 block text-sm font-semibold text-slate-700">
              Primary Key Type
            </label>
            <select
              id="table-pk-type"
              value={effectivePkType}
              onChange={(e) => {
                setPkType(e.target.value);
                setCreateError("");
              }}
              className="mt-2 h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-950 outline-none transition focus:border-cyan-600"
            >
              {pkTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
            <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  {providerDisplay}
                </span>
                <span className="text-xs font-medium text-slate-500">{selectedPkSummary}</span>
              </div>
              <code className="mt-2 block overflow-x-auto whitespace-nowrap rounded bg-white px-2 py-2 font-mono text-xs text-slate-700">
                {pkExampleLine(pkName, effectivePkType, activeProvider)}
              </code>
            </div>

            {createError ? (
              <p className="mt-3 text-sm font-semibold text-rose-600">{createError}</p>
            ) : null}

            <button
              type="submit"
              disabled={createMutation.isPending || models.length >= 50}
              className="mt-5 h-10 w-full rounded-md bg-cyan-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {createMutation.isPending ? "Creating..." : "Add Table"}
            </button>
          </form>

          <div className="p-5">
            {listQuery.isLoading ? (
              <div className="text-center py-8 text-slate-500">Loading...</div>
            ) : models.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
                No tables yet. Add your first table above.
              </div>
            ) : isEditing && selectedModel ? (
              <div className="rounded-lg border border-cyan-200 bg-cyan-50 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-700">
                  Edit Table
                </p>

                <label htmlFor="edit-table-name" className="mt-4 block text-sm font-semibold text-slate-700">
                  Model name
                </label>
                <input
                  id="edit-table-name"
                  value={editModelName}
                  onChange={(e) => {
                    setEditModelName(e.target.value);
                    setUpdateError("");
                  }}
                  className="mt-2 h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-950 outline-none transition focus:border-cyan-600"
                />

                <label htmlFor="edit-pk-name" className="mt-4 block text-sm font-semibold text-slate-700">
                  Primary Key Name
                </label>
                <input
                  id="edit-pk-name"
                  value={editPkName}
                  onChange={(e) => {
                    setEditPkName(e.target.value);
                    setUpdateError("");
                  }}
                  className="mt-2 h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-950 outline-none transition focus:border-cyan-600"
                />

                <label htmlFor="edit-pk-type" className="mt-4 block text-sm font-semibold text-slate-700">
                  Primary Key Type
                </label>
                <select
                  id="edit-pk-type"
                  value={editPkType}
                  onChange={(e) => {
                    setEditPkType(e.target.value);
                    setUpdateError("");
                  }}
                  className="mt-2 h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-950 outline-none transition focus:border-cyan-600"
                >
                  {pkTypes.some((type) => type.value === editPkType) ? null : (
                    <option value={editPkType}>
                      {editPkType} (current)
                    </option>
                  )}
                  {pkTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
                <div className="mt-3 rounded-md border border-cyan-200 bg-white/70 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-semibold uppercase tracking-[0.12em] text-cyan-700">
                      {providerDisplay}
                    </span>
                    <span className="text-xs font-medium text-slate-500">{selectedEditPkSummary}</span>
                  </div>
                  <code className="mt-2 block overflow-x-auto whitespace-nowrap rounded bg-white px-2 py-2 font-mono text-xs text-slate-700">
                    {pkExampleLine(editPkName, editPkType, activeProvider)}
                  </code>
                </div>

                {updateError ? (
                  <p className="mt-3 text-sm font-semibold text-rose-600">{updateError}</p>
                ) : null}

                <div className="mt-5 flex gap-2">
                  <button
                    type="button"
                    onClick={saveEdit}
                    disabled={updateMutation.isPending || deleteMutation.isPending}
                    className="h-10 rounded-md border border-cyan-300 bg-white px-4 text-sm font-semibold text-cyan-700 transition hover:bg-cyan-50 disabled:cursor-not-allowed disabled:text-slate-400"
                  >
                    {updateMutation.isPending ? "Saving..." : "Save"}
                  </button>
                  <button
                    type="button"
                    onClick={cancelEdit}
                    disabled={updateMutation.isPending || deleteMutation.isPending}
                    className="h-10 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={deleteSelectedModel}
                    disabled={updateMutation.isPending || deleteMutation.isPending}
                    className="ml-auto inline-flex h-10 items-center gap-2 rounded-md border border-rose-200 bg-white px-4 text-sm font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-50 disabled:cursor-not-allowed disabled:text-slate-400"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    {deleteMutation.isPending ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="mb-4">
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setCurrentPage(1);
                    }}
                    placeholder="Search tables..."
                    className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-cyan-600"
                  />
                </div>
                {(() => {
                  const filteredModels = models.filter(m => m.name.toLowerCase().includes(searchTerm.toLowerCase()));
                  return (
                <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {filteredModels
                    .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                    .map((model) => (
                      <div
                        key={model.key}
                        className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4 hover:border-cyan-300 transition"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-slate-950">
                            {model.name}
                          </span>
                          <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${fieldTypeBadgeClass(model.pkType || "String")}`}>
                            {model.pkType || "String"}
                          </span>
                          {(() => {
                            const td = diffByTableKey.get(model.key);
                            return td ? (
                              <button
                                type="button"
                                onClick={() => setDiffDetail(td)}
                                className="shrink-0"
                              >
                                <TableDiffSummary tableDiff={td} />
                              </button>
                            ) : null;
                          })()}
                        </div>
                        <button
                          type="button"
                          onClick={() => startEdit(model)}
                          className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 transition hover:border-cyan-200 hover:text-cyan-700"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-4 w-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
                          </svg>
                        </button>
                      </div>
                    ))}
                </div>
                {filteredModels.length > itemsPerPage && (
                  <div className="mt-6 flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 transition hover:border-cyan-200 hover:text-cyan-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-4 w-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                      </svg>
                    </button>
                    <span className="text-sm text-slate-600">
                      {currentPage} / {Math.ceil(filteredModels.length / itemsPerPage)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setCurrentPage(p => Math.min(Math.ceil(filteredModels.length / itemsPerPage), p + 1))}
                      disabled={currentPage >= Math.ceil(filteredModels.length / itemsPerPage)}
                      className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 transition hover:border-cyan-200 hover:text-cyan-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-4 w-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                      </svg>
                    </button>
                  </div>
                )}
                </>
                  );
                })()}
              </>
            )}
          </div>
        </div>
      </section>

      {helpDialog ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6" role="dialog" aria-modal="true">
          <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  {providerDisplay} / Tables
                </p>
                <h3 className="mt-1 text-lg font-semibold text-slate-950">
                  {helpDialog === "primaryKeys" ? "Primary Key Rules" : "Naming Convention"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setHelpDialog(null)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:text-slate-900"
                aria-label="Close dialog"
              >
                <CloseIcon />
              </button>
            </div>

            {helpDialog === "primaryKeys" ? (
              <div className="space-y-5 px-5 py-5">
                <p className="text-sm leading-6 text-slate-600">
                  Each table starts with one required Prisma <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-xs text-slate-700">@id</code> field.
                  The options below are filtered for the active database provider.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {pkTypes.map((type) => (
                    <div key={type.value} className="rounded-md border border-slate-200 bg-slate-50 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold ${type.badgeClass}`}>
                          {type.value}
                        </span>
                        <span className="text-xs font-medium text-slate-500">{providerDisplay}</span>
                      </div>
                      <p className="mt-2 text-sm text-slate-600">{type.summary}</p>
                      <code className="mt-3 block overflow-x-auto whitespace-nowrap rounded bg-white px-2 py-2 font-mono text-xs text-slate-700">
                        {pkExampleLine(pkName, type.value, activeProvider)}
                      </code>
                    </div>
                  ))}
                </div>
                <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm leading-6 text-amber-800">
                  Postgres UUID primary keys use the database generator by default:
                  <code className="ml-1 rounded bg-white px-1 py-0.5 font-mono text-xs text-amber-900">gen_random_uuid()</code>.
                  DateTime IDs are kept for legacy Postgres schemas, but new tables should usually use Int, BigInt, UUID, or cuid-style String IDs.
                </p>
              </div>
            ) : (
              <div className="space-y-4 px-5 py-5">
                <p className="text-sm leading-6 text-slate-600">
                  The primary key name is the Prisma field name that appears in the model. It is not the database constraint name.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                    <p className="text-sm font-semibold text-slate-900">Recommended</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      Use <code className="rounded bg-white px-1 py-0.5 font-mono text-xs text-slate-700">id</code> for new tables unless you are matching an existing database.
                    </p>
                  </div>
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                    <p className="text-sm font-semibold text-slate-900">Allowed format</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      Start with a letter. Use only letters, numbers, and underscores. Prefer camelCase.
                    </p>
                  </div>
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                    <p className="text-sm font-semibold text-slate-900">Legacy schemas</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      Names like <code className="rounded bg-white px-1 py-0.5 font-mono text-xs text-slate-700">userId</code> are fine when the source schema already uses them.
                    </p>
                  </div>
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                    <p className="text-sm font-semibold text-slate-900">Generated line</p>
                    <code className="mt-2 block overflow-x-auto whitespace-nowrap rounded bg-white px-2 py-2 font-mono text-xs text-slate-700">
                      {pkExampleLine(pkName, pkType, activeProvider)}
                    </code>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {diffDetail ? (
        <TableDiffDetailModal
          tableDiff={diffDetail}
          fromVersion={previousVersion}
          toVersion={version}
          onClose={() => setDiffDetail(null)}
        />
      ) : null}
    </div>
  );
}
