import { NextRequest, NextResponse } from "next/server";
import { getCampaignStats } from "../../../../../src/services/campaignStats";

// GET - Pobierz statystyki kampanii
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const campaignId = Number(params.id);
    
    if (Number.isNaN(campaignId)) {
      return NextResponse.json({ error: "Nieprawidłowe ID kampanii" }, { status: 400 });
    }

    const stats = await getCampaignStats(campaignId);

    return NextResponse.json(stats);
  } catch (error: any) {
    console.error("Błąd pobierania statystyk:", error);
    return NextResponse.json(
      { error: error.message || "Wystąpił błąd" },
      { status: 500 }
    );
  }
}

