"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { classNames } from "../shared/dashboard-data";
import { fieldTypeBadgeClass } from "@/lib/badge-utils";
import { useProjectInfo } from "../shared/project-info-context";
import type { PrismaField, PrismaModel } from "@/lib/schema-store";
import type { GenerateRequest, GenerateResponse } from "@/types/validation";

function highlightCode(code: string): React.ReactNode {
  const lines = code.split("\n");
  const keywords = [
    "import", "export", "from", "const", "let", "var", "function", "return",
    "type", "interface", "extends", "as", "if", "else", "for", "while",
    "true", "false", "null", "undefined", "new", "class", "static",
  ];
  const types = [
    "z", "string", "number", "boolean", "date", "bigint", "enum", "any",
    "void", "never", "unknown", "object", "array", "optional", "nullable",
    "min", "max", "length", "email", "url", "uuid", "datetime", "datetime",
    "native", "refine", "transform", "pipe",
  ];

  return lines.map((line, lineIndex) => {
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;

    const tokens: { start: number; end: number; type: string; text: string }[] = [];

    const stringRegex = /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/g;
    let match;
    while ((match = stringRegex.exec(line)) !== null) {
      tokens.push({ start: match.index, end: match.index + match[0].length, type: "string", text: match[0] });
    }

    const commentRegex = /(\/\/.*$|\/\*[\s\S]*?\*\/)/g;
    while ((match = commentRegex.exec(line)) !== null) {
      tokens.push({ start: match.index, end: match.index + match[0].length, type: "comment", text: match[0] });
    }

    const wordRegex = /\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g;
    while ((match = wordRegex.exec(line)) !== null) {
      const word = match[1];
      const isKeyword = keywords.includes(word);
      const isType = types.includes(word);
      if (isKeyword) {
        tokens.push({ start: match.index, end: match.index + word.length, type: "keyword", text: word });
      } else if (isType) {
        tokens.push({ start: match.index, end: match.index + word.length, type: "type", text: word });
      }
    }

    tokens.sort((a, b) => a.start - b.start);

    for (const token of tokens) {
      if (token.start > lastIndex) {
        parts.push(<span key={`text-${lastIndex}`}>{line.slice(lastIndex, token.start)}</span>);
      }
      const colorClass =
        token.type === "keyword"
          ? "text-purple-600 font-semibold"
          : token.type === "type"
          ? "text-blue-600 font-semibold"
          : token.type === "string"
          ? "text-green-600"
          : token.type === "comment"
          ? "text-slate-400 italic"
          : "";
      parts.push(
        <span key={`token-${token.start}`} className={colorClass}>
          {token.text}
        </span>,
      );
      lastIndex = token.end;
    }

    if (lastIndex < line.length) {
      parts.push(<span key={`text-end`}>{line.slice(lastIndex)}</span>);
    }

    return (
      <div key={lineIndex} className="leading-6">
        <span className="mr-4 inline-select text-slate-400">{String(lineIndex + 1).padStart(3, " ")}</span>
        {parts.length > 0 ? parts : <span>&nbsp;</span>}
      </div>
    );
  });
}



function displayType(field: PrismaField, enumTypes: string[]) {
  if (enumTypes.includes(field.type)) {
    return field.type;
  }
  if (field.nativeAttribute?.name === "Uuid") {
    return "Uuid";
  }
  if (field.nativeAttribute?.name === "Timestamptz") {
    return "Timestamptz";
  }
  return field.type;
}

