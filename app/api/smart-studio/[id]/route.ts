import { NextResponse } from "next/server";
import { requireSession } from "@/lib/services/apiAuth";
import { getTest } from "@/lib/services/smartStudioService";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSession();
  if (auth.response) return auth.response;

  const { id } = await params;
  const test = await getTest(id);
  if (!test) {
    return NextResponse.json({ error: "Test not found" }, { status: 404 });
  }
  return NextResponse.json(test);
}
