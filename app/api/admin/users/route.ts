import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/services/apiAuth";
import { getAllUsers } from "@/lib/services/adminService";

// Real per-user data — never cache (see app/api/dashboard/route.ts for why).
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const auth = await requireAdminSession();
  if (auth.response) return auth.response;

  const users = await getAllUsers();
  return NextResponse.json(users, { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } });
}
