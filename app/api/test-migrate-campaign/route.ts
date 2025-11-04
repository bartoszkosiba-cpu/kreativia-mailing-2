import { NextResponse } from "next/server";
import { migrateCampaignToV2 } from "@/services/campaignMigration";

/**
 * Testowy endpoint do migracji kampanii
 */
export async function POST(req: Request) {
  try {
    const { campaignId } = await req.json();

    if (!campaignId) {
      return NextResponse.json(
        { error: "Brak campaignId" },
        { status: 400 }
      );
    }

    const result = await migrateCampaignToV2(campaignId, 20);

    return NextResponse.json({
      success: result.success,
      data: result
    });
  } catch (error: any) {
    console.error("Błąd migracji:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}


