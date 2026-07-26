import { NextResponse } from "next/server";
import { getUserTests, uploadDocument } from "@/lib/services/smartStudioService";

export async function GET() {
  const tests = await getUserTests();
  return NextResponse.json(tests);
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "A file is required." }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const test = await uploadDocument({
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
