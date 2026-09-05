import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/services/apiAuth";
import { getAllUsers } from "@/lib/services/adminService";

// TODO: getAllUsers() still returns mock rows — real user listing needs a service-role
// query against `profiles` (or a Postgres function), since RLS only lets a user read their
// own row. The role check in requireAdminSession() is real: it queries the caller's own
// profiles.role.
export async function GET() {
  const auth = await requireAdminSession();
  if (auth.response) return auth.response;

  const users = await getAllUsers();
  return NextResponse.json(users);
}
