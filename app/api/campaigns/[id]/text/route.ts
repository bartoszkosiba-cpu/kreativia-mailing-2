import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const campaignId = parseInt(params.id);
    const { text } = await req.json();

    const updatedCampaign = await db.campaign.update({
      where: { id: campaignId },
      data: { text }
    });

    return NextResponse.json({ 
      success: true, 
      campaign: updatedCampaign,
      message: "Tekst kampanii zapisany" 
    });
    
  } catch (error) {
    console.error("Błąd zapisywania tekstu kampanii:", error);
    return NextResponse.json({ error: "Błąd zapisywania tekstu kampanii" }, { status: 500 });
  }
}

