import { NextResponse } from "next/server";
import { requireRateLimit, requireSession } from "@/lib/services/apiAuth";
import {
  createUploadedExamFromDocument,
  createUploadedExamFromUrl,
  getUploadedExams,
} from "@/lib/services/uploadedExamService";
import { isExamType } from "@/lib/examMeta";

// Extraction runs a real Claude call (with thinking + up to 3 retries) against an uploaded
// PDF/image and can take well past Vercel's default serverless timeout (10s on Hobby). Raise it
// to the Hobby-plan max so uploads don't get killed mid-request; Pro/Enterprise projects can raise
// this further if needed.
export const maxDuration = 60;

export async function GET(request: Request) {
  const auth = await requireSession();
  if (auth.response) return auth.response;

  const requestedType = new URL(request.url).searchParams.get("examType");
  const examType = requestedType && isExamType(requestedType) ? requestedType : undefined;
  const exams = await getUploadedExams(auth.session.user.id, examType);
  return NextResponse.json(exams);
}

export async function POST(request: Request) {
  const auth = await requireSession();
  if (auth.response) return auth.response;

  const formData = await request.formData();
  const requestedType = formData.get("examType");
  const sourceType = formData.get("sourceType");
  if (typeof requestedType !== "string" || !isExamType(requestedType) || (sourceType !== "document" && sourceType !== "url")) {
    return NextResponse.json({ error: "A valid examType and sourceType are required." }, { status: 400 });
  }
  const examType = requestedType;

  const limited = requireRateLimit(auth.session.user.id, "exam-upload", 10, 10 * 60 * 1000);
  if (limited) return limited;

  try {
    if (sourceType === "document") {
      const file = formData.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json({ error: "A file is required." }, { status: 400 });
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      const exam = await createUploadedExamFromDocument({
        userId: auth.session.user.id,
        examType,
        fileName: file.name,
        fileType: file.type,
        fileData: buffer.toString("base64"),
      });
      return NextResponse.json(exam);
    }

    const sourceUrl = formData.get("sourceUrl");
    if (typeof sourceUrl !== "string" || !sourceUrl.trim()) {
      return NextResponse.json({ error: "A URL is required." }, { status: 400 });
    }
    const exam = await createUploadedExamFromUrl({ userId: auth.session.user.id, examType, sourceUrl: sourceUrl.trim() });
    return NextResponse.json(exam);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not build an exam from that source.";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
