"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  defaultSchemaOptions,
  graphqlOptions,
  prismaClients,
  providers,
} from "@/constants/projects";

type Tab = "create" | "import";

export default function CreateFirstProject() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("create");

  // create state
  const [name, setName] = useState("");
  const [provider, setProvider] = useState(providers[0]);
  const [client, setClient] = useState(defaultSchemaOptions.client);
  const [graphql, setGraphql] = useState(defaultSchemaOptions.graphql);
  const [createError, setCreateError] = useState("");
  const [creating, setCreating] = useState(false);

  // import state
  const [importName, setImportName] = useState("");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importError, setImportError] = useState("");
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const trimmed = name.trim();
  const tooShort = trimmed.length > 0 && trimmed.length < 8;
  const canSubmit = trimmed.length >= 8 && !creating;

  const importTrimmed = importName.trim();
  const importTooShort = importTrimmed.length > 0 && importTrimmed.length < 8;
  const canImport = importTrimmed.length >= 8 && importFile !== null && !importing;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setCreating(true);
    setCreateError("");

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, provider, client, graphql }),
      });
      const data = (await res.json()) as { project?: { id: string }; error?: string };

      if (!res.ok || !data.project) {
        throw new Error(data.error ?? "Could not create project.");
      }

      router.push("/tables");
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Could not create project.");
      setCreating(false);
    }
  };

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canImport) return;

    setImporting(true);
    setImportError("");

    try {
      const formData = new FormData();
      formData.append("files", importFile!);

      const uploadRes = await fetch("/api/schema-imports", { method: "POST", body: formData });
      const uploadData = (await uploadRes.json()) as { imported?: { fileName: string }[]; error?: string };

      if (!uploadRes.ok) throw new Error(uploadData.error ?? "Upload failed.");

      const fileName = uploadData.imported?.[0]?.fileName ?? importFile!.name;

      const matchRes = await fetch("/api/schema-imports/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName, projectName: importTrimmed }),
      });
      const matchData = (await matchRes.json()) as { error?: string };

      if (!matchRes.ok) throw new Error(matchData.error ?? "Import failed.");

      router.push("/tables");
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Import failed.");
      setImporting(false);
    }
  };

  return (
    <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
        Schema Studio
      </p>
      <h1 className="mt-2 text-2xl font-bold text-slate-950">Get started</h1>
      <p className="mt-1 text-sm text-slate-500">
        Create a new project or import an existing Prisma schema.
      </p>

      <div className="mt-5 flex rounded-lg border border-slate-200 bg-slate-50 p-1">
        <button
          type="button"
          onClick={() => setTab("create")}
          className={`flex-1 rounded-md py-2 text-sm font-semibold transition ${
            tab === "create"
              ? "bg-white text-slate-950 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          Create project
        </button>
        <button
          type="button"
          onClick={() => setTab("import")}
          className={`flex-1 rounded-md py-2 text-sm font-semibold transition ${
            tab === "import"
              ? "bg-white text-slate-950 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          Import schema
        </button>
      </div>

      {tab === "create" ? (
        <form onSubmit={handleCreate} className="mt-6 space-y-4">
          <div>
            <label htmlFor="project-name" className="block text-sm font-semibold text-slate-700">
              Project name
            </label>
            <input
              id="project-name"
              value={name}
              onChange={(e) => { setName(e.target.value); setCreateError(""); }}
              placeholder="Customer Portal"
              className="mt-1.5 h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-emerald-600"
              autoFocus
            />
            {tooShort && (
              <p className="mt-1.5 text-xs font-medium text-rose-600">At least 8 characters required.</p>
            )}
          </div>

          <div>
            <label htmlFor="db-provider" className="block text-sm font-semibold text-slate-700">
              Database provider
            </label>
            <select
              id="db-provider"
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              className="mt-1.5 h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-950 outline-none transition focus:border-emerald-600"
            >
              {providers.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          <div>
            <label htmlFor="prisma-client" className="block text-sm font-semibold text-slate-700">
              Prisma client
            </label>
            <select
              id="prisma-client"
              value={client}
              onChange={(e) => setClient(e.target.value)}
              className="mt-1.5 h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-950 outline-none transition focus:border-emerald-600"
            >
              {prismaClients.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <label htmlFor="graphql-stack" className="block text-sm font-semibold text-slate-700">
              GraphQL stack
            </label>
            <select
              id="graphql-stack"
              value={graphql}
              onChange={(e) => setGraphql(e.target.value)}
              className="mt-1.5 h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-950 outline-none transition focus:border-emerald-600"
            >
              {graphqlOptions.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>

          {createError && (
            <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
              {createError}
            </p>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            className="h-11 w-full rounded-md bg-emerald-600 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {creating ? "Creating…" : "Create Project"}
          </button>
        </form>
      ) : (
        <form onSubmit={handleImport} className="mt-6 space-y-4">
          <div>
            <label htmlFor="import-name" className="block text-sm font-semibold text-slate-700">
              Project name
            </label>
            <input
              id="import-name"
              value={importName}
              onChange={(e) => { setImportName(e.target.value); setImportError(""); }}
              placeholder="Customer Portal"
              className="mt-1.5 h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-emerald-600"
              autoFocus
            />
            {importTooShort && (
              <p className="mt-1.5 text-xs font-medium text-rose-600">At least 8 characters required.</p>
            )}
          </div>

          <div>
            <label htmlFor="import-file" className="block text-sm font-semibold text-slate-700">
              Prisma schema file
            </label>
            <div className="mt-1.5 flex items-center gap-3">
              <input
                ref={fileInputRef}
                id="import-file"
                type="file"
                accept=".prisma"
                onChange={(e) => { setImportFile(e.target.files?.[0] ?? null); setImportError(""); }}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="h-11 flex-1 rounded-md border border-slate-300 bg-white px-3 text-left text-sm font-medium text-slate-500 transition hover:border-slate-400 hover:bg-slate-50"
              >
                {importFile ? importFile.name : "Choose .prisma file…"}
              </button>
              {importFile && (
                <button
                  type="button"
                  onClick={() => { setImportFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                  className="h-11 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-500 transition hover:bg-slate-50"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {importError && (
            <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
              {importError}
            </p>
          )}

          <button
            type="submit"
            disabled={!canImport}
            className="h-11 w-full rounded-md bg-emerald-600 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {importing ? "Importing…" : "Import Schema"}
          </button>
        </form>
      )}
    </div>
  );
}
