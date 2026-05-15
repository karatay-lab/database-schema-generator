import { pg } from "../../_helpers";
import type { MockTableDef } from "../../types";

const comment: MockTableDef = {
  name: "Comment",
  dbName: "comments",
  comment: "Reader-submitted response on a published post — subject to moderation",
  sortOrder: 6,
  fields: [
    pg.pk(0),
    pg.fk("postId", "Post this comment is attached to", 1),
    pg.fk("authorId", "Registered author who submitted the comment (null for guests)", 2, { nullable: true }),
    pg.varchar("guestName", 100, "Display name for non-authenticated commenters", 3, { nullable: true }),
    pg.text("body", "Comment content submitted by the reader", 4, { nullable: false }),
    pg.bool("isApproved", "Whether the comment has passed moderation and is publicly visible", 5, false),
    pg.createdAt(6),
    pg.updatedAt(7),
  ],
};

export default comment;
