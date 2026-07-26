import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/services/authService";
import { getAllUsers } from "@/lib/services/adminService";

// TODO: getAllUsers() still returns mock rows — real user listing needs a service-role
// query against `profiles` (or a Postgres function), since RLS only lets a user read their
// own row. The role check below is real: it queries the caller's own profiles.role.
export async function GET() {
  const session = await getCurrentSession();
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const users = await getAllUsers();
  return NextResponse.json(users);
}
