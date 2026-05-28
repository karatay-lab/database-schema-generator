import { createTRPCRouter } from "../init";
import { enumsRouter } from "./enums";
import { projectsRouter } from "./projects";
import { tablesRouter } from "./tables";
import { fieldsRouter } from "./fields";
import { relationsRouter } from "./relations";
import { restrictionsRouter } from "./restrictions";
import { schemaRouter } from "./schema";
import { importsRouter } from "./imports";
import { fieldTemplatesRouter } from "./fieldTemplates";
import { migrationsRouter } from "./migrations";
import { historyRouter } from "./history";
import { commentaryRouter } from "./commentary";
import { exportsRouter } from "./exports";
import { hierarchyRouter } from "./hierarchy";
import { trackingRouter } from "./tracking";

export const appRouter = createTRPCRouter({
  projects: projectsRouter,
  tables: tablesRouter,
  fields: fieldsRouter,
  relations: relationsRouter,
  restrictions: restrictionsRouter,
  schema: schemaRouter,
  imports: importsRouter,
  fieldTemplates: fieldTemplatesRouter,
  migrations: migrationsRouter,
  history: historyRouter,
  commentary: commentaryRouter,
  exports: exportsRouter,
  hierarchy: hierarchyRouter,
  enums: enumsRouter,
  tracking: trackingRouter,
});

export type AppRouter = typeof appRouter;
