import type { MockRestrictionDef } from "../../types";

const restrictions: MockRestrictionDef[] = [
  // Unique URL slugs
  { table: "Post",     type: "UNIQUE", name: "post_slug_unique",     fields: ["slug"] },
  { table: "Category", type: "UNIQUE", name: "category_slug_unique", fields: ["slug"] },
  { table: "Tag",      type: "UNIQUE", name: "tag_slug_unique",      fields: ["slug"] },
  { table: "Page",     type: "UNIQUE", name: "page_slug_unique",     fields: ["slug"] },

  // No two revisions can share the same version number for the same post
  { table: "Revision", type: "UNIQUE", name: "revision_version_unique", fields: ["postId", "version"] },

  // Query-path indexes
  { table: "Post",     type: "INDEX", name: "post_author_idx",     fields: ["authorId"] },
  { table: "Comment",  type: "INDEX", name: "comment_post_idx",    fields: ["postId"] },
  { table: "MenuItem", type: "INDEX", name: "menu_item_menu_idx",  fields: ["menuId"] },
];

export default restrictions;
