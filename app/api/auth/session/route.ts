import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/services/authService";

export async function GET() {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  return NextResponse.json(session);
}
