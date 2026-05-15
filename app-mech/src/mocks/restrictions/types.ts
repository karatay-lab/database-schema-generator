export type MockRestrictionDef = {
  table: string;
  type: "UNIQUE" | "INDEX";
  name?: string;    // optional user-defined constraint name
  fields: string[]; // ordered list of field names covered by this constraint
};
