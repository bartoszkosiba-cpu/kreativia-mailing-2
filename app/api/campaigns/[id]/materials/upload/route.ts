import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

/**
 * POST - Upload pliku dla materiału
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const campaignId = parseInt(params.id);
    
    // Sprawdź czy kampania istnieje
    const { db } = await import('@/lib/db');
    const campaign = await db.campaign.findUnique({
      where: { id: campaignId }
    });

    if (!campaign) {
      return NextResponse.json(
        { success: false, error: "Kampania nie istnieje" },
        { status: 404 }
      );
    }

    // Pobierz plik z form-data
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "Brak pliku" },
        { status: 400 }
      );
    }

    // Walidacja rozmiaru (max 50MB)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { success: false, error: "Plik jest zbyt duży (max 50MB)" },
        { status: 400 }
      );
    }

    // Walidacja typu pliku (opcjonalnie - można rozszerzyć)
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/jpeg',
      'image/png',
      'image/gif'
    ];

    if (!allowedTypes.includes(file.type)) {
      console.warn(`[UPLOAD] Ostrzeżenie: nieznany typ pliku: ${file.type}`);
      // Nie blokujemy - tylko ostrzegamy
    }

    // Przygotuj katalog uploads/materials
    const uploadsDir = join(process.cwd(), 'uploads', 'materials');
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true });
    }

    // Generuj unikalną nazwę pliku (zapobiegaj konfliktom)
    const timestamp = Date.now();
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const fileName = `${campaignId}_${timestamp}_${sanitizedName}`;
    const filePath = join(uploadsDir, fileName);

    // Zapisz plik
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    // Zwróć ścieżkę względną (dla użycia w bazie)
    // Format: materials/filename - będzie używana jako uploads/materials/filename lub materials/filename
    const relativePath = `materials/${fileName}`;

    console.log(`[UPLOAD] Plik zapisany: ${filePath}`);
    console.log(`[UPLOAD] Ścieżka względna: ${relativePath} (${file.size} bytes)`);

    return NextResponse.json({
      success: true,
      data: {
        fileName: file.name,
        filePath: relativePath, // Format: materials/filename
        fullPath: filePath, // Pełna ścieżka na serwerze (dla informacji)
        fileSize: file.size,
        mimeType: file.type
      }
    });
  } catch (error: any) {
    console.error("[UPLOAD] Błąd uploadu pliku:", error);
    return NextResponse.json(
      { success: false, error: "Błąd podczas uploadu pliku" },
      { status: 500 }
    );
  }
}

