export type MediaRow = {
  id: number;
  url: string;
  alt: string | null;
  type: string;
  size: number;
  createdAt: string;
};

export const media: MediaRow[] = [
  { id: 1,  url: "/uploads/2024/js-event-loop.png",        alt: "JavaScript event loop diagram",              type: "IMAGE", size: 142080,  createdAt: "2024-01-06T08:00:00Z" },
  { id: 2,  url: "/uploads/2024/ts-generics-cheatsheet.png", alt: "TypeScript generics cheatsheet",            type: "IMAGE", size: 208000,  createdAt: "2024-01-09T09:00:00Z" },
  { id: 3,  url: "/uploads/2024/react-hooks-flow.png",     alt: "React hooks lifecycle flow chart",            type: "IMAGE", size: 185600,  createdAt: "2024-01-11T10:00:00Z" },
  { id: 4,  url: "/uploads/2024/node-streams.png",         alt: "Node.js streams architecture",                type: "IMAGE", size: 167520,  createdAt: "2024-01-13T11:00:00Z" },
  { id: 5,  url: "/uploads/2024/css-grid-guide.png",       alt: "CSS Grid complete visual guide",              type: "IMAGE", size: 310400,  createdAt: "2024-01-16T08:30:00Z" },
  { id: 6,  url: "/uploads/2024/postgres-indexes.png",     alt: "PostgreSQL index types comparison",           type: "IMAGE", size: 195200,  createdAt: "2024-01-19T13:00:00Z" },
  { id: 7,  url: "/uploads/2024/docker-compose.png",       alt: "Docker Compose multi-service diagram",        type: "IMAGE", size: 220160,  createdAt: "2024-01-21T14:00:00Z" },
  { id: 8,  url: "/uploads/2024/testing-pyramid.png",      alt: "Software testing pyramid",                    type: "IMAGE", size: 131072,  createdAt: "2024-01-23T09:00:00Z" },
  { id: 9,  url: "/uploads/2024/web-vitals.png",           alt: "Core Web Vitals overview",                    type: "IMAGE", size: 256000,  createdAt: "2024-01-26T10:30:00Z" },
  { id: 10, url: "/uploads/2024/career-roadmap.png",       alt: "Software engineer career roadmap",            type: "IMAGE", size: 409600,  createdAt: "2024-01-29T08:15:00Z" },
  { id: 11, url: "/uploads/2024/async-await.png",          alt: "Async/await vs promises comparison",          type: "IMAGE", size: 163840,  createdAt: "2024-02-02T11:00:00Z" },
  { id: 12, url: "/uploads/2024/prisma-schema.png",        alt: "Prisma schema relations diagram",             type: "IMAGE", size: 245760,  createdAt: "2024-02-04T12:00:00Z" },
  { id: 13, url: "/uploads/2024/jwt-flow.png",             alt: "JWT authentication flow",                     type: "IMAGE", size: 178176,  createdAt: "2024-02-06T09:45:00Z" },
  { id: 14, url: "/uploads/2024/monorepo-structure.png",   alt: "Monorepo folder structure example",           type: "IMAGE", size: 192512,  createdAt: "2024-02-09T14:00:00Z" },
  { id: 15, url: "/uploads/2024/react-query-lifecycle.png",alt: "React Query lifecycle diagram",               type: "IMAGE", size: 204800,  createdAt: "2024-02-11T10:15:00Z" },
  { id: 16, url: "/uploads/2024/k8s-architecture.png",     alt: "Kubernetes cluster architecture",             type: "IMAGE", size: 358400,  createdAt: "2024-02-13T08:30:00Z" },
  { id: 17, url: "/uploads/2024/sql-joins.png",            alt: "SQL JOIN types visual reference",             type: "IMAGE", size: 225280,  createdAt: "2024-02-16T13:45:00Z" },
  { id: 18, url: "/uploads/2024/git-branching.png",        alt: "Git branching strategy diagram",              type: "IMAGE", size: 147456,  createdAt: "2024-02-19T09:00:00Z" },
  { id: 19, url: "/uploads/2024/llm-prompting.png",        alt: "LLM prompt engineering techniques",           type: "IMAGE", size: 286720,  createdAt: "2024-02-21T11:30:00Z" },
  { id: 20, url: "/uploads/2024/ci-pipeline.png",          alt: null,                                          type: "IMAGE", size: 174080,  createdAt: "2024-02-23T10:00:00Z" },
];
