import type { ProjectV2Delta } from "../../types";

const delta: ProjectV2Delta = {
  tableRenames: [
    { from: "Revision", to: "Draft",   dbName: "drafts" },
    { from: "MenuItem", to: "NavItem", dbName: "nav_items" },
  ],

  fieldRenames: [
    { table: "Author",   from: "bio",   to: "biography" },
    { table: "Post",     from: "body",  to: "content" },
    { table: "MenuItem", from: "label", to: "title" },
  ],

  fieldTypeChanges: [
    { table: "Media",    field: "fileSize", logicalType: "bigint", nativeType: null },
    { table: "Revision", field: "version",  logicalType: "string", nativeType: null },
  ],

  removedRelations: [
    "RevisionToAuthor",
    "MenuItemToParent",
  ],

  removedRestrictions: [
    "revision_version_unique",
    "menu_item_menu_idx",
  ],
};

export default delta;
