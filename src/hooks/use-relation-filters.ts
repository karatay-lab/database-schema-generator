"use client";

import { useEffect, useMemo, useState } from "react";
import type { PrismaRelation } from "@/lib/schema-store";
import type { RelationTab } from "@/types/relation";
import { relationKindLabel } from "@/constants/relations";

const RELATIONS_PER_PAGE = 6;

export function useRelationFilters({
  ownedRelations,
  backReferences,
  selectedModelName,
}: {
  ownedRelations: PrismaRelation[];
  backReferences: PrismaRelation[];
  selectedModelName: string;
}) {
  const [activeRelationTab, setActiveRelationTab] = useState<RelationTab>("relations");
  const [relationTargetFilter, setRelationTargetFilter] = useState("");
  const [relationKindFilter, setRelationKindFilter] = useState<PrismaRelation["kind"] | "">("");
  const [relationPage, setRelationPage] = useState(1);

  const visibleRelations = activeRelationTab === "relations" ? ownedRelations : backReferences;

  const relationTargetOptions = useMemo(
    () => Array.from(new Set(visibleRelations.map((r) => r.targetModel))).filter(Boolean).sort((a, b) => a.localeCompare(b)),
    [visibleRelations],
  );
  const relationKindOptions = useMemo(
    () => Array.from(new Set(visibleRelations.map((r) => r.kind))).sort((a, b) => relationKindLabel(a).localeCompare(relationKindLabel(b))),
    [visibleRelations],
  );
  const filteredVisibleRelations = useMemo(
    () => visibleRelations.filter((r) =>
      (!relationTargetFilter || r.targetModel === relationTargetFilter) &&
      (!relationKindFilter || r.kind === relationKindFilter),
    ),
    [visibleRelations, relationTargetFilter, relationKindFilter],
  );
  const relationPageCount  = Math.max(1, Math.ceil(filteredVisibleRelations.length / RELATIONS_PER_PAGE));
  const safeRelationPage   = Math.min(relationPage, relationPageCount);
  const paginatedRelations = filteredVisibleRelations.slice(
    (safeRelationPage - 1) * RELATIONS_PER_PAGE,
    safeRelationPage * RELATIONS_PER_PAGE,
  );

  // Reset page when filters or tab change
  useEffect(() => {
    setRelationPage(1);
  }, [activeRelationTab, filteredVisibleRelations.length, relationKindFilter, relationTargetFilter, selectedModelName]);

  // Clear stale filter values
  useEffect(() => {
    if (relationTargetFilter && !relationTargetOptions.includes(relationTargetFilter)) setRelationTargetFilter("");
  }, [relationTargetFilter, relationTargetOptions]);
  useEffect(() => {
    if (relationKindFilter && !relationKindOptions.includes(relationKindFilter)) setRelationKindFilter("");
  }, [relationKindFilter, relationKindOptions]);

  // Clamp page
  useEffect(() => { setRelationPage((p) => Math.min(p, relationPageCount)); }, [relationPageCount]);

  const changeTab = (tab: RelationTab) => {
    setActiveRelationTab(tab);
    setRelationTargetFilter("");
    setRelationKindFilter("");
  };

  return {
    activeRelationTab, changeTab,
    visibleRelations,
    relationTargetFilter, setRelationTargetFilter,
    relationKindFilter, setRelationKindFilter,
    relationTargetOptions, relationKindOptions,
    filteredVisibleRelations, paginatedRelations,
    relationPageCount, safeRelationPage, setRelationPage,
  };
}
