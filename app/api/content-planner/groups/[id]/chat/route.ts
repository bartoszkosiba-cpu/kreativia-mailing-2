import { NextRequest, NextResponse } from "next/server";
import { chatWithProductGroupAI } from "@/services/contentAI-v2";

// POST - Chat z AI na poziomie grupy produktowej
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const groupId = parseInt(params.id);
    const { message } = await req.json();

    if (!message) {
      return NextResponse.json(
        { error: "Wiadomość jest wymagana" },
        { status: 400 }
      );
    }

    console.log(`[API] Chat z AI dla grupy ${groupId}: "${message}"`);

    const aiResponse = await chatWithProductGroupAI(groupId, message);

    return NextResponse.json({
      success: true,
      response: aiResponse
    });
  } catch (error: any) {
    console.error("Błąd chat z AI:", error);
    return NextResponse.json(
      { error: "Błąd komunikacji z AI", details: error.message },
      { status: 500 }
    );
  }
}

