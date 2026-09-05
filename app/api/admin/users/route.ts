import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/services/apiAuth";
import { getAllUsers } from "@/lib/services/adminService";

export async function GET() {
  const auth = await requireAdminSession();
  if (auth.response) return auth.response;

  const users = await getAllUsers();
  return NextResponse.json(users);
}
