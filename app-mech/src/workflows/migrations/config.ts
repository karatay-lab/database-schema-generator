export type DbConfig = {
  provider: "postgresql" | "mysql";
  prismaUrl: string;
  insertUrl: string;
  schema?: string;
};

export const PROJECT_DB: Record<string, DbConfig> = {
  "Analytics Engine": {
    provider: "mysql",
    prismaUrl: process.env.MYSQL_URL ?? "mysql://dev:dev@localhost:54322/dev?allowPublicKeyRetrieval=true&useSSL=false",
    insertUrl: process.env.MYSQL_URL ?? "mysql://dev:dev@localhost:54322/dev?allowPublicKeyRetrieval=true&useSSL=false",
  },
  "Content Hub Pro": {
    provider: "postgresql",
    prismaUrl: process.env.CONTENT_HUB_URL ?? "postgresql://dev:dev@localhost:54321/dev?schema=content_hub",
    insertUrl: process.env.POSTGRES_URL ?? "postgresql://dev:dev@localhost:54321/dev",
    schema: "content_hub",
  },
  "Shopfront Manager": {
    provider: "postgresql",
    prismaUrl: process.env.SHOPFRONT_URL ?? "postgresql://dev:dev@localhost:54321/dev?schema=shopfront",
    insertUrl: process.env.POSTGRES_URL ?? "postgresql://dev:dev@localhost:54321/dev",
    schema: "shopfront",
  },
};

export function toSlug(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
}
