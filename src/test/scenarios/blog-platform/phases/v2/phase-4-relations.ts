import { api, PROJECT_NAME } from "../../client";

export async function updateRelations(version: string) {
  // ─── Delete Post.featuredImage (was pointing at Media, now renamed Asset) ──

  const postRels = await api.relations.list({ projectName: PROJECT_NAME, version, modelName: "Post" });
  const oldFeatured = postRels?.relations.find((r) => r.name === "featuredImage");
  if (oldFeatured) {
    await api.relations.delete({
      projectName: PROJECT_NAME, version, modelName: "Post",
      relationKey: oldFeatured.key,
    });
    console.log("  ✓ Deleted Post.featuredImage (stale Media reference)");
  } else {
    console.log("  ✓ Post.featuredImage already removed — skipping delete.");
  }

  // ─── Clean up stale fields left from deleted relation ─────────────────────

  // Post.mediaId is the orphaned FK scalar from the old featuredImage → Media
  const postFields = await api.fields.list({ projectName: PROJECT_NAME, version, modelName: "Post" });
  if (postFields?.fields.some((f) => f.name === "mediaId")) {
    await api.fields.delete({ projectName: PROJECT_NAME, version, modelName: "Post", fieldName: "mediaId" });
    console.log("  ✓ Deleted stale Post.mediaId");
  } else {
    console.log("  ✓ Post.mediaId already clean — skipping.");
  }

  // Asset.posts is the orphaned back-reference from Media's old relation
  const assetFields = await api.fields.list({ projectName: PROJECT_NAME, version, modelName: "Asset" });
  if (assetFields?.fields.some((f) => f.name === "posts")) {
    await api.fields.delete({ projectName: PROJECT_NAME, version, modelName: "Asset", fieldName: "posts" });
    console.log("  ✓ Deleted stale Asset.posts back-reference");
  } else {
    console.log("  ✓ Asset.posts already clean — skipping.");
  }

  // Post.featuredImage may still exist as a stale canonical field (type: "Media") even though
  // relations.list filters it out when the target model no longer matches — delete it directly
  const relsCheck = await api.relations.list({ projectName: PROJECT_NAME, version, modelName: "Post" });
  const hasFeaturedImage = relsCheck?.relations.some((r) => r.name === "featuredImage");
  if (!hasFeaturedImage) {
    const postFieldsCheck = await api.fields.list({ projectName: PROJECT_NAME, version, modelName: "Post" });
    if (postFieldsCheck?.fields.some((f) => f.name === "featuredImage")) {
      await api.fields.delete({ projectName: PROJECT_NAME, version, modelName: "Post", fieldName: "featuredImage" });
      console.log("  ✓ Deleted stale Post.featuredImage field");
    }
    if (postFieldsCheck?.fields.some((f) => f.name === "assetId")) {
      await api.fields.delete({ projectName: PROJECT_NAME, version, modelName: "Post", fieldName: "assetId" });
      console.log("  ✓ Deleted orphaned Post.assetId");
    }
  }

  // ─── New / rebuilt relations ───────────────────────────────────────────────

  type RelDef = {
    modelName: string; name: string; targetModel: string; backReferenceName: string;
    fields: string[]; references: string[];
    nullable?: boolean; onDelete?: string;
    isArray?: boolean; backReferenceIsArray?: boolean;
  };

  const RELATIONS: RelDef[] = [
    // Post.featuredImage → Asset  (rebuild after rename; use "featuredPosts" back-ref)
    {
      modelName: "Post", name: "featuredImage", targetModel: "Asset",
      backReferenceName: "featuredPosts", fields: ["assetId"], references: ["id"],
      nullable: true, onDelete: "SetNull",
    },
    // Profile → User  (one-to-one)
    {
      modelName: "Profile", name: "user", targetModel: "User",
      backReferenceName: "profile", fields: ["userId"], references: ["id"],
      onDelete: "Cascade", backReferenceIsArray: false,
    },
    // Like → Post
    {
      modelName: "Like", name: "post", targetModel: "Post",
      backReferenceName: "likes", fields: ["postId"], references: ["id"],
      onDelete: "Cascade",
    },
    // Like → User
    {
      modelName: "Like", name: "user", targetModel: "User",
      backReferenceName: "likes", fields: ["userId"], references: ["id"],
      onDelete: "Cascade",
    },
  ];

  for (const rel of RELATIONS) {
    const existing = await api.relations.list({ projectName: PROJECT_NAME, version, modelName: rel.modelName });
    if (existing?.relations.some((r) => r.name === rel.name)) {
      console.log(`  ✓ ${rel.modelName}.${rel.name} → ${rel.targetModel} already exists — skipping.`);
      continue;
    }
    await api.relations.create({
      projectName: PROJECT_NAME, version, modelName: rel.modelName,
      name: rel.name, targetModel: rel.targetModel,
      backReferenceName: rel.backReferenceName,
      fields: rel.fields, references: rel.references,
      onDelete: rel.onDelete ?? "", onUpdate: "",
      nullable: rel.nullable ?? false,
      isArray: rel.isArray ?? false,
      backReferenceIsArray: rel.backReferenceIsArray ?? true,
    });
    console.log(`  ✓ ${rel.modelName}.${rel.name} → ${rel.targetModel} (FK: ${rel.fields.join(", ")})`);
  }
}
