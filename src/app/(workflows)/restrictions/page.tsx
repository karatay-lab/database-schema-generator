import { Suspense } from "react";
import { RestrictionsPageContent } from "@/app/views/restrictions/restrictions-page";
import { WorkflowSkeleton } from "@/app/views/shared/workflow-skeleton";

export default function RestrictionsPage() {
  return (
    <Suspense fallback={<WorkflowSkeleton />}>
      <RestrictionsPageContent />
    </Suspense>
  );
}
