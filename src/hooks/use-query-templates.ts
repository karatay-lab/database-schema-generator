"use client";

import { useCallback, useState } from "react";
import type { PrismaField } from "@/lib/schema-store";

export function useQueryTemplates({
  projectName,
  version,
}: {
  projectName: string;
  version: string;
}) {
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [templateFields, setTemplateFields] = useState<PrismaField[]>([]);
  const [loadingTemplateFields, setLoadingTemplateFields] = useState(false);
  const [isTemplateSelectorOpen, setIsTemplateSelectorOpen] = useState(false);
  const [templateSearch, setTemplateSearch] = useState("");

  const fetchTemplateFields = useCallback(async (modelName: string) => {
    if (!projectName || !version || !modelName) {
      setTemplateFields([]);
      return;
    }
    setLoadingTemplateFields(true);
    try {
      const params = new URLSearchParams({ projectName, version, modelName });
      const res = await fetch(`/api/schema-fields?${params}`);
      const data = await res.json() as { fields?: PrismaField[] };
      setTemplateFields(data.fields ?? []);
    } catch {
      setTemplateFields([]);
    } finally {
      setLoadingTemplateFields(false);
    }
  }, [projectName, version]);

  const selectTemplate = (modelName: string) => {
    setSelectedTemplate(modelName);
    setTemplateFields([]);
    setIsTemplateSelectorOpen(false);
    setTemplateSearch("");
    void fetchTemplateFields(modelName);
  };

  const closeTemplateSelector = () => {
    setIsTemplateSelectorOpen(false);
    setTemplateSearch("");
  };

  return {
    selectedTemplate, setSelectedTemplate,
    templateFields, loadingTemplateFields,
    isTemplateSelectorOpen, setIsTemplateSelectorOpen,
    templateSearch, setTemplateSearch,
    fetchTemplateFields,
    selectTemplate,
    closeTemplateSelector,
  };
}
