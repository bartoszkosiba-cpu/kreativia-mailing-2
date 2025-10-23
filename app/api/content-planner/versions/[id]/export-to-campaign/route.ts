import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// POST - Eksportuj zatwierdzoną wersję do nowej kampanii
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const versionId = parseInt(params.id);
    const { campaignName, virtualSalespersonId } = await req.json();

    if (!campaignName) {
      return NextResponse.json(
        { error: "Nazwa kampanii jest wymagana" },
        { status: 400 }
      );
    }

    // Pobierz wersję
    const version = await db.campaignVersion.findUnique({
      where: { id: versionId },
      include: {
        campaignTheme: {
          include: {
            productGroup: true
          }
        }
      }
    });

    if (!version) {
      return NextResponse.json(
        { error: "Wersja nie istnieje" },
        { status: 404 }
      );
    }

    if (version.status !== "approved") {
      return NextResponse.json(
        { error: "Możesz eksportować tylko zatwierdzone wersje" },
        { status: 400 }
      );
    }

    // Utwórz nową kampanię
    const campaign = await db.campaign.create({
      data: {
        name: campaignName,
        description: `Utworzona z: ${version.campaignTheme.productGroup.name} > ${version.campaignTheme.name} (${version.type}, wariant ${version.variantLetter})`,
        subject: version.subject,
        text: version.content,
        virtualSalespersonId: virtualSalespersonId || null,
        contentVersionId: versionId,
        status: "DRAFT"
      }
    });

    // Oznacz wersję jako "in_use"
    await db.campaignVersion.update({
      where: { id: versionId },
      data: {
        status: "in_use"
      }
    });

    console.log(`[CONTENT PLANNER] Eksportowano wersję ${versionId} do kampanii ${campaign.id}`);

    return NextResponse.json({
      success: true,
      campaign: {
        id: campaign.id,
        name: campaign.name
      }
    });
  } catch (error: any) {
    console.error("Błąd eksportu do kampanii:", error);
    return NextResponse.json(
      { error: "Błąd eksportu do kampanii", details: error.message },
      { status: 500 }
    );
  }
}

