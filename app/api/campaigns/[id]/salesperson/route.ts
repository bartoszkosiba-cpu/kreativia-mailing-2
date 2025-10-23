import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const campaignId = Number(params.id);
    if (Number.isNaN(campaignId)) {
      return NextResponse.json({ error: "Nieprawidłowe ID kampanii" }, { status: 400 });
    }

    const { virtualSalespersonId } = await req.json();

    // Sprawdź czy kampania istnieje
    const campaign = await db.campaign.findUnique({
      where: { id: campaignId }
    });

    if (!campaign) {
      return NextResponse.json({ error: "Kampania nie została znaleziona" }, { status: 404 });
    }

    // Jeśli podano ID handlowca, sprawdź czy istnieje i ma główną skrzynkę
    if (virtualSalespersonId) {
      const salesperson = await db.virtualSalesperson.findUnique({
        where: { id: virtualSalespersonId },
        include: {
          mainMailbox: true
        }
      });

      if (!salesperson) {
        return NextResponse.json({ error: "Handlowiec nie został znaleziony" }, { status: 404 });
      }

      if (!salesperson.isActive) {
        return NextResponse.json({ error: "Handlowiec jest nieaktywny" }, { status: 400 });
      }

      // NOWA WALIDACJA: Sprawdź czy handlowiec ma główną skrzynkę
      if (!salesperson.mainMailbox) {
        return NextResponse.json({ 
          error: "Handlowiec musi mieć ustawioną główną skrzynkę przed dodaniem do kampanii. Dodaj skrzynkę i ustaw ją jako główną." 
        }, { status: 400 });
      }

      // Sprawdź czy główna skrzynka jest aktywna
      if (!salesperson.mainMailbox.isActive) {
        return NextResponse.json({ 
          error: "Główna skrzynka handlowca jest nieaktywna. Aktywuj skrzynkę przed dodaniem handlowca do kampanii." 
        }, { status: 400 });
      }
    }

    // Aktualizuj kampanię
    const updatedCampaign = await db.campaign.update({
      where: { id: campaignId },
      data: {
        virtualSalespersonId: virtualSalespersonId || null
      },
      include: {
        virtualSalesperson: true
      }
    });

    return NextResponse.json({ 
      message: "Handlowiec zaktualizowany pomyślnie",
      campaign: updatedCampaign
    });

  } catch (error) {
    console.error("Błąd aktualizacji handlowca:", error);
    return NextResponse.json({ error: "Wystąpił błąd podczas aktualizacji handlowca" }, { status: 500 });
  }
}
