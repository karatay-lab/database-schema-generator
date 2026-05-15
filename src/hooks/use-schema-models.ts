/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useCallback, useEffect, useState } from "react";
import type { PrismaModel } from "@/lib/schema-store";

export function useSchemaModels(projectName: string, version: string) {
  const [models, setModels] = useState<PrismaModel[]>([]);
  const [loadingModels, setLoadingModels] = useState(true);

  const load = useCallback(async () => {
    if (!projectName || !version) {
      setModels([]);
      setLoadingModels(false);
      return;
    }
    setLoadingModels(true);
    try {
      const params = new URLSearchParams({ projectName, version });
      const res = await fetch(`/api/tables?${params}`);
      const data = (await res.json()) as { models?: PrismaModel[] };
      setModels(data.models ?? []);
    } catch {
      setModels([]);
    } finally {
      setLoadingModels(false);
    }
  }, [projectName, version]);

  useEffect(() => {
    void load();
  }, [load]);

  return { models, loadingModels, reload: load };
}
