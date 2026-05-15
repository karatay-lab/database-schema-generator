import type { MockRelationDef } from "../../types";

const relations: MockRelationDef[] = [
  {
    name: "PostToAuthor",
    cardinality: "many-to-one",
    onDelete: "Restrict",
    onUpdate: "Cascade",
    source: { table: "Post", fkField: "authorId", virtualField: "author", isList: false, nullable: false },
    target: { table: "Author", pkField: "id", virtualField: "posts", isList: true, nullable: false },
  },
  {
    name: "RevisionToPost",
    cardinality: "many-to-one",
    onDelete: "Cascade",
    onUpdate: "Cascade",
    source: { table: "Revision", fkField: "postId", virtualField: "post", isList: false, nullable: false },
    target: { table: "Post", pkField: "id", virtualField: "revisions", isList: true, nullable: false },
  },
  {
    name: "RevisionToAuthor",
    cardinality: "many-to-one",
    onDelete: "Restrict",
    onUpdate: "Cascade",
    source: { table: "Revision", fkField: "authorId", virtualField: "author", isList: false, nullable: false },
    target: { table: "Author", pkField: "id", virtualField: "revisions", isList: true, nullable: false },
  },
  {
    name: "CategoryToParent",
    cardinality: "many-to-one",
    onDelete: "SetNull",
    onUpdate: "Cascade",
    source: { table: "Category", fkField: "parentId", virtualField: "parent", isList: false, nullable: true },
    target: { table: "Category", pkField: "id", virtualField: "children", isList: true, nullable: false },
  },
  {
    name: "MediaToAuthor",
    cardinality: "many-to-one",
    onDelete: "Restrict",
    onUpdate: "Cascade",
    source: { table: "Media", fkField: "authorId", virtualField: "author", isList: false, nullable: false },
    target: { table: "Author", pkField: "id", virtualField: "media", isList: true, nullable: false },
  },
  {
    name: "CommentToPost",
    cardinality: "many-to-one",
    onDelete: "Cascade",
    onUpdate: "Cascade",
    source: { table: "Comment", fkField: "postId", virtualField: "post", isList: false, nullable: false },
    target: { table: "Post", pkField: "id", virtualField: "comments", isList: true, nullable: false },
  },
  {
    name: "PageToAuthor",
    cardinality: "many-to-one",
    onDelete: "Restrict",
    onUpdate: "Cascade",
    source: { table: "Page", fkField: "authorId", virtualField: "author", isList: false, nullable: false },
    target: { table: "Author", pkField: "id", virtualField: "pages", isList: true, nullable: false },
  },
  {
    name: "MenuItemToMenu",
    cardinality: "many-to-one",
    onDelete: "Cascade",
    onUpdate: "Cascade",
    source: { table: "MenuItem", fkField: "menuId", virtualField: "menu", isList: false, nullable: false },
    target: { table: "Menu", pkField: "id", virtualField: "items", isList: true, nullable: false },
  },
  {
    name: "MenuItemToParent",
    cardinality: "many-to-one",
    onDelete: "SetNull",
    onUpdate: "Cascade",
    source: { table: "MenuItem", fkField: "parentId", virtualField: "parent", isList: false, nullable: true },
    target: { table: "MenuItem", pkField: "id", virtualField: "children", isList: true, nullable: false },
  },
];

export default relations;
