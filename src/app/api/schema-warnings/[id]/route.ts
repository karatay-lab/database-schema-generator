import { NextResponse } from "next/server";
import { approveWarning } from "@/lib/schema-warnings-store";

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ success: false, error: "Warning ID required." }, { status: 400 });
  }
  try {
    approveWarning(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to approve warning.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