export function ValidationPageContent() {
  const { projectName, version: selectedVersion, hasProject } = useProjectInfo();
  const version = selectedVersion;
  const trpc = useTRPC();

  const [selectedModelName, setSelectedModelName] = useState("");
  const [tableSearch, setTableSearch] = useState("");
  const [isTableSelectorOpen, setIsTableSelectorOpen] = useState(false);
  const [tablePage, setTablePage] = useState(1);
  const TABLE_PAGE_SIZE = 9;

  const tablesQuery = useQuery(
    trpc.tables.list.queryOptions(
      { projectName, version },
      { enabled: !!projectName && !!version },
    ),
  );
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

  const fieldsQuery = useQuery(
    trpc.fields.list.queryOptions(
      { projectName, version, modelName: selectedModelName, modelKey: selectedModelKey },
      { enabled: !!selectedModelName },
    ),
  );
  const fields: PrismaField[] = fieldsQuery.data?.fields ?? [];
  const enumTypes: string[] = fieldsQuery.data?.enumTypes ?? [];

  const [generateError, setGenerateError] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogCode, setDialogCode] = useState("");
  const [dialogFilePath, setDialogFilePath] = useState("");
  const [dialogSchemaCount, setDialogSchemaCount] = useState(0);
  const [dialogEnumCount, setDialogEnumCount] = useState(0);
  const [dialogWarnings, setDialogWarnings] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  const filteredModels = useMemo(
    () =>
      models.filter((model) =>
        model.name.toLowerCase().includes(tableSearch.toLowerCase()),
      ),
    [models, tableSearch],
  );

  const paginatedModels = useMemo(() => {
    const start = (tablePage - 1) * TABLE_PAGE_SIZE;
    return filteredModels.slice(start, start + TABLE_PAGE_SIZE);
  }, [filteredModels, tablePage]);

  const totalTablePages = Math.ceil(filteredModels.length / TABLE_PAGE_SIZE);

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

  // Reset field selection when model changes
  useEffect(() => {
    setSelectedFieldKeys(new Set());
  }, [selectedModelName]);

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

  const generateMutation = useMutation({
    ...trpc.schema.generateZod.mutationOptions(),
    onSuccess: (data) => {
      const d = data as GenerateResponse | undefined;
      setDialogCode(d?.code ?? "");
      setDialogFilePath(d?.filePath ?? "");
      setDialogSchemaCount(d?.schemaCount ?? 0);
      setDialogEnumCount(d?.enumCount ?? 0);
      setDialogWarnings(d?.warnings ?? []);
      setDialogOpen(true);
    },
    onError: (err) => setGenerateError(err.message),
  });

  const handleConvert = () => {
    if (selectedFieldKeys.size === 0) { setGenerateError("Select at least one field."); return; }
    setGenerateError("");
    generateMutation.mutate({
      projectName, version,
      modelName: selectedModelName,
      modelKey: selectedModelKey,
      selectedFieldKeys: Array.from(selectedFieldKeys),
    });
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
      <section className="rounded-lg border border-slate-200 bg-white shadow-sm min-h-[calc(100vh-140px)]">
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
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
              <p className="text-sm font-medium text-slate-500">
                Select a table to generate a Zod schema.
              </p>
              <button
                type="button"
                onClick={() => setIsTableSelectorOpen(true)}
                className="mt-4 h-10 min-w-44 rounded-md bg-amber-600 px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-700"
              >
                Select Table
              </button>
            </div>
          ) : fieldsQuery.isLoading ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-8 text-center text-sm font-medium text-slate-500">
              Loading fields...
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Selected Table
                  </p>
                  <h4 className="mt-1 text-lg font-semibold text-slate-950">
                    {selectedModelName}
                  </h4>
                  <p className="mt-1 text-sm font-medium text-slate-500">
                    {fields.filter((f) => !f.isBackReference).length} fields &middot; {enumTypes.length} enums
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={selectAll}
                    className="h-9 rounded-md border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    onClick={clearAll}
                    className="h-9 rounded-md border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Clear
                  </button>
                </div>
                <div className="w-full flex-1 lg:max-w-xs">
                  <input
                    type="text"
                    value={fieldSearch}
                    onChange={(event) => setFieldSearch(event.target.value)}
                    placeholder="Search fields..."
                    className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-amber-600"
                  />
                </div>
                <select
                  value={fieldTypeFilter}
                  onChange={(event) => setFieldTypeFilter(event.target.value)}
                  className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-950 outline-none transition focus:border-amber-600"
                >
                  <option value="all">All Types</option>
                  {fieldTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
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

              {generateError ? (
                <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
                  {generateError}
                </p>
              ) : null}

              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-500">
                  {selectedFieldKeys.size} of {fields.filter((f) => !f.isBackReference).length} fields selected
                </p>
                <button
                  type="button"
                  onClick={() => handleConvert()}
                  disabled={
                    generateMutation.isPending ||
                    selectedFieldKeys.size === 0
                  }
                  className="h-10 min-w-36 rounded-md bg-amber-600 px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {generateMutation.isPending ? "Generating..." : "Convert"}
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {isTableSelectorOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-3">
          <div className="max-h-[94vh] w-[96vw] max-w-[1500px] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl">
            <div className="border-b border-slate-200 px-5 py-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Table Selector
                  </p>
                  <h3 className="mt-1 text-xl font-semibold text-slate-950">
                    Tables
                  </h3>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">
                    {models.length} tables
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsTableSelectorOpen(false)}
                    className="h-9 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>

            <div className="p-5">
              <div className="mb-4">
                <input
                  type="text"
                  value={tableSearch}
                  onChange={(event) => setTableSearch(event.target.value)}
                  placeholder="Search tables..."
                  className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-amber-600"
                />
              </div>

              <div className="max-h-[70vh] overflow-y-auto pr-1">
                {tablesQuery.isLoading ? (
                  <div className="py-8 text-center text-sm font-medium text-slate-500">
                    Loading...
                  </div>
                ) : filteredModels.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm font-medium text-slate-500">
                    No tables found.
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-3 gap-4">
                      {paginatedModels.map((model) => {
                        const isSelected = model.name === selectedModelName;

                        return (
                          <button
                            key={model.key}
                            type="button"
                            onClick={() => selectModel(model.name)}
                            className={classNames(
                              "flex min-h-16 items-center justify-between rounded-lg border p-4 text-left transition",
                              isSelected
                                ? "border-amber-400 bg-amber-50 shadow-sm"
                                : "border-slate-200 bg-white hover:border-amber-300",
                            )}
                          >
                            <span className="min-w-0 truncate font-semibold text-slate-950">
                              {model.name}
                            </span>
                            <span
                              className={classNames(
                                "ml-3 inline-flex shrink-0 items-center rounded-md px-2 py-1 text-xs font-medium",
                                fieldTypeBadgeClass(model.pkType),
                              )}
                            >
                              {model.pkType || "String"}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    {totalTablePages > 1 && (
                      <div className="mt-4 flex items-center justify-center gap-4">
                        <button
                          type="button"
                          onClick={() => setTablePage((p) => Math.max(1, p - 1))}
                          disabled={tablePage === 1}
                          className="h-9 rounded-md border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100"
                        >
                          Previous
                        </button>
                        <span className="text-sm font-medium text-slate-600">
                          Page {tablePage} of {totalTablePages}
                        </span>
                        <button
                          type="button"
                          onClick={() => setTablePage((p) => Math.min(totalTablePages, p + 1))}
                          disabled={tablePage === totalTablePages}
                          className="h-9 rounded-md border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100"
                        >
                          Next
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {dialogOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-3">
          <div className="max-h-[92vh] w-[96vw] max-w-[1400px] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Generated Code
                </p>
                <h3 className="mt-1 text-lg font-semibold text-slate-950">
                  {dialogFilePath}
                </h3>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">
                    {dialogSchemaCount} schema{dialogSchemaCount !== 1 ? "s" : ""}
                  </span>
                  {dialogEnumCount > 0 ? (
                    <span className="rounded-md bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-700">
                      {dialogEnumCount} enum{dialogEnumCount !== 1 ? "s" : ""}
                    </span>
                  ) : null}
                </div>
                {dialogWarnings.length > 0 ? (
                  <div className="mt-2 space-y-1">
                    {dialogWarnings.map((warning, i) => (
                      <p key={i} className="text-xs font-medium text-amber-600">
                        {warning}
                      </p>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="h-9 rounded-md border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
                <button
                  type="button"
                  onClick={closeDialog}
                  className="h-9 rounded-md border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Close
                </button>
              </div>
            </div>
            <div className="custom-scrollbar overflow-y-auto p-5 pb-12" style={{ maxHeight: "calc(92vh - 140px)" }}>
              <div className="min-w-max rounded-md border border-slate-200 bg-white px-4 py-4 text-xs font-mono">
                {highlightCode(dialogCode)}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}