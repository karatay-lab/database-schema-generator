import { pg } from "../../_helpers";
import type { MockTableDef } from "../../types";

const revision: MockTableDef = {
  name: "Revision",
  dbName: "revisions",
  comment: "Immutable point-in-time snapshot of a post body for version history",
  sortOrder: 2,
  fields: [
    pg.pk(0),
    pg.fk("postId", "Post this revision belongs to", 1),
    pg.fk("authorId", "Author who saved this revision", 2),
    pg.text("content", "Full body snapshot at the time of saving", 3, { nullable: false }),
    pg.int("version", "Monotonically increasing revision number within the post", 4, 1),
    pg.createdAt(5),
  ],
};

export default revision;
