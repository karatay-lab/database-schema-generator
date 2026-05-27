// status "in-progress" (id=3) and "planning" (id=6) are not valid ProjectStatus
// enum values. When v2 binds Project.status → ProjectStatus enum, the migration
// emits an upgrade warning for these rows (not a hard error — String→enum is a
// warning-only conversion per checkTypeConversion).
export const projects = [
  { id: 1, name: "Website Redesign",  description: "Full site overhaul",          status: "ACTIVE",      workspaceId: 1, createdAt: new Date("2024-01-20T09:00:00.000Z"), updatedAt: new Date("2024-04-01T10:00:00.000Z") },
  { id: 2, name: "Mobile App",        description: "iOS and Android apps",        status: "PAUSED",      workspaceId: 1, createdAt: new Date("2024-02-01T10:00:00.000Z"), updatedAt: new Date("2024-03-20T11:00:00.000Z") },
  { id: 3, name: "SEO Campaign",      description: null,                          status: "in-progress", workspaceId: 2, createdAt: new Date("2024-02-15T08:00:00.000Z"), updatedAt: new Date("2024-04-05T09:00:00.000Z") },
  { id: 4, name: "API v2",            description: "Next-generation REST API",    status: "COMPLETED",   workspaceId: 3, createdAt: new Date("2024-01-25T11:00:00.000Z"), updatedAt: new Date("2024-03-31T16:00:00.000Z") },
  { id: 5, name: "Infrastructure",    description: "Cloud migration project",     status: null,          workspaceId: 3, createdAt: new Date("2024-03-01T07:00:00.000Z"), updatedAt: new Date("2024-04-08T12:00:00.000Z") },
  { id: 6, name: "Data Pipeline",     description: null,                          status: "planning",    workspaceId: 4, createdAt: new Date("2024-03-20T09:00:00.000Z"), updatedAt: new Date("2024-04-10T14:00:00.000Z") },
];
