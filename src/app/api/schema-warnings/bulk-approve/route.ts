import { NextResponse } from "next/server";
import { approveWarnings } from "@/lib/schema-warnings-store";

export async function POST(request: Request) {
  let ids: string[];
  try {
    const body = (await request.json()) as { ids?: unknown };
    ids = Array.isArray(body.ids) ? (body.ids as string[]) : [];
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request body." }, { status: 400 });
  }
  if (ids.length === 0) {
    return NextResponse.json({ success: true, approved: 0 });
  }
  try {
    approveWarnings(ids);
    return NextResponse.json({ success: true, approved: ids.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to approve warnings.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
