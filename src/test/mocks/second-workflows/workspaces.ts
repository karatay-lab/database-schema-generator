export const workspaces = [
  { id: 1, name: "Product",     description: "Product development team",    orgId: 1, createdAt: new Date("2024-01-17T09:00:00.000Z") },
  { id: 2, name: "Marketing",   description: null,                          orgId: 1, createdAt: new Date("2024-01-25T10:00:00.000Z") },
  { id: 3, name: "Engineering", description: "Core engineering workspace",  orgId: 2, createdAt: new Date("2024-02-05T08:00:00.000Z") },
  { id: 4, name: "Platform",    description: null,                          orgId: 3, createdAt: new Date("2024-03-15T09:00:00.000Z") },
];
