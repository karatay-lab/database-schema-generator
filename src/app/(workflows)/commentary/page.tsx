import { Suspense } from "react";
import { CommentaryPageContent } from "@/app/views/commentary/commentary-page";
import { WorkflowSkeleton } from "@/app/views/shared/workflow-skeleton";

export default function CommentaryPage() {
  return (
    <Suspense fallback={<WorkflowSkeleton />}>
      <CommentaryPageContent />
    </Suspense>
  );
}
