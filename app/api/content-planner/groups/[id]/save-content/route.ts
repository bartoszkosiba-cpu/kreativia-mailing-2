import { NextRequest, NextResponse } from "next/server";
import { saveContentFromChat } from "@/services/contentAI-v2";

// POST - Zapisz content z rozmowy
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const groupId = parseInt(params.id);
    const body = await req.json();

    if (!body.name || !body.subject || !body.content || !body.type) {
      return NextResponse.json(
        { error: "Nazwa, temat, treść i typ są wymagane" },
        { status: 400 }
      );
    }

    console.log(`[API] Zapisuję content: "${body.name}" dla grupy ${groupId}`);

    const savedContent = await saveContentFromChat(groupId, body);

    return NextResponse.json({
      success: true,
      savedContent
    }, { status: 201 });
  } catch (error: any) {
    console.error("Błąd zapisu content:", error);
    return NextResponse.json(
      { error: "Błąd zapisu content", details: error.message },
      { status: 500 }
    );
  }
}

