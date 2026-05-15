"use client";

import { useCallback, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useDashboard } from "../shared/dashboard-context";
import {
  classNames,
  defaultSchemaOptions,
  graphqlOptions,
  prismaClients,
  providers,
  type Project,
} from "../shared/dashboard-data";
import { useRouter } from "next/navigation";

function incrementVersion(version: string): string {
  const dotIdx = version.lastIndexOf(".");
  if (dotIdx === -1) return `${version}.0002`;
  const major = version.slice(0, dotIdx);
  const minor = version.slice(dotIdx + 1);
  const next = (parseInt(minor, 10) + 1).toString().padStart(minor.length, "0");
  return `${major}.${next}`;
}

export function ProjectsPageContent() {
  const {
    activeProject,
    activeProjectId,
    activeVersions,
    createProject,
    deleteProject,
    forkVersion,
    projects,
    selectedVersion,
    setActiveProjectId,
    setSelectedVersion,
    updateProject,
  } = useDashboard();
  const router = useRouter();
  const [projectName, setProjectName] = useState("");
  const [projectProvider, setProjectProvider] = useState(providers[0]);
  const [projectClient, setProjectClient] = useState(defaultSchemaOptions.client);
  const [projectGraphql, setProjectGraphql] = useState(
    defaultSchemaOptions.graphql,
  );
  const [forkingVersion, setForkingVersion] = useState(false);
  const [showForkConfirm, setShowForkConfirm] = useState(false);
  const [forkError, setForkError] = useState("");
  const [createError, setCreateError] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editProjectName, setEditProjectName] = useState("");
  const [editProjectProvider, setEditProjectProvider] = useState(providers[0]);
  const [editProjectClient, setEditProjectClient] = useState(
    defaultSchemaOptions.client,
  );
  const [editProjectGraphql, setEditProjectGraphql] = useState(
    defaultSchemaOptions.graphql,
  );
  const [editError, setEditError] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [savingProjectId, setSavingProjectId] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetConfirmation, setResetConfirmation] = useState("");
  const [isResetting, setIsResetting] = useState(false);
  const [resetError, setResetError] = useState("");
  const [versionScroll, setVersionScroll] = useState({
    canScrollDown: false,
    canScrollUp: false,
  });
  const versionListRef = useRef<HTMLDivElement>(null);

  const submitProject = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedProjectName = projectName.trim();
    const nameExists = projects.some(
      (project) =>
        project.name.trim().toLowerCase() === trimmedProjectName.toLowerCase(),
    );

    if (trimmedProjectName.length < 8) {
      setCreateError("Project name must be at least 8 characters.");
      return;
    }

    if (nameExists) {
      setCreateError("Project name must be unique.");
      return;
    }

    try {
      setIsCreating(true);
      setCreateError("");
      await createProject(trimmedProjectName, projectProvider, {
        client: projectClient,
        graphql: projectGraphql,
      });
      setProjectName("");
      setProjectProvider(providers[0]);
      setProjectClient(defaultSchemaOptions.client);
      setProjectGraphql(defaultSchemaOptions.graphql);
    } catch (error) {
      setCreateError(
        error instanceof Error ? error.message : "Project could not be created.",
      );
    } finally {
      setIsCreating(false);
    }
  };

  const trimmedProjectName = projectName.trim();
  const isProjectNameTooShort =
    trimmedProjectName.length > 0 && trimmedProjectName.length < 8;
  const isProjectNameDuplicate = projects.some(
    (project) =>
      project.name.trim().toLowerCase() === trimmedProjectName.toLowerCase(),
  );
  const canCreateProject =
    trimmedProjectName.length >= 8 &&
    !isProjectNameDuplicate &&
    !isCreating;

  const startProjectEdit = (project: Project) => {
    setEditingProjectId(project.id);
    setEditProjectName(project.name.trim() || "Untitled");
    setEditProjectProvider(project.provider);
    setEditProjectClient(project.schemaOptions.client);
    setEditProjectGraphql(project.schemaOptions.graphql);
    setEditError("");
  };

  const cancelProjectEdit = () => {
    setEditingProjectId(null);
    setEditProjectName("");
    setEditProjectProvider(providers[0]);
    setEditProjectClient(defaultSchemaOptions.client);
    setEditProjectGraphql(defaultSchemaOptions.graphql);
    setEditError("");
  };

  const saveProjectEdit = async (project: Project) => {
    const trimmedName = editProjectName.trim();
    const nameExists = projects.some(
      (currentProject) =>
        currentProject.id !== project.id &&
        currentProject.name.trim().toLowerCase() === trimmedName.toLowerCase(),
    );

    if (trimmedName.length < 8) {
      setEditError("Project name must be at least 8 characters.");
      return;
    }

    if (nameExists) {
      setEditError("Project name must be unique.");
      return;
    }

    try {
      setSavingProjectId(project.id);
      setEditError("");
      await updateProject(project.id, trimmedName, editProjectProvider, {
        client: editProjectClient,
        graphql: editProjectGraphql,
      });
      cancelProjectEdit();
    } catch (error) {
      setEditError(
        error instanceof Error ? error.message : "Project could not be updated.",
      );
    } finally {
      setSavingProjectId(null);
    }
  };

  const closeDeleteDialog = () => {
    setDeleteTarget(null);
    setDeleteConfirmation("");
  };

  const confirmDelete = async () => {
    if (!deleteTarget || deleteConfirmation !== deleteTarget.name) {
      return;
    }

    const wasActive = deleteTarget.id === activeProjectId;

    try {
      setIsDeleting(true);
      await deleteProject(deleteTarget.id);
      closeDeleteDialog();

      if (wasActive) {
        const remaining = projects.filter((p) => p.id !== deleteTarget.id);
        if (remaining.length > 0) {
          router.push("/projects");
        } else {
          router.push("/");
        }
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const confirmReset = async () => {
    if (resetConfirmation !== "RESET") return;
    setIsResetting(true);
    setResetError("");
    try {
      const res = await fetch("/api/reset", { method: "POST" });
      const data = await res.json() as { success: boolean; error?: string };
      if (!data.success) throw new Error(data.error ?? "Reset failed.");
      setShowResetConfirm(false);
      setResetConfirmation("");
      router.push("/");
    } catch (err) {
      setResetError(err instanceof Error ? err.message : "Reset failed.");
    } finally {
      setIsResetting(false);
    }
  };

  const updateVersionScrollControls = useCallback(
    (node: HTMLDivElement | null = versionListRef.current) => {
      if (!node) {
        setVersionScroll({ canScrollDown: false, canScrollUp: false });
        return;
      }

      const maxScrollTop = node.scrollHeight - node.clientHeight;

      setVersionScroll({
        canScrollDown: node.scrollTop < maxScrollTop - 1,
        canScrollUp: node.scrollTop > 1,
      });
    },
    [],
  );

  const setVersionListNode = useCallback(
    (node: HTMLDivElement | null) => {
      versionListRef.current = node;

      if (!node) {
        setVersionScroll({ canScrollDown: false, canScrollUp: false });
        return;
      }

      requestAnimationFrame(() => updateVersionScrollControls(node));
    },
    [updateVersionScrollControls],
  );

  const scrollVersions = (direction: "up" | "down") => {
    const versionList = versionListRef.current;

    if (!versionList) {
      return;
    }

    versionList.scrollBy({
      top: direction === "up" ? -96 : 96,
      behavior: "smooth",
    });

    window.setTimeout(() => updateVersionScrollControls(versionList), 180);
  };

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
                Projects workspace
              </h3>
            </div>
            <span className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
              {projects.length} projects
            </span>
          </div>
        </div>

        <div className="grid gap-0 xl:grid-cols-[360px_minmax(0,1fr)]">
          <form
            onSubmit={submitProject}
            className="border-b border-slate-200 p-5 xl:border-b-0 xl:border-r"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              Create Project
            </p>
            <label
              htmlFor="new-project-name"
              className="mt-5 block text-sm font-semibold text-slate-700"
            >
              Project name
            </label>
            <input
              id="new-project-name"
              value={projectName}
              onChange={(event) => {
                setProjectName(event.target.value);
                setCreateError("");
              }}
              className="mt-2 h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-emerald-600"
              placeholder="Customer Portal"
            />
            {isProjectNameTooShort ? (
              <p className="mt-2 text-sm font-medium text-rose-600">
                Project name must be at least 8 characters.
              </p>
            ) : null}
            {isProjectNameDuplicate && trimmedProjectName.length >= 8 ? (
              <p className="mt-2 text-sm font-medium text-rose-600">
                Project name must be unique.
              </p>
            ) : null}

            <label
              htmlFor="new-project-provider"
              className="mt-5 block text-sm font-semibold text-slate-700"
            >
              DB provider
            </label>
            <select
              id="new-project-provider"
              value={projectProvider}
              onChange={(event) => setProjectProvider(event.target.value)}
              className="mt-2 h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-950 outline-none transition focus:border-emerald-600"
            >
              {providers.map((provider) => (
                <option key={provider} value={provider}>
                  {provider}
                </option>
              ))}
            </select>

            <div className="mt-5 grid gap-4 border-t border-slate-200 pt-5">
              <label
                htmlFor="new-project-client"
                className="block text-sm font-semibold text-slate-700"
              >
                Prisma client
              </label>
              <select
                id="new-project-client"
                value={projectClient}
                onChange={(event) => setProjectClient(event.target.value)}
                className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-950 outline-none transition focus:border-emerald-600"
              >
                {prismaClients.map((client) => (
                  <option key={client} value={client}>
                    {client}
                  </option>
                ))}
              </select>

              <label
                htmlFor="new-project-graphql"
                className="block text-sm font-semibold text-slate-700"
              >
                GraphQL option
              </label>
              <select
                id="new-project-graphql"
                value={projectGraphql}
                onChange={(event) => setProjectGraphql(event.target.value)}
                className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-950 outline-none transition focus:border-emerald-600"
              >
                {graphqlOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            {createError ? (
              <p className="mt-3 text-sm font-semibold text-rose-600">
                {createError}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={!canCreateProject}
              className="mt-5 h-10 w-full rounded-md bg-[#1f7a55] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#186648] disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {isCreating ? "Creating..." : "Create Project"}
            </button>
          </form>

          <div className="p-5">
            <div className="grid min-h-[640px] grid-rows-2 gap-5">
              <section className="min-h-0">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                      Project Selection
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      Choose a project to display in the left-side info section.
                    </p>
                  </div>
                </div>

                <div className="mt-5 overflow-x-auto rounded-lg border border-slate-200">
                  <div className="min-w-[1280px]">
                    <div className="grid grid-cols-[minmax(190px,1.2fr)_130px_150px_220px_64px_64px_84px_78px_86px_72px_86px] bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                      <span>Project</span>
                      <span>DB</span>
                      <span>Client</span>
                      <span>GraphQL</span>
                      <span>Tables</span>
                      <span>Fields</span>
                      <span>Relations</span>
                      <span>Versions</span>
                      <span>Status</span>
                      <span>Edit</span>
                      <span>Delete</span>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {projects.length === 0 ? (
                        <div className="px-4 py-10 text-center text-sm font-medium text-slate-500">
                          No projects created yet.
                        </div>
                      ) : null}
                      {projects.map((project) => {
                        const selected = project.id === activeProjectId;
                        const isEditing = project.id === editingProjectId;
                        const isSaving = project.id === savingProjectId;

                        return (
                          <div
                            key={project.id}
                            className={classNames(
                              "grid grid-cols-[minmax(190px,1.2fr)_130px_150px_220px_64px_64px_84px_78px_86px_72px_86px] items-center gap-y-2 px-4 py-4 text-left text-sm transition",
                              selected
                                ? "bg-[#f9faf5]"
                                : "bg-white hover:bg-slate-50",
                            )}
                          >
                            {isEditing ? (
                              <div className="min-w-0 pr-3">
                                <input
                                  value={editProjectName}
                                  onChange={(event) => {
                                    setEditProjectName(event.target.value);
                                    setEditError("");
                                  }}
                                  className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-emerald-600"
                                  aria-label="Project name"
                                />
                                {editError ? (
                                  <p className="mt-1 text-xs font-semibold text-rose-600">
                                    {editError}
                                  </p>
                                ) : null}
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveProjectId(project.id);
                                  router.push("/tables");
                                }}
                                className="min-w-0 truncate pr-3 text-left font-semibold text-slate-950"
                              >
                                <span>{project.name.trim() || "Untitled"}</span>
                                <span className="ml-2 font-mono text-xs text-slate-400">({project.id})</span>
                              </button>
                            )}
                            {isEditing ? (
                              <select
                                value={editProjectProvider}
                                onChange={(event) =>
                                  setEditProjectProvider(event.target.value)
                                }
                                className="mr-3 h-9 rounded-md border border-slate-300 bg-white px-2 text-sm font-medium text-slate-950 outline-none transition focus:border-emerald-600"
                                aria-label="DB provider"
                              >
                                {providers.map((provider) => (
                                  <option key={provider} value={provider}>
                                    {provider}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span className="truncate pr-3 text-slate-600">
                                {project.provider}
                              </span>
                            )}
                            {isEditing ? (
                              <select
                                value={editProjectClient}
                                onChange={(event) =>
                                  setEditProjectClient(event.target.value)
                                }
                                className="mr-3 h-9 rounded-md border border-slate-300 bg-white px-2 text-sm font-medium text-slate-950 outline-none transition focus:border-emerald-600"
                                aria-label="Prisma client"
                              >
                                {prismaClients.map((client) => (
                                  <option key={client} value={client}>
                                    {client}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span className="truncate pr-3 text-slate-600">
                                {project.schemaOptions.client}
                              </span>
                            )}
                            {isEditing ? (
                              <select
                                value={editProjectGraphql}
                                onChange={(event) =>
                                  setEditProjectGraphql(event.target.value)
                                }
                                className="mr-3 h-9 rounded-md border border-slate-300 bg-white px-2 text-sm font-medium text-slate-950 outline-none transition focus:border-emerald-600"
                                aria-label="GraphQL stack"
                              >
                                {graphqlOptions.map((option) => (
                                  <option key={option} value={option}>
                                    {option}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span className="truncate pr-3 text-slate-600">
                                {project.schemaOptions.graphql}
                              </span>
                            )}
                            <span className="text-slate-600">
                              {project.tables}
                            </span>
                            <span className="text-slate-600">
                              {project.fields}
                            </span>
                            <span className="text-slate-600">
                              {project.relations}
                            </span>
                            <span className="text-slate-600">
                              {project.versions.length}
                            </span>
                            <span
                              className={classNames(
                                "w-fit rounded-md px-2 py-1 text-xs font-bold",
                                selected
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-slate-100 text-slate-600",
                              )}
                            >
                              {selected ? "Active" : project.health}
                            </span>
                            <div className="flex items-center gap-1">
                              {isEditing ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => saveProjectEdit(project)}
                                    disabled={isSaving}
                                    className="grid h-8 w-8 place-items-center rounded-md border border-emerald-200 bg-white text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:text-slate-400"
                                    aria-label="Save project changes"
                                  >
                                    <CheckIcon />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={cancelProjectEdit}
                                    disabled={isSaving}
                                    className="grid h-8 w-8 place-items-center rounded-md border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
                                    aria-label="Cancel project edit"
                                  >
                                    <CloseIcon />
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => startProjectEdit(project)}
                                  className="grid h-8 w-8 place-items-center rounded-md border border-slate-200 bg-white text-slate-600 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
                                  aria-label="Edit project"
                                >
                                  <PencilIcon />
                                </button>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(project)}
                              disabled={isEditing}
                              className="h-8 rounded-md border border-rose-200 bg-white px-3 text-xs font-bold text-rose-700 transition hover:border-rose-300 hover:bg-rose-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
                            >
                              Delete
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </section>

              <section className="grid min-h-0 grid-rows-[auto_auto_1fr_auto] rounded-lg border border-slate-200 bg-[#fbfcff] p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Project Versions
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  {activeProject
                    ? `${activeProject.name.trim() || "Untitled"} has ${
                        activeVersions.length
                      } saved version${activeVersions.length === 1 ? "" : "s"}.`
                    : "Create a project to initialize version history."}
                </p>

                {versionScroll.canScrollUp ? (
                  <button
                    type="button"
                    onClick={() => scrollVersions("up")}
                    className="mt-5 h-9 rounded-md border border-slate-300 bg-white text-sm font-bold text-slate-600 transition hover:border-slate-400 hover:bg-slate-50"
                    aria-label="Scroll versions up"
                  >
                    ▲
                  </button>
                ) : null}

                <div
                  key={activeProjectId}
                  ref={setVersionListNode}
                  onScroll={() => updateVersionScrollControls()}
                  className="mt-3 min-h-0 space-y-2 overflow-y-auto pr-1"
                >
                  {activeVersions.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-300 bg-white p-5 text-sm font-medium text-slate-500">
                      No versions available.
                    </div>
                  ) : null}
                  {activeVersions.map((version) => (
                    <button
                      key={version}
                      type="button"
                      onClick={() => setSelectedVersion(version)}
                      className={classNames(
                        "w-full rounded-lg border p-3 text-left text-sm font-semibold transition",
                        version === selectedVersion
                          ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
                      )}
                    >
                      {version}
                    </button>
                  ))}
                </div>

                {versionScroll.canScrollDown ? (
                  <button
                    type="button"
                    onClick={() => scrollVersions("down")}
                    className="mt-3 h-9 rounded-md border border-slate-300 bg-white text-sm font-bold text-slate-600 transition hover:border-slate-400 hover:bg-slate-50"
                    aria-label="Scroll versions down"
                  >
                    ▼
                  </button>
                ) : null}

                {activeProject && (
                  <div className="mt-4 space-y-2 border-t border-slate-200 pt-4">
                    {forkError && (
                      <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                        {forkError}
                      </p>
                    )}
                    <button
                      type="button"
                      disabled={forkingVersion || activeVersions.length === 0}
                      onClick={() => { setForkError(""); setShowForkConfirm(true); }}
                      className="w-full rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {forkingVersion ? "Creating…" : "+ Create new version"}
                    </button>
                  </div>
                )}
              </section>
            </div>
          </div>
        </div>
      </section>

      {showForkConfirm && activeProject && (() => {
        const sourceVersion = activeVersions[activeVersions.length - 1] ?? "";
        const nextVersion = incrementVersion(sourceVersion);
        return (
          <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 px-4">
            <section
              role="dialog"
              aria-modal="true"
              className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-5 shadow-2xl"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Confirm New Version
              </p>
              <h3 className="mt-1 text-lg font-semibold text-slate-950">
                Create a new version?
              </h3>
              <div className="mt-4 space-y-2">
                <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-semibold text-slate-500">Selected version (source)</p>
                  <p className="mt-0.5 font-mono text-sm font-semibold text-slate-950">
                    {sourceVersion}
                  </p>
                </div>
                <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3">
                  <p className="text-xs font-semibold text-emerald-600">New version (clone)</p>
                  <p className="mt-0.5 font-mono text-sm font-semibold text-emerald-800">
                    {nextVersion}
                  </p>
                </div>
                <p className="text-sm text-slate-600">
                  All models, fields, relations, and restrictions from{" "}
                  <span className="font-semibold">{sourceVersion}</span> will be copied into{" "}
                  <span className="font-semibold">{nextVersion}</span>. Do you confirm?
                </p>
              </div>
              <div className="mt-5 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowForkConfirm(false)}
                  className="h-9 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={forkingVersion}
                  onClick={async () => {
                    setForkingVersion(true);
                    setForkError("");
                    setShowForkConfirm(false);
                    try {
                      await forkVersion(activeProjectId);
                    } catch (err) {
                      setForkError(
                        err instanceof Error ? err.message : "Could not create version.",
                      );
                    } finally {
                      setForkingVersion(false);
                    }
                  }}
                  className="h-9 min-w-24 rounded-md bg-slate-800 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {forkingVersion ? "Creating…" : "Confirm"}
                </button>
              </div>
            </section>
          </div>
        );
      })()}

      {/* ── Danger Zone ─────────────────────────────────────────────────── */}
      <div className="mt-8 rounded-lg border border-rose-200 bg-rose-50 p-5">
        <h3 className="text-sm font-semibold text-rose-700">Danger Zone</h3>
        <div className="mt-3 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-slate-900">Reset all data</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Permanently deletes all projects, schemas, and generated artifacts. Cannot be undone.
            </p>
          </div>
          <button
            type="button"
            onClick={() => { setShowResetConfirm(true); setResetConfirmation(""); setResetError(""); }}
            className="shrink-0 h-9 rounded-md border border-rose-300 bg-white px-4 text-sm font-semibold text-rose-700 transition hover:bg-rose-600 hover:text-white hover:border-rose-600"
          >
            Reset All Data
          </button>
        </div>
        {resetError && <p className="mt-2 text-xs text-rose-600">{resetError}</p>}
      </div>

      {showResetConfirm ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 px-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="reset-dialog-title"
            className="w-full max-w-lg rounded-lg border border-slate-200 bg-white p-5 shadow-2xl"
          >
            <h3 id="reset-dialog-title" className="text-lg font-semibold text-slate-950">
              Reset all data
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              This will permanently delete every project, all schema versions, relations, fields,
              restrictions, and all generated files. Type{" "}
              <span className="font-mono font-semibold text-rose-600">RESET</span> to confirm.
            </p>
            <input
              value={resetConfirmation}
              onChange={(e) => setResetConfirmation(e.target.value)}
              placeholder="RESET"
              className="mt-4 h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-rose-500"
            />
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="h-10 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-400"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmReset}
                disabled={resetConfirmation !== "RESET" || isResetting}
                className="h-10 rounded-md bg-rose-600 px-4 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {isResetting ? "Resetting…" : "Reset Everything"}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {deleteTarget ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 px-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-project-title"
            className="w-full max-w-lg rounded-lg border border-slate-200 bg-white p-5 shadow-2xl"
          >
            <h3
              id="delete-project-title"
              className="text-lg font-semibold text-slate-950"
            >
              You are about to delete project
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Type the project name exactly to confirm deletion. This will remove
              the project from the JSON project store.
            </p>
            <p className="mt-4 rounded-md bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-900">
              {deleteTarget.name}
            </p>

            <label
              htmlFor="delete-project-name"
              className="mt-5 block text-sm font-semibold text-slate-700"
            >
              Copy project name
            </label>
            <input
              id="delete-project-name"
              value={deleteConfirmation}
              onChange={(event) => setDeleteConfirmation(event.target.value)}
              className="mt-2 h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-rose-500"
              placeholder={deleteTarget.name}
            />

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeDeleteDialog}
                className="h-10 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-400"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleteConfirmation !== deleteTarget.name || isDeleting}
                className="h-10 rounded-md bg-rose-600 px-4 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {isDeleting ? "Deleting..." : "Delete Project"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function PencilIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
    >
      <path d="M12 20h9" />
      <path d="m16.5 3.5 4 4L7 21H3v-4L16.5 3.5z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
    >
      <path d="m20 6-11 11-5-5" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}
