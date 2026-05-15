import { pg } from "../../_helpers";
import type { MockTableDef } from "../../types";

const review: MockTableDef = {
  name: "Review",
  dbName: "reviews",
  comment: "Customer rating and text review submitted for a purchased product",
  sortOrder: 9,
  fields: [
    pg.pk(0),
    pg.fk("productId", "Reviewed product UUID", 1),
    pg.fk("customerId", "Reviewing customer UUID", 2),
    pg.int("rating", "Star rating from 1 (worst) to 5 (best)", 3),
    pg.text("body", "Free-text review content", 4, { nullable: true }),
    pg.bool("isApproved", "Whether the review has passed moderation", 5, false),
    pg.createdAt(6),
    pg.updatedAt(7),
  ],
};

export default review;
