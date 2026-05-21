"use client";

import { useCallback, useRef, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { useDashboard, useActiveProject } from "../shared/dashboard-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  classNames,
  defaultSchemaOptions,
  graphqlOptions,
  prismaClients,
  providers,
  type Project,
} from "../shared/dashboard-data";
import { useRouter } from "next/navigation";

// ─── Schema ───────────────────────────────────────────────────────────────────

const projectFormSchema = z.object({
  name: z.string().min(8, "Project name must be at least 8 characters."),
  provider: z.enum(["Postgres", "MySQL", "SQLite"] as const),
  client: z.string().min(1),
  graphql: z.string().min(1),
});
type ProjectFormValues = z.infer<typeof projectFormSchema>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function incrementVersion(version: string): string {
  const dotIdx = version.lastIndexOf(".");
  if (dotIdx === -1) return `${version}.0002`;
  const major = version.slice(0, dotIdx);
  const minor = version.slice(dotIdx + 1);
  const next = (parseInt(minor, 10) + 1).toString().padStart(minor.length, "0");
  return `${major}.${next}`;
}

const providerConfig: Record<string, { border: string; badge: string; dot: string }> = {
  Postgres: {
    border: "border-l-blue-500",
    badge: "border-blue-200 bg-blue-50 text-blue-700",
    dot: "bg-blue-500",
  },
  MySQL: {
    border: "border-l-amber-500",
    badge: "border-amber-200 bg-amber-50 text-amber-700",
    dot: "bg-amber-500",
  },
  SQLite: {
    border: "border-l-emerald-500",
    badge: "border-emerald-200 bg-emerald-50 text-emerald-700",
    dot: "bg-emerald-500",
  },
};

const inlineSelectCls =
  "h-8 rounded-md border border-slate-300 bg-white px-2 text-xs font-medium text-slate-950 outline-none transition focus:border-emerald-600";

// ─── Component ────────────────────────────────────────────────────────────────

