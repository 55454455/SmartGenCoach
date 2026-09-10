import { NextResponse } from "next/server";
import { requireRateLimit, requireSession } from "@/lib/services/apiAuth";
import { getUserTests, uploadDocument } from "@/lib/services/smartStudioService";

// Same reasoning as app/api/exam/upload/route.ts — document extraction is a real, potentially
// slow Claude call and must not be killed by the platform's default function timeout.
export const maxDuration = 60;

export async function GET() {
  const auth = await requireSession();
  if (auth.response) return auth.response;

  const tests = await getUserTests(auth.session.user.id);
  return NextResponse.json(tests);
}

export async function POST(request: Request) {
  const auth = await requireSession();
  if (auth.response) return auth.response;

  const limited = requireRateLimit(auth.session.user.id, "smart-studio-upload", 10, 10 * 60 * 1000);
  if (limited) return limited;

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "A file is required." }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const test = await uploadDocument({
      userId: auth.session.user.id,
      fileName: file.name,
      fileType: file.type,
      fileSizeBytes: file.size,
      fileData: buffer.toString("base64"),
    });
    return NextResponse.json(test);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not process that document.";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
