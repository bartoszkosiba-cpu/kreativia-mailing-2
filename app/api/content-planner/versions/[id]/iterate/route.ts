import { NextRequest, NextResponse } from "next/server";
import { iterateContent } from "@/services/contentAI";

// POST - Iteruj nad wersją (feedback → nowa wersja)
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const versionId = parseInt(params.id);
    const { feedback } = await req.json();

    if (!feedback) {
      return NextResponse.json(
        { error: "Feedback jest wymagany" },
        { status: 400 }
      );
    }

    console.log(`[API] Iteruję wersję ${versionId}: "${feedback}"`);

    const result = await iterateContent(versionId, feedback);

    return NextResponse.json({
      success: true,
      ...result
    });
  } catch (error: any) {
    console.error("Błąd iteracji:", error);
    return NextResponse.json(
      { error: "Błąd iteracji", details: error.message },
      { status: 500 }
    );
  }
}

