import author from "./author";
import post from "./post";
import revision from "./revision";
import category from "./category";
import tag from "./tag";
import media from "./media";
import comment from "./comment";
import page from "./page";
import menu from "./menu";
import menuItem from "./menu-item";
import type { MockTableDef } from "../../types";

export const contentHubProTables: MockTableDef[] = [
  author,
  post,
  revision,
  category,
  tag,
  media,
  comment,
  page,
  menu,
  menuItem,
];
