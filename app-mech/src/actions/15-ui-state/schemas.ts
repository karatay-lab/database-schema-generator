import { z } from "zod";

export const UiStateKeySchema = z.enum([
  "active_project_id",
  "active_versions_map",
]);

export const SetUiStateSchema = z.object({
  key: z.string(),
  value: z.string(),
});

export type SetUiStateInput = z.infer<typeof SetUiStateSchema>;
