export type Cardinality = "many-to-one" | "one-to-many" | "one-to-one" | "many-to-many";

export type MockRelationDef = {
  name: string;
  cardinality: Cardinality;
  onDelete: string;
  onUpdate: string;
  // source = the table that holds the FK column(s)
  source: {
    table: string;
    fkField: string;      // FK field name on the source table
    virtualField: string; // virtual Prisma relation field on this model
    isList: boolean;
    nullable: boolean;
  };
  // target = the referenced table (usually holds the PK)
  target: {
    table: string;
    pkField: string;      // PK field name on the target table (almost always "id")
    virtualField: string; // back-reference virtual field on this model
    isList: boolean;
    nullable: boolean;
  };
};
