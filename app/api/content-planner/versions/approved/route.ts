import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET - Pobierz wszystkie zatwierdzone/zapisane wersje (do wyboru w Campaign)
export async function GET(req: NextRequest) {
  try {
    const versions = await db.campaignVersion.findMany({
      where: {
        OR: [
          { status: "approved" },
          { status: "draft" }, // Również drafty (ręczne wersje)
          { status: "in_use" }
        ]
      },
      include: {
        campaignTheme: {
          include: {
            productGroup: true
          }
        }
      },
      orderBy: [
        { updatedAt: "desc" }
      ]
    });

    // Formatuj dla selecta
    const formatted = versions.map(v => ({
      id: v.id,
      label: `${v.campaignTheme.productGroup.iconEmoji || "📦"} ${v.campaignTheme.productGroup.name} > ${v.campaignTheme.name} (${v.type}, v${v.versionNumber}${v.variantLetter ? ` ${v.variantLetter}` : ""})`,
      subject: v.subject,
      content: v.content,
      type: v.type,
      status: v.status,
      productGroup: v.campaignTheme.productGroup.name,
      theme: v.campaignTheme.name
    }));

    return NextResponse.json({
      success: true,
      versions: formatted
    });
  } catch (error: any) {
    console.error("Błąd pobierania wersji:", error);
    return NextResponse.json(
      { error: "Błąd pobierania wersji", details: error.message },
      { status: 500 }
    );
  }
}

