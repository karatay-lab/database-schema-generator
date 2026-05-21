export type CategoryRow = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
};

export const categories: CategoryRow[] = [
  { id: 1,  name: "JavaScript",   slug: "javascript",   description: "Articles about JavaScript, the language of the web." },
  { id: 2,  name: "TypeScript",   slug: "typescript",   description: "Type-safe JavaScript — patterns, tips, and deep dives." },
  { id: 3,  name: "React",        slug: "react",        description: "Component design, hooks, and the React ecosystem." },
  { id: 4,  name: "Node.js",      slug: "nodejs",       description: "Server-side JavaScript, APIs, and tooling." },
  { id: 5,  name: "CSS",          slug: "css",          description: "Styling, layouts, animations, and design systems." },
  { id: 6,  name: "Databases",    slug: "databases",    description: "SQL, NoSQL, ORMs, schema design, and query optimisation." },
  { id: 7,  name: "DevOps",       slug: "devops",       description: "CI/CD, containers, infrastructure as code, and SRE." },
  { id: 8,  name: "Testing",      slug: "testing",      description: "Unit, integration, and end-to-end testing strategies." },
  { id: 9,  name: "Performance",  slug: "performance",  description: "Web vitals, profiling, and speed optimisation techniques." },
  { id: 10, name: "Career",       slug: "career",       description: null },
];
