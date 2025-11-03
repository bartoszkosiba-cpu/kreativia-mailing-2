import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/campaigns/[id]/auto-reply-preview - Generuje podgląd automatycznej odpowiedzi
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const campaignId = parseInt(params.id);
    
    const campaign = await db.campaign.findUnique({
      where: { id: campaignId },
      include: {
        virtualSalesperson: true,
        materials: { where: { isActive: true }, orderBy: { order: 'asc' } }
      }
    });

    if (!campaign) {
      return NextResponse.json(
        { success: false, error: "Kampania nie istnieje" },
        { status: 404 }
      );
    }

    if (!campaign.virtualSalesperson) {
      return NextResponse.json(
        { success: false, error: "Kampania nie ma przypisanego handlowca" },
        { status: 404 }
      );
    }

    // Pobierz przykładową stopkę z SendLog (najnowszy mail z tej kampanii)
    const exampleSendLog = await db.sendLog.findFirst({
      where: {
        campaignId: campaignId,
        status: 'sent'
      },
      orderBy: {
        createdAt: 'desc'
      },
      select: {
        content: true,
        subject: true
      }
    });

    // Wyciągnij pełną stopkę z przykładu (jeśli istnieje)
    let exampleSignature = null;
    if (exampleSendLog && exampleSendLog.content) {
      // Znajdź miejsce gdzie zaczyna się stopka (podpis handlowca)
      // Szukamy: podwójna nowa linia + ** (nazwa w bold) lub M. (telefon) lub E. (email)
      const signatureMatch = exampleSendLog.content.match(/(\n\n\*\*[^*]+\*\*|\n\nM\.[^\n]+|\n\nE\.[^\n]+)/s);
      if (signatureMatch && signatureMatch.index !== undefined) {
        // Wyciągnij wszystko od znalezionego miejsca do końca (cała stopka: podpis + stopka prawna)
        exampleSignature = exampleSendLog.content.substring(signatureMatch.index).trim();
      } else {
        // Fallback - ostatnie 800 znaków (pełna stopka jest dłuższa)
        exampleSignature = exampleSendLog.content.slice(-800).trim();
      }
    }

    // Przygotuj dane handlowca (pobierz z VirtualSalesperson)
    const guardianData = {
      name: campaign.virtualSalesperson.realSalespersonName || '',
      email: campaign.virtualSalesperson.realSalespersonEmail || '',
      phone: campaign.virtualSalesperson.realSalespersonPhone || '',
      title: campaign.virtualSalesperson.realSalespersonSignature || '' // ✅ Użyj realSalespersonSignature z VirtualSalesperson
    };

    // Przykładowy temat (z "Re:")
    const exampleSubject = campaign.subject 
      ? (campaign.subject.startsWith('Re:') ? campaign.subject : `Re: ${campaign.subject}`)
      : `Re: ${campaign.name}`;

    return NextResponse.json({
      success: true,
      data: {
        guardian: guardianData,
        exampleSignature,
        exampleSubject,
        materials: campaign.materials.map(m => ({
          id: m.id,
          name: m.name,
          type: m.type,
          url: m.url,
          fileName: m.fileName
        }))
      }
    });
  } catch (error: any) {
    console.error("[AUTO-REPLY PREVIEW] Błąd generowania podglądu:", error);
    return NextResponse.json(
      { success: false, error: "Błąd podczas generowania podglądu" },
      { status: 500 }
    );
  }
}

