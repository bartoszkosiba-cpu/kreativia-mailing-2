import { NextRequest, NextResponse } from "next/server";
import { getSavedContentsForGroup } from "@/services/contentAI-v2";

// GET - Pobierz wszystkie SavedContent dla grupy
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const groupId = parseInt(params.id);

    const savedContents = await getSavedContentsForGroup(groupId);

    return NextResponse.json({
      success: true,
      savedContents
    });
  } catch (error: any) {
    console.error("Błąd pobierania saved contents:", error);
    return NextResponse.json(
      { error: "Błąd pobierania", details: error.message },
      { status: 500 }
    );
  }
}

