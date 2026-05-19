import { Suspense } from "react";
import { RelationsPageContent } from "@/app/views/relations/relations-page";
import { WorkflowSkeleton } from "@/app/views/shared/workflow-skeleton";

export default function RelationsPage() {
  return (
    <Suspense fallback={<WorkflowSkeleton />}>
      <RelationsPageContent />
    </Suspense>
  );
}
