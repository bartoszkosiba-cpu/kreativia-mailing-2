import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// POST - Zatwierdź wersję
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const versionId = parseInt(params.id);

    const version = await db.campaignVersion.update({
      where: { id: versionId },
      data: {
        status: "approved",
        approvedAt: new Date(),
        approvedBy: "User" // TODO: Auth system
      }
    });

    // Odrzuć inne warianty tego samego typu
    await db.campaignVersion.updateMany({
      where: {
        campaignThemeId: version.campaignThemeId,
        type: version.type,
        versionNumber: version.versionNumber,
        id: { not: versionId },
        status: "draft"
      },
      data: {
        status: "rejected"
      }
    });

    return NextResponse.json({
      success: true,
      version
    });
  } catch (error: any) {
    console.error("Błąd zatwierdzania wersji:", error);
    return NextResponse.json(
      { error: "Błąd zatwierdzania wersji", details: error.message },
      { status: 500 }
    );
  }
}

