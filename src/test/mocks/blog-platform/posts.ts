// authorId  → users.id (1–20)
// categoryId → categories.id (1–10) | null
// mediaId    → media.id (1–20) | null
export type PostRow = {
  id: number;
  title: string;
  slug: string;
  content: string | null;
  excerpt: string | null;
  published: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  authorId: number;
  categoryId: number | null;
  mediaId: number | null;
};

export const posts: PostRow[] = [
  {
    id: 1, authorId: 1, categoryId: 1, mediaId: 1,
    title: "Understanding the JavaScript Event Loop",
    slug: "understanding-the-javascript-event-loop",
    excerpt: "A visual walkthrough of how the call stack, microtask queue, and macrotask queue interact.",
    content: "The event loop is one of the most misunderstood concepts in JavaScript...",
    published: true, publishedAt: "2024-01-07T09:00:00Z",
    createdAt: "2024-01-06T18:00:00Z", updatedAt: "2024-01-07T09:00:00Z",
  },
  {
    id: 2, authorId: 2, categoryId: 2, mediaId: 2,
    title: "TypeScript Generics: A Practical Guide",
    slug: "typescript-generics-practical-guide",
    excerpt: "Learn how to write flexible, reusable, and type-safe code with TypeScript generics.",
    content: "Generics allow you to write components that work with any data type...",
    published: true, publishedAt: "2024-01-10T10:00:00Z",
    createdAt: "2024-01-09T16:00:00Z", updatedAt: "2024-01-10T10:00:00Z",
  },
  {
    id: 3, authorId: 3, categoryId: 3, mediaId: 3,
    title: "React Hooks: Beyond the Basics",
    slug: "react-hooks-beyond-the-basics",
    excerpt: "Explore useCallback, useMemo, and useRef with real-world examples.",
    content: "Most developers know useState and useEffect, but the hooks API goes much deeper...",
    published: true, publishedAt: "2024-01-12T08:30:00Z",
    createdAt: "2024-01-11T20:00:00Z", updatedAt: "2024-01-12T08:30:00Z",
  },
  {
    id: 4, authorId: 4, categoryId: 7, mediaId: 7,
    title: "Docker Compose for Local Development",
    slug: "docker-compose-local-development",
    excerpt: "Set up a consistent, reproducible local dev environment with Docker Compose.",
    content: "Docker Compose lets you define multi-container applications in a single YAML file...",
    published: true, publishedAt: "2024-01-22T10:00:00Z",
    createdAt: "2024-01-21T18:00:00Z", updatedAt: "2024-01-22T10:00:00Z",
  },
  {
    id: 5, authorId: 1, categoryId: 4, mediaId: 4,
    title: "Node.js Streams Explained",
    slug: "nodejs-streams-explained",
    excerpt: "Process large data efficiently using Node.js readable, writable, and transform streams.",
    content: "Streams are one of the most powerful and underused features of Node.js...",
    published: true, publishedAt: "2024-01-14T09:00:00Z",
    createdAt: "2024-01-13T21:00:00Z", updatedAt: "2024-01-14T09:00:00Z",
  },
  {
    id: 6, authorId: 5, categoryId: 5, mediaId: 5,
    title: "CSS Grid: The Complete Visual Guide",
    slug: "css-grid-complete-visual-guide",
    excerpt: "Master CSS Grid with annotated diagrams and hands-on examples.",
    content: "CSS Grid transformed how we lay out web pages. In this guide we cover everything...",
    published: true, publishedAt: "2024-01-17T11:00:00Z",
    createdAt: "2024-01-16T19:00:00Z", updatedAt: "2024-01-17T11:00:00Z",
  },
  {
    id: 7, authorId: 6, categoryId: 6, mediaId: 6,
    title: "PostgreSQL Indexing Strategies",
    slug: "postgresql-indexing-strategies",
    excerpt: "B-tree, GIN, GiST, and partial indexes — when to use which and why.",
    content: "Slow queries are usually an indexing problem. Here is how to diagnose and fix them...",
    published: true, publishedAt: "2024-01-20T10:00:00Z",
    createdAt: "2024-01-19T17:00:00Z", updatedAt: "2024-01-20T10:00:00Z",
  },
  {
    id: 8, authorId: 9, categoryId: 8, mediaId: 8,
    title: "The Testing Pyramid in Practice",
    slug: "testing-pyramid-in-practice",
    excerpt: "How to balance unit, integration, and end-to-end tests in a real project.",
    content: "The testing pyramid is a simple heuristic for structuring your test suite...",
    published: true, publishedAt: "2024-01-24T09:30:00Z",
    createdAt: "2024-01-23T17:00:00Z", updatedAt: "2024-01-24T09:30:00Z",
  },
  {
    id: 9, authorId: 15, categoryId: 9, mediaId: 9,
    title: "Core Web Vitals: What Developers Need to Know",
    slug: "core-web-vitals-developers-guide",
    excerpt: "LCP, INP, and CLS explained — and how to measure and improve each one.",
    content: "Google uses Core Web Vitals as a ranking signal. Here is what that means for you...",
    published: true, publishedAt: "2024-01-27T10:00:00Z",
    createdAt: "2024-01-26T19:00:00Z", updatedAt: "2024-01-27T10:00:00Z",
  },
  {
    id: 10, authorId: 17, categoryId: 10, mediaId: 10,
    title: "From IC to Engineering Manager: Lessons Learned",
    slug: "ic-to-engineering-manager-lessons",
    excerpt: "What nobody tells you about the transition from individual contributor to manager.",
    content: "Two years ago I made the switch from senior engineer to engineering manager...",
    published: true, publishedAt: "2024-01-30T08:00:00Z",
    createdAt: "2024-01-29T20:00:00Z", updatedAt: "2024-01-30T08:00:00Z",
  },
  {
    id: 11, authorId: 1, categoryId: 1, mediaId: 11,
    title: "Async/Await vs Promises: When to Use Which",
    slug: "async-await-vs-promises",
    excerpt: "A clear comparison of async/await and promise chains with practical examples.",
    content: "Promises and async/await both deal with asynchronous operations in JavaScript...",
    published: true, publishedAt: "2024-02-03T10:00:00Z",
    createdAt: "2024-02-02T18:00:00Z", updatedAt: "2024-02-03T10:00:00Z",
  },
  {
    id: 12, authorId: 6, categoryId: 6, mediaId: 12,
    title: "Prisma Schema Design Best Practices",
    slug: "prisma-schema-design-best-practices",
    excerpt: "Tips for modelling relations, enums, and constraints in your Prisma schema.",
    content: "A well-designed Prisma schema makes your codebase easier to understand...",
    published: true, publishedAt: "2024-02-05T09:00:00Z",
    createdAt: "2024-02-04T17:00:00Z", updatedAt: "2024-02-05T09:00:00Z",
  },
  {
    id: 13, authorId: 11, categoryId: null, mediaId: 13,
    title: "JWT Authentication: Common Pitfalls",
    slug: "jwt-authentication-common-pitfalls",
    excerpt: "Avoid these mistakes when implementing JWT-based auth in your API.",
    content: "JWTs are widely used but also widely misused. Let us look at the most common errors...",
    published: true, publishedAt: "2024-02-07T11:00:00Z",
    createdAt: "2024-02-06T19:00:00Z", updatedAt: "2024-02-07T11:00:00Z",
  },
  {
    id: 14, authorId: 13, categoryId: 7, mediaId: 14,
    title: "Structuring a Monorepo with pnpm Workspaces",
    slug: "monorepo-pnpm-workspaces",
    excerpt: "How to set up a scalable monorepo for multiple apps and shared packages.",
    content: "Monorepos have become the standard for teams managing multiple related projects...",
    published: true, publishedAt: "2024-02-10T08:30:00Z",
    createdAt: "2024-02-09T16:00:00Z", updatedAt: "2024-02-10T08:30:00Z",
  },
  {
    id: 15, authorId: 15, categoryId: 3, mediaId: 15,
    title: "Server State vs Client State with React Query",
    slug: "server-state-vs-client-state-react-query",
    excerpt: "Stop storing server data in Redux — here is a better way.",
    content: "One of the most common mistakes in React apps is treating server state like UI state...",
    published: true, publishedAt: "2024-02-12T10:00:00Z",
    createdAt: "2024-02-11T18:00:00Z", updatedAt: "2024-02-12T10:00:00Z",
  },
  {
    id: 16, authorId: 4, categoryId: 7, mediaId: 16,
    title: "Kubernetes for Application Developers",
    slug: "kubernetes-for-application-developers",
    excerpt: "Everything an app developer needs to know about Kubernetes without the ops jargon.",
    content: "You don't need to be a Kubernetes expert to deploy apps on it effectively...",
    published: true, publishedAt: "2024-02-14T09:00:00Z",
    createdAt: "2024-02-13T17:00:00Z", updatedAt: "2024-02-14T09:00:00Z",
  },
  {
    id: 17, authorId: 6, categoryId: 6, mediaId: 17,
    title: "SQL Joins Visualised",
    slug: "sql-joins-visualised",
    excerpt: "INNER, LEFT, RIGHT, FULL OUTER, and CROSS joins with diagrams and examples.",
    content: "SQL joins are the foundation of relational databases. Here is every join type explained...",
    published: true, publishedAt: "2024-02-17T10:00:00Z",
    createdAt: "2024-02-16T19:00:00Z", updatedAt: "2024-02-17T10:00:00Z",
  },
  {
    id: 18, authorId: 2, categoryId: null, mediaId: 18,
    title: "Git Branching Strategies Compared",
    slug: "git-branching-strategies-compared",
    excerpt: "GitFlow, trunk-based development, and GitHub Flow — pros and cons of each.",
    content: "How you branch in Git affects your entire release and review process...",
    published: true, publishedAt: "2024-02-20T08:00:00Z",
    createdAt: "2024-02-19T16:00:00Z", updatedAt: "2024-02-20T08:00:00Z",
  },
  {
    id: 19, authorId: 19, categoryId: null, mediaId: 19,
    title: "Prompt Engineering for Developers",
    slug: "prompt-engineering-for-developers",
    excerpt: "Practical patterns for getting reliable outputs from LLMs in production systems.",
    content: "As LLMs become part of software stacks, developers need to think about prompt design...",
    published: true, publishedAt: "2024-02-22T10:00:00Z",
    createdAt: "2024-02-21T18:00:00Z", updatedAt: "2024-02-22T10:00:00Z",
  },
  {
    id: 20, authorId: 4, categoryId: 7, mediaId: 20,
    title: "Designing a Zero-Downtime CI/CD Pipeline",
    slug: "zero-downtime-cicd-pipeline",
    excerpt: "Blue-green deployments, canary releases, and feature flags — a practical overview.",
    content: null,
    published: false, publishedAt: null,
    createdAt: "2024-02-24T14:00:00Z", updatedAt: "2024-02-24T14:00:00Z",
  },
];