export function ProjectsPageContent() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data: projects = [] } = useQuery(trpc.projects.list.queryOptions());
  const activeProject = useActiveProject();
  const { activeProjectId, selectedVersion, setActiveProjectId, setSelectedVersion } = useDashboard();
  const activeVersions = activeProject?.versions.map((v) => v.name) ?? [];
  const sourceVersion = activeVersions.at(-1) ?? "";
  const nextVersion = sourceVersion ? incrementVersion(sourceVersion) : "";
  const router = useRouter();

  // ── Forms ──────────────────────────────────────────────────────────────────

  const createForm = useForm<ProjectFormValues>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: {
      name: "",
      provider: "Postgres",
      client: defaultSchemaOptions.client,
      graphql: defaultSchemaOptions.graphql,
    },
  });

  const editForm = useForm<ProjectFormValues>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: { name: "", provider: "Postgres", client: "", graphql: "" },
  });

  // ── Mutations ──────────────────────────────────────────────────────────────

  const invalidateProjects = () =>
    queryClient.invalidateQueries({ queryKey: trpc.projects.list.queryOptions().queryKey });

  const createMutation = useMutation({
    ...trpc.projects.create.mutationOptions(),
    onSuccess: (project) => {
      void invalidateProjects();
      if (project) setActiveProjectId(project.id);
    },
  });

  const updateMutation = useMutation({
    ...trpc.projects.update.mutationOptions(),
    onSuccess: () => { void invalidateProjects(); },
  });

  const deleteMutation = useMutation({
    ...trpc.projects.delete.mutationOptions(),
    onSuccess: () => { void invalidateProjects(); },
  });

  const forkMutation = useMutation({
    ...trpc.projects.forkVersion.mutationOptions(),
    onSuccess: (result) => {
      void invalidateProjects();
      if (result) setSelectedVersion(result.newVersion);
    },
  });

  // ── State ──────────────────────────────────────────────────────────────────

  const forkingVersion = forkMutation.isPending;
  const isCreating = createMutation.isPending;
  const isDeleting = deleteMutation.isPending;
  const [showForkConfirm, setShowForkConfirm] = useState(false);
  const [forkError, setForkError] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [savingProjectId, setSavingProjectId] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetConfirmation, setResetConfirmation] = useState("");
  const [isResetting, setIsResetting] = useState(false);
  const [resetError, setResetError] = useState("");
  const [versionScroll, setVersionScroll] = useState({ canScrollDown: false, canScrollUp: false });
  const versionListRef = useRef<HTMLDivElement>(null);

  // ── Create handler ─────────────────────────────────────────────────────────

  const nameValue = createForm.watch("name");
  const isNameDuplicate = projects.some(
    (p) => p.name.trim().toLowerCase() === nameValue.trim().toLowerCase(),
  );
  const canCreateProject = !isCreating && !isNameDuplicate && createForm.formState.isValid;

  const onCreateSubmit = createForm.handleSubmit((data) => {
    createMutation.mutate(
      {
        name: data.name.trim(),
        provider: data.provider,
        schemaOptions: { client: data.client, graphql: data.graphql },
      },
      {
        onSuccess: () => createForm.reset(),
        onError: (err) => createForm.setError("root", { message: err.message }),
      },
    );
  });

  // ── Edit handlers ──────────────────────────────────────────────────────────

  const startProjectEdit = (project: Project) => {
    setEditingProjectId(project.id);
    editForm.reset({
      name: project.name.trim(),
      provider: project.provider as "Postgres" | "MySQL" | "SQLite",
      client: project.schemaOptions.client,
      graphql: project.schemaOptions.graphql,
    });
  };

  const cancelProjectEdit = () => {
    setEditingProjectId(null);
    editForm.reset();
  };

  const saveProjectEdit = editForm.handleSubmit((data) => {
    if (!editingProjectId) return;
    setSavingProjectId(editingProjectId);
    updateMutation.mutate(
      {
        id: editingProjectId,
        name: data.name.trim(),
        provider: data.provider,
        schemaOptions: { client: data.client, graphql: data.graphql },
      },
      {
        onSuccess: () => { setSavingProjectId(null); cancelProjectEdit(); },
        onError: (err) => { setSavingProjectId(null); editForm.setError("root", { message: err.message }); },
      },
    );
  });

  // ── Delete / reset handlers ────────────────────────────────────────────────

  const closeDeleteDialog = () => { setDeleteTarget(null); setDeleteConfirmation(""); };

  const confirmDelete = () => {
    if (!deleteTarget || deleteConfirmation !== deleteTarget.name) return;
    const wasActive = deleteTarget.id === activeProjectId;
    deleteMutation.mutate(
      { id: deleteTarget.id },
      {
        onSuccess: (remaining) => {
          closeDeleteDialog();
          if (wasActive) router.push(remaining && remaining.length > 0 ? "/projects" : "/");
        },
      },
    );
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

  // ── Scroll helpers ─────────────────────────────────────────────────────────

  const updateVersionScrollControls = useCallback(
    (node: HTMLDivElement | null = versionListRef.current) => {
      if (!node) { setVersionScroll({ canScrollDown: false, canScrollUp: false }); return; }
      const max = node.scrollHeight - node.clientHeight;
      setVersionScroll({ canScrollDown: node.scrollTop < max - 1, canScrollUp: node.scrollTop > 1 });
    },
    [],
  );

  const setVersionListNode = useCallback(
    (node: HTMLDivElement | null) => {
      versionListRef.current = node;
      if (!node) { setVersionScroll({ canScrollDown: false, canScrollUp: false }); return; }
      requestAnimationFrame(() => updateVersionScrollControls(node));
    },
    [updateVersionScrollControls],
  );

  // ── JSX ────────────────────────────────────────────────────────────────────

  const pCfg = (provider: string) => providerConfig[provider] ?? providerConfig.Postgres;



  return (
    <div className="space-y-8">

      {/* ── Section header ───────────────────────────────────────────────── */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Schema Studio</p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Projects</h2>
        </div>
        <p className="shrink-0 text-sm text-slate-500">
          {projects.length} {projects.length === 1 ? "project" : "projects"}
        </p>
      </div>

      {/* ── Tabs ─────────────────────────────────────────────────────────── */}
      <Tabs defaultValue="projects" className="space-y-0">
        {/* Nav bar with bottom border */}
        <div className="-mx-5 border-b border-slate-200 px-5 md:-mx-8 md:px-8">
          <TabsList variant="line" className="h-auto gap-6 rounded-none bg-transparent p-0">
            <TabsTrigger
              value="projects"
              className="h-11 gap-2 rounded-none bg-transparent px-0 text-sm font-medium text-slate-500 shadow-none hover:text-slate-800 data-active:text-slate-900 data-active:shadow-none"
            >
              Projects
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold tabular-nums text-slate-600">
                {projects.length}
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="versions"
              className="h-11 gap-2 rounded-none bg-transparent px-0 text-sm font-medium text-slate-500 shadow-none hover:text-slate-800 data-active:text-slate-900 data-active:shadow-none"
            >
              Versions
              {activeProject && (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold tabular-nums text-slate-600">
                  {activeVersions.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ── Projects tab ────────────────────────────────────────────────── */}
        <TabsContent value="projects" className="mt-6 space-y-5">

          {/* Create form */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 bg-gradient-to-r from-emerald-50 to-white px-5 py-3">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-600">
                  <DatabaseIcon />
                </div>
                <span className="text-sm font-semibold text-slate-700">New Project</span>
              </div>
            </div>

            <Form {...createForm}>
              <form onSubmit={onCreateSubmit} className="p-5">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_180px_160px_auto]">
                  <FormField
                    control={createForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem className="gap-1">
                        <FormLabel className="text-xs font-semibold uppercase tracking-widest text-slate-400">Project name</FormLabel>
                        <FormControl>
                          <Input {...field} className="h-10" placeholder="e.g. Customer Portal" autoComplete="off" />
                        </FormControl>
                        {isNameDuplicate && field.value.trim().length >= 8 && (
                          <p className="text-[11px] font-medium text-rose-600">Name already exists.</p>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createForm.control}
                    name="provider"
                    render={({ field }) => (
                      <FormItem className="gap-1">
                        <FormLabel className="text-xs font-semibold uppercase tracking-widest text-slate-400">Provider</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger className="h-10 w-full">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {providers.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createForm.control}
                    name="client"
                    render={({ field }) => (
                      <FormItem className="gap-1">
                        <FormLabel className="text-xs font-semibold uppercase tracking-widest text-slate-400">Prisma client</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger className="h-10 w-full">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {prismaClients.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex items-end">
                    <Button type="submit" disabled={!canCreateProject} className="h-10 w-full">
                      {isCreating ? "Creating…" : "Create"}
                    </Button>
                  </div>
                </div>

                {/* GraphQL — secondary option, full row */}
                <div className="mt-3 flex items-center gap-3 border-t border-slate-100 pt-3">
                  <FormField
                    control={createForm.control}
                    name="graphql"
                    render={({ field }) => (
                      <FormItem className="flex items-center gap-3 space-y-0">
                        <FormLabel className="shrink-0 text-xs font-medium text-slate-400">GraphQL</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger className="h-8 w-64">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {graphqlOptions.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {createForm.formState.errors.root && (
                  <p className="mt-2 text-sm font-semibold text-rose-600">
                    {createForm.formState.errors.root.message}
                  </p>
                )}
              </form>
            </Form>
          </div>

          {/* Project list */}
          {projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-white py-20 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                <DatabaseIcon className="text-slate-400" />
              </div>
              <p className="mt-4 text-base font-semibold text-slate-700">No projects yet</p>
              <p className="mt-1 text-sm text-slate-500">Fill in the form above to create your first project.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {projects.map((project) => {
                const isActive = project.id === activeProjectId;
                const isEditing = editingProjectId === project.id;
                const isSaving = savingProjectId === project.id;
                const cfg = pCfg(project.provider);

                return (
                  <div
                    key={project.id}
                    onClick={!isEditing ? () => setActiveProjectId(project.id) : undefined}
                    className={classNames(
                      "overflow-hidden rounded-xl border border-l-4 shadow-sm transition-all",
                      !isEditing && "cursor-pointer",
                      isEditing
                        ? "border-l-amber-400 bg-white"
                        : isActive
                          ? "border-emerald-200 bg-emerald-50 ring-1 ring-emerald-200 hover:bg-emerald-100/60"
                          : `${cfg.border} border-slate-200 bg-white hover:bg-slate-50 hover:shadow-md`,
                    )}
                  >
                    {isEditing ? (
                      <div className="p-4 space-y-3">
                        <p className="text-xs font-semibold uppercase tracking-widest text-amber-600">Editing</p>
                        <div className="flex gap-3">
                          <Input
                            {...editForm.register("name")}
                            className="h-9 flex-1 font-semibold"
                            placeholder="Project name"
                          />
                          <Controller
                            control={editForm.control}
                            name="provider"
                            render={({ field }) => (
                              <Select value={field.value} onValueChange={field.onChange}>
                                <SelectTrigger className="h-9 w-32"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {providers.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            )}
                          />
                          <Controller
                            control={editForm.control}
                            name="client"
                            render={({ field }) => (
                              <Select value={field.value} onValueChange={field.onChange}>
                                <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {prismaClients.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            )}
                          />
                          <Controller
                            control={editForm.control}
                            name="graphql"
                            render={({ field }) => (
                              <Select value={field.value} onValueChange={field.onChange}>
                                <SelectTrigger className="h-9 flex-1"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {graphqlOptions.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            )}
                          />
                        </div>
                        {editForm.formState.errors.root && (
                          <p className="text-xs font-semibold text-rose-600">{editForm.formState.errors.root.message}</p>
                        )}
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={cancelProjectEdit} disabled={isSaving}>Cancel</Button>
                          <Button size="sm" onClick={saveProjectEdit} disabled={isSaving}>
                            {isSaving ? "Saving…" : "Save changes"}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-4 px-4 py-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2.5">
                            <span className={classNames("inline-block h-2 w-2 shrink-0 rounded-full", cfg.dot)} />
                            <button
                              type="button"
                              onClick={() => { setActiveProjectId(project.id); router.push("/tables"); }}
                              className="truncate text-sm font-semibold text-slate-900 hover:text-emerald-700 transition-colors"
                            >
                              {project.name.trim() || "Untitled"}
                            </button>
                            <span className="hidden font-mono text-[11px] text-slate-400 sm:inline">{project.id}</span>
                          </div>
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 pl-4">
                            <Badge variant="outline" className={classNames("text-[11px]", cfg.badge)}>{project.provider}</Badge>
                            <Badge variant="outline" className="border-slate-200 bg-slate-50 text-[11px] text-slate-500">{project.schemaOptions.client}</Badge>
                            {project.schemaOptions.graphql !== "None" && (
                              <Badge variant="outline" className="border-violet-200 bg-violet-50 text-[11px] text-violet-700">{project.schemaOptions.graphql}</Badge>
                            )}
                          </div>
                        </div>
                        <div className="hidden shrink-0 items-center gap-5 sm:flex">
                          <Stat label="tables" value={project.tables} />
                          <Stat label="fields" value={project.fields} />
                          <Stat label="relations" value={project.relations} />
                          <Stat label={project.versions.length === 1 ? "version" : "versions"} value={project.versions.length} />
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {isActive && (
                            <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">Active</Badge>
                          )}
                          <Button
                            variant="ghost" size="sm"
                            className="hidden text-slate-500 hover:text-emerald-700 md:inline-flex"
                            onClick={() => { setActiveProjectId(project.id); router.push("/tables"); }}
                          >
                            Open →
                          </Button>
                          <Button
                            variant="outline" size="icon-sm"
                            onClick={(e) => { e.stopPropagation(); startProjectEdit(project); }}
                            className="hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
                            aria-label="Edit"
                          >
                            <PencilIcon />
                          </Button>
                          <Button variant="destructive" size="sm" className="h-7" onClick={(e) => { e.stopPropagation(); setDeleteTarget(project); }}>
                            Delete
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ── Versions tab ────────────────────────────────────────────────── */}
        <TabsContent value="versions" className="mt-6">
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            {!activeProject ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <p className="text-sm font-semibold text-slate-600">No project selected</p>
                <p className="mt-1 text-xs text-slate-400">Activate a project from the Projects tab to manage its versions.</p>
              </div>
            ) : (
              <div className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Version history</p>
                    <p className="mt-0.5 text-base font-semibold text-slate-900">{activeProject.name.trim()}</p>
                  </div>
                  <Badge variant="secondary" className="font-mono">
                    {activeVersions.length} {activeVersions.length === 1 ? "version" : "versions"}
                  </Badge>
                </div>
                <Separator className="my-4" />
                <div className="space-y-2">
                  {activeVersions.length === 0 ? (
                    <p className="py-4 text-center text-sm text-slate-400">No versions available.</p>
                  ) : (
                    activeVersions.map((version, idx) => {
                      const isSelected = version === selectedVersion;
                      const isLatest = idx === activeVersions.length - 1;
                      return (
                        <button
                          key={version}
                          type="button"
                          onClick={() => setSelectedVersion(version)}
                          className={classNames(
                            "group flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left transition",
                            isSelected ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50",
                          )}
                        >
                          <div className="flex items-center gap-2.5">
                            <span className={classNames("h-2 w-2 rounded-full", isSelected ? "bg-emerald-500" : "bg-slate-300")} />
                            <span className={classNames("font-mono text-sm font-semibold", isSelected ? "text-emerald-800" : "text-slate-700")}>
                              {version}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {isLatest && <Badge variant="outline" className="border-slate-200 bg-slate-50 text-[10px] text-slate-500">latest</Badge>}
                            {isSelected && <Badge variant="outline" className="border-emerald-200 bg-emerald-100 text-[10px] text-emerald-700">viewing</Badge>}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
                <Separator className="my-4" />
                {forkError && (
                  <p className="mb-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">{forkError}</p>
                )}
                <Button
                  disabled={forkingVersion || activeVersions.length === 0}
                  onClick={() => { setForkError(""); setShowForkConfirm(true); }}
                  className="w-full"
                >
                  {forkingVersion ? "Creating…" : "+ Create new version"}
                </Button>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* ── Danger zone ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 rounded-xl border border-rose-200 bg-rose-50/50 px-5 py-4">
        <div>
          <p className="text-sm font-semibold text-rose-700">Danger Zone</p>
          <p className="mt-0.5 text-xs text-slate-500">Permanently deletes all projects, schemas, and generated artifacts.</p>
        </div>
        <Button variant="destructive" onClick={() => { setShowResetConfirm(true); setResetConfirmation(""); setResetError(""); }} className="shrink-0">
          Reset All Data
        </Button>
      </div>

      {/* ── Dialogs ──────────────────────────────────────────────────────── */}
      <Dialog open={showForkConfirm && !!activeProject} onOpenChange={(open) => { if (!open) setShowForkConfirm(false); }}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Create a new version?</DialogTitle>
            <DialogDescription>
              Contents of <span className="font-semibold text-foreground">{sourceVersion}</span> will be copied into <span className="font-semibold text-foreground">{nextVersion}</span>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <div className="rounded-md border bg-muted/50 px-4 py-3">
              <p className="text-xs font-semibold text-muted-foreground">Source</p>
              <p className="mt-0.5 font-mono text-sm font-semibold">{sourceVersion}</p>
            </div>
            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3">
              <p className="text-xs font-semibold text-emerald-600">New version</p>
              <p className="mt-0.5 font-mono text-sm font-semibold text-emerald-800">{nextVersion}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForkConfirm(false)}>Cancel</Button>
            <Button disabled={forkingVersion} onClick={() => {
              setForkError(""); setShowForkConfirm(false);
              forkMutation.mutate({ projectId: activeProjectId }, { onError: (err) => setForkError(err.message ?? "Could not create version.") });
            }}>
              {forkingVersion ? "Creating…" : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showResetConfirm} onOpenChange={(open) => { if (!open) { setShowResetConfirm(false); setResetConfirmation(""); } }}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Reset all data</DialogTitle>
            <DialogDescription>Irreversible. Type <span className="font-mono font-semibold text-destructive">RESET</span> to confirm.</DialogDescription>
          </DialogHeader>
          <Input value={resetConfirmation} onChange={(e) => setResetConfirmation(e.target.value)} placeholder="RESET" className="h-11" />
          {resetError && <p className="text-sm text-destructive">{resetError}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowResetConfirm(false)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmReset} disabled={resetConfirmation !== "RESET" || isResetting}>
              {isResetting ? "Resetting…" : "Reset Everything"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) closeDeleteDialog(); }}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Delete project</DialogTitle>
            <DialogDescription>Permanent. Type the project name exactly.</DialogDescription>
          </DialogHeader>
          <p className="rounded-md bg-muted px-3 py-2 text-sm font-semibold">{deleteTarget?.name}</p>
          <div className="grid gap-1.5">
            <label htmlFor="delete-project-name" className="text-sm font-semibold">Copy project name</label>
            <Input id="delete-project-name" value={deleteConfirmation} onChange={(e) => setDeleteConfirmation(e.target.value)} className="h-11" placeholder={deleteTarget?.name ?? ""} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDeleteDialog}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleteConfirmation !== (deleteTarget?.name ?? "") || isDeleting}>
              {isDeleting ? "Deleting..." : "Delete Project"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline gap-1">
      <span className="text-sm font-bold text-slate-800">{value}</span>
      <span className="text-xs text-slate-400">{label}</span>
    </div>
  );
}

function DatabaseIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={classNames("h-4 w-4 text-white", className ?? "")} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2">
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M3 5v14a9 3 0 0 0 18 0V5" />
      <path d="M3 12a9 3 0 0 0 18 0" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2">
      <path d="M12 20h9" /><path d="m16.5 3.5 4 4L7 21H3v-4L16.5 3.5z" />
    </svg>
  );
}
