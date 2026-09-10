import { NextResponse } from "next/server";
import { requireSession } from "@/lib/services/apiAuth";

export async function GET() {
  const auth = await requireSession();
  if (auth.response) return auth.response;

  return NextResponse.json(auth.session);
}
