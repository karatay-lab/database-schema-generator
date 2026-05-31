export type SchemaOptions = {
  client: string;
  graphql: string;
};

export type ProjectVersion = {
  name: string;
  createdAt: string;
};

export type Project = {
  id: string;
  name: string;
  provider: string;
  schemaOptions: SchemaOptions;
  health: string;
  tables: number;
  fields: number;
  imports?: number;
  enums?: number;
  relations: number;
  restrictions?: number;
  versions: ProjectVersion[];
};
