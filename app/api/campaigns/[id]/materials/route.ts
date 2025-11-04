import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET - Pobierz wszystkie materiały kampanii
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const campaignId = parseInt(params.id);

    // Sprawdź czy model istnieje
    if (!db.material) {
      console.error("[MATERIALS GET] Błąd: db.material jest undefined!");
      return NextResponse.json(
        { success: false, error: "Model Material nie jest dostępny. Uruchom: npx prisma generate i zrestartuj serwer" },
        { status: 500 }
      );
    }

    const materials = await db.material.findMany({
      where: { campaignId },
      orderBy: { order: 'asc' }
    });

    return NextResponse.json({
      success: true,
      data: materials
    });
  } catch (error: any) {
    console.error("[MATERIALS] Błąd pobierania materiałów:", error);
    return NextResponse.json(
      { success: false, error: "Błąd podczas pobierania materiałów" },
      { status: 500 }
    );
  }
}

/**
 * POST - Dodaj nowy materiał do kampanii
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const campaignId = parseInt(params.id);
    const body = await req.json();

    const {
      name,
      type, // "LINK" | "ATTACHMENT"
      url,
      filePath,
      fileName,
      fileSize,
      order = 0
    } = body;

    // Walidacja
    if (!name || !name.trim()) {
      return NextResponse.json(
        { success: false, error: "Nazwa materiału jest wymagana" },
        { status: 400 }
      );
    }

    if (!type || !['LINK', 'ATTACHMENT'].includes(type)) {
      return NextResponse.json(
        { success: false, error: "Typ materiału musi być LINK lub ATTACHMENT" },
        { status: 400 }
      );
    }

    if (type === 'LINK' && !url) {
      return NextResponse.json(
        { success: false, error: "URL jest wymagany dla typu LINK" },
        { status: 400 }
      );
    }

    if (type === 'ATTACHMENT' && (!fileName || !fileName.trim())) {
      return NextResponse.json(
        { success: false, error: "fileName jest wymagany dla typu ATTACHMENT (lub wybierz plik z dysku)" },
        { status: 400 }
      );
    }

    // Pobierz język kampanii (z handlowca)
    const campaign = await db.campaign.findUnique({
      where: { id: campaignId },
      include: {
        virtualSalesperson: true
      }
    });

    if (!campaign) {
      return NextResponse.json(
        { success: false, error: "Kampania nie istnieje" },
        { status: 404 }
      );
    }

    // Język - zawsze 'pl' jako domyślny (kampania może nie mieć handlowca)
    const language = campaign.virtualSalesperson?.language || 'pl';
    
    console.log(`[MATERIALS] Tworzenie materiału dla kampanii ${campaignId}, język: ${language}`);

    // Przygotuj fileSize
    let parsedFileSize: number | null = null;
    if (fileSize !== undefined && fileSize !== null) {
      parsedFileSize = typeof fileSize === 'number' ? fileSize : parseInt(String(fileSize));
      if (isNaN(parsedFileSize)) {
        parsedFileSize = null;
      }
    }

    // Przygotuj dane do zapisu
    // ✅ fileName może zawierać pełną ścieżkę względną (np. "materials/3_123456_katalog.pdf")
    // lub tylko nazwę pliku (np. "katalog.pdf") - system znajdzie plik w różnych lokalizacjach
    const materialData: any = {
      campaignId,
      name: name.trim(),
      type,
      url: type === 'LINK' ? (url?.trim() || null) : null,
      fileName: type === 'ATTACHMENT' ? (fileName?.trim() || filePath?.trim() || null) : null, // ✅ Użyj fileName lub filePath (dla kompatybilności)
      order: order ? parseInt(String(order)) : 0,
      isActive: true
    };

    console.log(`[MATERIALS] Dane materiału:`, {
      name: materialData.name,
      type: materialData.type,
      fileName: materialData.fileName,
      url: materialData.url
    });

    // Utwórz materiał
    // Sprawdź czy model istnieje (debug)
    if (!db.material) {
      console.error("[MATERIALS] Błąd: db.material jest undefined!");
      console.error("[MATERIALS] Dostępne modele w db:", Object.keys(db).filter(k => !k.startsWith('_') && !k.startsWith('$')));
      return NextResponse.json(
        { success: false, error: "Model Material nie jest dostępny. Uruchom: npx prisma generate" },
        { status: 500 }
      );
    }

    const material = await db.material.create({
      data: materialData
    });

    return NextResponse.json({
      success: true,
      data: material
    });
  } catch (error: any) {
    console.error("[MATERIALS] Błąd tworzenia materiału:", error);
    console.error("[MATERIALS] Szczegóły błędu:", error.message);
    console.error("[MATERIALS] Stack:", error.stack);
    return NextResponse.json(
      { success: false, error: `Błąd podczas tworzenia materiału: ${error.message}` },
      { status: 500 }
    );
  }
}

