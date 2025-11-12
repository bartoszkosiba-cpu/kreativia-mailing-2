import { NextRequest, NextResponse } from "next/server";
import { generateIndustrySuggestion } from "@/services/industryAiAgent";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const industry = typeof body.industry === "string" ? body.industry.trim() : "";
    const examples = Array.isArray(body.examples) ? body.examples : [];

    if (!industry) {
      return NextResponse.json({ error: "Brak industry" }, { status: 400 });
    }

    const result = await generateIndustrySuggestion({ industry, examples });

    if (!result) {
      return NextResponse.json({ success: false, message: "Brak propozycji" });
    }

    return NextResponse.json({ success: true, suggestion: result });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Błąd generowania sugestii",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
