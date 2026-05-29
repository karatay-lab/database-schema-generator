import { NextResponse } from "next/server";
import { approveWarning, unapproveWarning, remapWarning } from "@/lib/schema-warnings-store";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ success: false, error: "Warning ID required." }, { status: 400 });
  }

  let body: { action?: string; replacementValue?: string } = {};
  try {
    const text = await request.text();
    if (text) body = JSON.parse(text) as typeof body;
  } catch { /* no body or not JSON */ }

  try {
    if (body.action === "unapprove") {
      unapproveWarning(id);
      return NextResponse.json({ success: true });
    }
    if (body.action === "remap") {
      const rv = typeof body.replacementValue === "string" ? body.replacementValue.trim() : "";
      remapWarning(id, rv);
      return NextResponse.json({ success: true });
    }
    // default: approve
    const replacementValue =
      typeof body.replacementValue === "string" && body.replacementValue.trim()
        ? body.replacementValue.trim()
        : undefined;
    approveWarning(id, replacementValue);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update warning.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
