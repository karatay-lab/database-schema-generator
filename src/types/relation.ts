export type RelationCardinality = "one-to-one" | "one-to-many";

export type RelationTab = "relations" | "references";

export type FieldMappingPanel = "local" | "target";

export type RelationDraft = {
  name: string;
  targetModel: string;
  backReferenceName: string;
  cardinality: RelationCardinality;
  fields: string;
  references: string;
  onDelete: string;
  onUpdate: string;
  nullable: boolean;
};
