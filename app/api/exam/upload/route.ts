import { NextResponse } from "next/server";
import {
  createUploadedExamFromDocument,
  createUploadedExamFromUrl,
  getUploadedExams,
} from "@/lib/services/uploadedExamService";
import type { ExamType } from "@/lib/types";

export async function GET(request: Request) {
  const examType = new URL(request.url).searchParams.get("examType") as ExamType | null;
  const exams = await getUploadedExams(examType ?? undefined);
  return NextResponse.json(exams);
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const examType = formData.get("examType") as ExamType | null;
  const sourceType = formData.get("sourceType");
  if (!examType || (sourceType !== "document" && sourceType !== "url")) {
    return NextResponse.json({ error: "examType and sourceType are required." }, { status: 400 });
  }

  try {
    if (sourceType === "document") {
      const file = formData.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json({ error: "A file is required." }, { status: 400 });
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      const exam = await createUploadedExamFromDocument({
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
    const exam = await createUploadedExamFromUrl({ examType, sourceUrl: sourceUrl.trim() });
    return NextResponse.json(exam);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not build an exam from that source.";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
