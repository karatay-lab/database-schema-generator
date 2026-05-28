import { NextResponse } from "next/server";
import { approveWarning } from "@/lib/schema-warnings-store";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ success: false, error: "Warning ID required." }, { status: 400 });
  }
  let replacementValue: string | undefined;
  try {
    const text = await request.text();
    if (text) {
      const body = JSON.parse(text) as { replacementValue?: string };
      if (typeof body.replacementValue === "string" && body.replacementValue.trim()) {
        replacementValue = body.replacementValue.trim();
      }
    }
  } catch { /* no body or not JSON — replacementValue stays undefined */ }

  try {
    approveWarning(id, replacementValue);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to approve warning.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
