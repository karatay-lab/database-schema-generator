// score is null for Bob Smith (id=2) and Dave Lee (id=4).
// When v2 makes score required (Int, no default), these two rows produce
// Stage 2 Zod errors: z.number().int().safeParse(null) → "Expected number, received null"
export const users = [
  { id: 1, email: "alice@acme.com",        name: "Alice Chen",    role: "ADMIN",  score: 95,   orgId: 1, createdAt: new Date("2024-01-16T09:00:00.000Z"), updatedAt: new Date("2024-04-01T10:00:00.000Z") },
  { id: 2, email: "bob@acme.com",          name: "Bob Smith",     role: "MEMBER", score: null, orgId: 1, createdAt: new Date("2024-01-20T11:00:00.000Z"), updatedAt: new Date("2024-03-15T14:00:00.000Z") },
  { id: 3, email: "carol@techstart.com",   name: "Carol White",   role: "ADMIN",  score: 72,   orgId: 2, createdAt: new Date("2024-02-03T08:30:00.000Z"), updatedAt: new Date("2024-04-10T09:00:00.000Z") },
  { id: 4, email: "dave@techstart.com",    name: "Dave Lee",      role: "MEMBER", score: null, orgId: 2, createdAt: new Date("2024-02-10T13:00:00.000Z"), updatedAt: new Date("2024-03-28T16:00:00.000Z") },
  { id: 5, email: "eve@devco.com",         name: "Eve Martinez",  role: "ADMIN",  score: 88,   orgId: 3, createdAt: new Date("2024-03-12T07:00:00.000Z"), updatedAt: new Date("2024-04-05T11:00:00.000Z") },
  { id: 6, email: "frank@devco.com",       name: "Frank Brown",   role: "MEMBER", score: 61,   orgId: 3, createdAt: new Date("2024-03-18T10:00:00.000Z"), updatedAt: new Date("2024-04-08T15:00:00.000Z") },
];
