"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";

export function useFieldTemplatesQuery() {
  const trpc = useTRPC();
  return useQuery(trpc.fieldTemplates.list.queryOptions());
}

export function useFieldTemplateMutations() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: trpc.fieldTemplates.list.queryOptions().queryKey,
    });

  return {
    invalidate,
    create: useMutation(trpc.fieldTemplates.create.mutationOptions()),
    update: useMutation(trpc.fieldTemplates.update.mutationOptions()),
    delete: useMutation(trpc.fieldTemplates.delete.mutationOptions()),
  };
}
