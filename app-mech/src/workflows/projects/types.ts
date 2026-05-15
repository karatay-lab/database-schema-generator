export type SchemaOptions = {
  client: string;
  graphql: string;
};

export type ProjectVersion = {
  id: string;
  name: string;
  major: number;
  minor: number;
  createdAt: string;
  sortOrder: number;
};

export type Project = {
  id: string;
  name: string;
  provider: string;
  schemaOptions: SchemaOptions;
  health: string;
  tables: number;
  fields: number;
  relations: number;
  restrictions: number;
  versions: ProjectVersion[];
};

export type CreateProjectInput = {
  name: string;
  provider: string;
  schemaOptions: SchemaOptions;
  health?: string;
};

export type UpdateProjectInput = {
  name?: string;
  provider?: string;
  schemaOptions?: SchemaOptions;
  health?: string;
};

export type ForkResult = {
  projects: Project[];
  project: Project;
  newVersion: string;
};


export type ProjectRow = {
  id: string;
  name: string;
  provider: string;
  schemaOptions: string;
  health: string;
  tables: number;
  fields: number;
  relations: number;
  restrictions: number;
  projectVersions: Array<{
    id: string;
    name: string;
    major: number;
    minor: number;
    createdAt: string;
    sortOrder: number;
  }>;
};