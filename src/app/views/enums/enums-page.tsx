"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { IconPencil, IconTrash } from "@tabler/icons-react";
import { useEnumsQuery, useEnumMutations } from "@/queries/enums";
import { useProjectInfo } from "../shared/project-info-context";
import { useVersionDiff, useVersionDiffLookup } from "@/hooks/use-version-diff";
import { useSchemaWarnings } from "@/hooks/use-schema-warnings";
import Link from "next/link";
import { VersionDiffBadge, ApproveWarningButton } from "@/components/shared/version-diff-badge";
import { EnumValueReplacementPicker } from "@/components/enums/enum-value-replacement-picker";
import { EnumEditPanel, type CanonicalEnum } from "@/components/enums/enum-edit-panel";
import { validateEnumName } from "@/constants/enums";
import { EmptyState, LoadingCard } from "@/components/built";

export function EnumsPageContent() {
  const { projectName, version, versions, provider, hasProject, projectId } = useProjectInfo();
  const isSQLite = provider === "SQLite";
  const versionIdx = versions.indexOf(version);
  const previousVersion = versionIdx > 0 ? versions[versionIdx - 1]! : "";
  const { getWarning, approve, unapprove } = useSchemaWarnings(projectId, previousVersion, version);

  const [enumName, setEnumName] = useState("");
  const [createError, setCreateError] = useState("");
  const [editingEnum, setEditingEnum] = useState<CanonicalEnum | null>(null);
  const [search, setSearch] = useState("");
  const [confirmDeleteName, setConfirmDeleteName] = useState("");

  const { data: versionDiff } = useVersionDiff(projectName, version);
  const { diffByEnumId } = useVersionDiffLookup(projectName, version);

  const listQuery = useEnumsQuery(projectName, version);
  const enums: CanonicalEnum[] = listQuery.data ?? [];
  const { invalidate, create: createMutation, delete: deleteMutation } = useEnumMutations(projectName, version);

  const submitCreate = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const err = validateEnumName(enumName);
    if (err) { setCreateError(err); return; }
    createMutation.mutate(
      { projectName, version, name: enumName.trim() },
      {
        onSuccess: () => { void invalidate(); setEnumName(""); setCreateError(""); },
        onError: (err) => setCreateError(err.message),
      },
    );
  };

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

          <div className="p-5">
            {listQuery.isLoading ? (
              <LoadingCard bordered={false} />
            ) : editingEnumLive ? (
              <EnumEditPanel
                enumEntry={editingEnumLive}
                projectName={projectName}
                version={version}
                onDone={() => setEditingEnum(null)}
              />
            ) : enums.length === 0 ? (
              <EmptyState message="No enums yet. Add your first enum using the form." />
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
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-red-800">
                          {removedEnumDiffs.length} enum{removedEnumDiffs.length > 1 ? "s" : ""} removed since {versionDiff?.fromVersion}
                        </p>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {removedEnumDiffs.map((d) => (
                            <span key={d.enumId} className="rounded border border-red-300 bg-white px-2 py-0.5 font-mono text-[11px] font-semibold text-red-700 line-through">
                              {d.enumName}
                            </span>
                          ))}
                        </div>
                        <p className="mt-2 text-xs text-red-600">
                          Review and approve these changes in the Tracking workflow before running a migration.
                        </p>
                      </div>
                      <Link
                        href="/tracking?resolve=enums"
                        className="flex shrink-0 items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3 py-2 text-xs font-semibold text-red-700 shadow-sm transition hover:bg-red-50 hover:border-red-400"
                      >
                        Go to Tracking →
                      </Link>
                    </div>
                  </div>
                )}

                {filteredEnums.length === 0 ? (
                  <EmptyState message="No enums match your search." />
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

                      const cardBg = enumDiff
                        ? enumDiff.severity === "breaking" ? "bg-rose-50/40"
                          : enumDiff.severity === "warning" ? "bg-amber-50/40"
                          : "bg-sky-50/30"
                        : "bg-white";

                      // Badge severity — only for breaking/warning (not new enums)
                      const showBadge = !!enumDiff && enumDiff.severity !== "info";

                      // Build tooltip lines
                      const badgeLines: string[] = [];
                      if (removedValueNames.length > 0)
                        badgeLines.push(`${removedValueNames.length} value${removedValueNames.length > 1 ? "s" : ""} removed: ${removedValueNames.join(", ")}`);
                      if (addedValueNames.size > 0 && enumDiff?.changeKind !== "added")
                        badgeLines.push(`${addedValueNames.size} value${addedValueNames.size > 1 ? "s" : ""} added: ${[...addedValueNames].join(", ")}`);
                      if (enumDiff?.changeKind === "removed")
                        badgeLines.push("Entire enum removed — all fields using it are affected.");

                      return (
                      <div
                        key={enumEntry.name}
                        className={`relative rounded-lg border transition hover:border-indigo-200 ${cardBorder} ${cardBg} ${showBadge ? "px-4 pb-4 pt-6" : "p-4"}`}
                      >
                        {/* Warning badge — top-left corner, only on badge hover */}
                        {showBadge && (
                          <div className="group/badge pointer-events-auto absolute -left-2 -top-4 z-20">
                            <div className={`flex h-8 w-8 cursor-help items-center justify-center rounded-full shadow-lg ring-2 ring-white transition-transform duration-100 group-hover/badge:scale-110 ${enumDiff!.severity === "breaking" ? "bg-rose-500" : "bg-amber-400"}`}>
                              <span className="select-none text-[18px] font-black leading-none text-white">!</span>
                            </div>
                            <div className="pointer-events-none absolute left-0 top-full z-30 mt-2 w-[420px] opacity-0 transition-opacity duration-150 group-hover/badge:opacity-100">
                              <div className={`rounded-xl border px-5 py-4 shadow-xl bg-white ${enumDiff!.severity === "breaking" ? "border-rose-200 text-rose-700" : "border-amber-200 text-amber-700"}`}>
                                <p className="text-[10px] font-bold uppercase tracking-wider opacity-40">
                                  {enumDiff!.severity === "breaking" ? "Breaking Change" : "Warning"}
                                </p>
                                <p className="mt-1.5 text-sm font-semibold">{enumEntry.name}</p>
                                <ul className="mt-2 space-y-1">
                                  {badgeLines.map((line, i) => (
                                    <li key={i} className="text-xs leading-relaxed opacity-80">• {line}</li>
                                  ))}
                                </ul>
                                <p className="mt-3 text-[11px] opacity-50">Review and approve in the Tracking workflow before running a migration.</p>
                              </div>
                            </div>
                          </div>
                        )}
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
                            {enumDiff?.changeKind === "removed" && (
                              <ApproveWarningButton
                                warning={getWarning("enum", enumEntry.enumId, "removed")}
                                onApprove={approve}
                                onUnapprove={unapprove}
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
                                {removedValueNames.map((v) => (
                                  <EnumValueReplacementPicker
                                    key={v}
                                    warning={getWarning("enum", `${enumEntry.enumId}:${v}`, "value_removed")}
                                    removedValue={v}
                                    availableValues={enumEntry.values.map((ev) => ev.name)}
                                    onApprove={approve}
                                    onUnapprove={unapprove}
                                  />
                                ))}
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
                onClick={() => deleteMutation.mutate({ projectName, version, name: confirmDeleteName }, { onSuccess: () => { void invalidate(); setConfirmDeleteName(""); } })}
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
