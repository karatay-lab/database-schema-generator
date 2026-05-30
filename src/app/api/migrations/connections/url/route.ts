import { NextResponse } from "next/server";
import { getConnection } from "@/lib/db/migration-connections";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const connectionId = searchParams.get("connectionId")?.trim() ?? "";
  if (!connectionId) {
    return NextResponse.json({ success: false, error: "connectionId is required." }, { status: 400 });
  }

  const conn = getConnection(connectionId);
  if (!conn) {
    return NextResponse.json({ success: false, error: "Connection not found." }, { status: 404 });
  }

  const p = conn.provider.toLowerCase();
  const proto = p === "mysql" ? "mysql" : p === "sqlite" ? "file" : "postgresql";

  const url = p === "sqlite"
    ? conn.database
    : `${proto}://${encodeURIComponent(conn.user)}:${encodeURIComponent(conn.password)}@${conn.host}:${conn.port}/${conn.database}`;

  return NextResponse.json({
    success: true,
    url,
    provider: conn.provider,
    name: conn.name,
  });
}
