// userId  → users.id (1–20)
// postId  → posts.id (1–19, post 20 is unpublished)
export type CommentRow = {
  id: number;
  body: string;
  approved: boolean;
  createdAt: string;
  userId: number;
  postId: number;
};

export const comments: CommentRow[] = [
  { id: 1,  postId: 1,  userId: 8,  approved: true,  body: "Great explanation of the event loop! The diagram really helped it click for me.",                         createdAt: "2024-01-07T10:15:00Z" },
  { id: 2,  postId: 1,  userId: 10, approved: true,  body: "I always mix up microtasks and macrotasks. This clears it up perfectly.",                                  createdAt: "2024-01-07T11:30:00Z" },
  { id: 3,  postId: 1,  userId: 12, approved: false, body: "Check out my course on advanced JS — link in bio!",                                                        createdAt: "2024-01-07T12:00:00Z" },
  { id: 4,  postId: 2,  userId: 14, approved: true,  body: "The generic constraints section was exactly what I needed. Thanks Alice!",                                  createdAt: "2024-01-10T11:00:00Z" },
  { id: 5,  postId: 2,  userId: 16, approved: true,  body: "Would love to see a follow-up on conditional types.",                                                       createdAt: "2024-01-10T13:45:00Z" },
  { id: 6,  postId: 3,  userId: 8,  approved: true,  body: "useCallback and useMemo always trip me up. This finally makes sense.",                                      createdAt: "2024-01-12T09:30:00Z" },
  { id: 7,  postId: 3,  userId: 10, approved: true,  body: "The section on useRef for storing mutable values without re-renders was new to me. Very useful!",           createdAt: "2024-01-12T14:00:00Z" },
  { id: 8,  postId: 4,  userId: 18, approved: true,  body: "We use Docker Compose at work and this matches our setup almost exactly. Good write-up.",                  createdAt: "2024-01-22T11:00:00Z" },
  { id: 9,  postId: 4,  userId: 12, approved: true,  body: "How do you handle secrets in Compose for local dev without committing them?",                               createdAt: "2024-01-22T15:30:00Z" },
  { id: 10, postId: 5,  userId: 14, approved: true,  body: "Transform streams are so underrated. Using them in a CSV parser now thanks to this.",                       createdAt: "2024-01-14T10:00:00Z" },
  { id: 11, postId: 6,  userId: 16, approved: true,  body: "Best CSS Grid reference I have bookmarked. Sharing with my whole team.",                                    createdAt: "2024-01-17T12:00:00Z" },
  { id: 12, postId: 6,  userId: 18, approved: true,  body: "Would be great to see a comparison with Flexbox for the cases where you would use one vs the other.",      createdAt: "2024-01-17T14:30:00Z" },
  { id: 13, postId: 7,  userId: 8,  approved: true,  body: "The partial index example saved us a ton of storage. Never knew about that pattern before.",                createdAt: "2024-01-20T11:00:00Z" },
  { id: 14, postId: 7,  userId: 10, approved: true,  body: "GIN indexes for JSONB — exactly the use case we have. Thank you!",                                          createdAt: "2024-01-20T14:00:00Z" },
  { id: 15, postId: 8,  userId: 12, approved: true,  body: "I have been over-testing with E2E and under-testing with unit tests. This pyramid analogy is helpful.",     createdAt: "2024-01-24T10:30:00Z" },
  { id: 16, postId: 9,  userId: 14, approved: true,  body: "INP replacing FID was a surprise to me. Good that you covered it.",                                         createdAt: "2024-01-27T11:00:00Z" },
  { id: 17, postId: 9,  userId: 16, approved: false, body: "Spam comment removed by moderator.",                                                                        createdAt: "2024-01-27T12:30:00Z" },
  { id: 18, postId: 10, userId: 8,  approved: true,  body: "Forwarding this to my manager. The bit about 1-on-1s resonated a lot.",                                     createdAt: "2024-01-30T09:00:00Z" },
  { id: 19, postId: 10, userId: 18, approved: true,  body: "The hardest part for me was letting go of writing code every day. Did you feel that too?",                  createdAt: "2024-01-30T11:30:00Z" },
  { id: 20, postId: 11, userId: 10, approved: true,  body: "I still reach for .then() when the chain is long. This comparison helps me decide when to switch.",         createdAt: "2024-02-03T11:00:00Z" },
  { id: 21, postId: 12, userId: 12, approved: true,  body: "The many-to-many without explicit join table was something I did not know Prisma supported. Cool!",         createdAt: "2024-02-05T10:00:00Z" },
  { id: 22, postId: 13, userId: 14, approved: true,  body: "Storing the secret in the JWT payload instead of just the ID is the mistake I see most often. Good call-out.", createdAt: "2024-02-07T12:00:00Z" },
  { id: 23, postId: 14, userId: 16, approved: true,  body: "We just migrated to pnpm workspaces last month. Wish we had this post earlier!",                            createdAt: "2024-02-10T09:30:00Z" },
  { id: 24, postId: 15, userId: 18, approved: true,  body: "Removing all our server data from Redux was scary but 100% worth it. React Query is so much better.",       createdAt: "2024-02-12T11:00:00Z" },
  { id: 25, postId: 16, userId: 8,  approved: true,  body: "The Deployment vs Pod distinction always confused me. The diagram in this post nails it.",                   createdAt: "2024-02-14T10:00:00Z" },
  { id: 26, postId: 17, userId: 10, approved: true,  body: "I have been explaining SQL joins badly for years. Sending this to every junior dev I onboard.",             createdAt: "2024-02-17T11:30:00Z" },
  { id: 27, postId: 18, userId: 12, approved: true,  body: "Switched our team to trunk-based dev six months ago. Smaller PRs, fewer merge conflicts. Never going back.", createdAt: "2024-02-20T09:00:00Z" },
  { id: 28, postId: 18, userId: 14, approved: true,  body: "Feature flags make trunk-based dev possible at scale. Do you use a specific library for that?",             createdAt: "2024-02-20T12:00:00Z" },
  { id: 29, postId: 19, userId: 16, approved: true,  body: "The few-shot example pattern is the one I keep forgetting to use. Bookmarked.",                             createdAt: "2024-02-22T11:00:00Z" },
  { id: 30, postId: 19, userId: 18, approved: false, body: "AI is just hype, real developers don't need this.",                                                         createdAt: "2024-02-22T13:00:00Z" },
];
