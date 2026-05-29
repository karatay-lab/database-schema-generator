// rating is null for comments 1, 3, 5, 7 (ids 1,3,5,7).
// When v2 makes rating required (Int, no default), these four rows produce
// Stage 2 Zod errors: z.number().int().safeParse(null) → "Expected number, received null"
export const comments = [
  { id: 1, body: "Design looks great, minor tweaks needed.",          rating: null, taskId: 1,  authorId: 1, createdAt: new Date("2024-02-11T10:00:00.000Z") },
  { id: 2, body: "Copy draft approved by marketing.",                 rating: 5,    taskId: 2,  authorId: 3, createdAt: new Date("2024-02-06T11:00:00.000Z") },
  { id: 3, body: "Wireframes need more detail on navigation flows.",  rating: null, taskId: 3,  authorId: 3, createdAt: new Date("2024-02-21T09:00:00.000Z") },
  { id: 4, body: "Prototype is ready for stakeholder review.",        rating: 4,    taskId: 4,  authorId: 2, createdAt: new Date("2024-03-02T10:00:00.000Z") },
  { id: 5, body: "Keyword list has been shared in Notion.",           rating: null, taskId: 5,  authorId: 3, createdAt: new Date("2024-03-06T08:00:00.000Z") },
  { id: 6, body: "Production restored after emergency rollback.",     rating: 3,    taskId: 6,  authorId: 5, createdAt: new Date("2024-02-20T10:00:00.000Z") },
  { id: 7, body: "Patch deployed to staging — needs QA sign-off.",   rating: null, taskId: 7,  authorId: 5, createdAt: new Date("2024-02-23T09:00:00.000Z") },
  { id: 8, body: "Failover completed successfully, no data loss.",    rating: 5,    taskId: 8,  authorId: 6, createdAt: new Date("2024-03-11T11:00:00.000Z") },
];
