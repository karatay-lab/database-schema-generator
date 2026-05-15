import { pg } from "../../_helpers";
import type { MockTableDef } from "../../types";

const media: MockTableDef = {
  name: "Media",
  dbName: "media",
  comment: "Uploaded file or image asset with storage metadata and accessibility info",
  sortOrder: 5,
  fields: [
    pg.pk(0),
    pg.fk("authorId", "Author who uploaded the file", 1),
    pg.varchar("type", 20, "Asset category: image | video | document | audio", 2),
    pg.varchar("url", 500, "Public CDN or storage URL to the file", 3),
    pg.varchar("mimeType", 100, "IANA media type, e.g. image/jpeg or application/pdf", 4),
    pg.int("fileSize", "File size in bytes", 5),
    pg.varchar("altText", 255, "Accessibility alt text for images", 6, { nullable: true }),
    pg.jsonb("metadata", "Image dimensions, duration, codec, EXIF data", 7),
    pg.createdAt(8),
    pg.updatedAt(9),
  ],
};

export default media;
