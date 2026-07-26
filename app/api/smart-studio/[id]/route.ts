import { NextResponse } from "next/server";
import { getTest } from "@/lib/services/smartStudioService";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const test = await getTest(id);
  if (!test) {
    return NextResponse.json({ error: "Test not found" }, { status: 404 });
  }
  return NextResponse.json(test);
}
