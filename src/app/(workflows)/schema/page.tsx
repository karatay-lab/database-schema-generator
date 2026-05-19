import { Suspense } from "react";
import { SchemaPageContent } from "@/app/views/schema/schema-page";
import { WorkflowSkeleton } from "@/app/views/shared/workflow-skeleton";

export default function SchemaPage() {
  return (
    <Suspense fallback={<WorkflowSkeleton />}>
      <SchemaPageContent />
    </Suspense>
  );
}
