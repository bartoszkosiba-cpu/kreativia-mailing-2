import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * PUT - Aktualizuj materiał
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string; materialId: string } }
) {
  try {
    const campaignId = parseInt(params.id);
    const materialId = parseInt(params.materialId);
    
    console.log(`[MATERIALS PUT] Request: campaignId=${campaignId}, materialId=${materialId}`);
    const body = await req.json();

    const {
      name,
      type,
      url,
      filePath,
      fileName,
      fileSize,
      order,
      isActive
    } = body;

    // Sprawdź czy materiał należy do kampanii
    const existingMaterial = await db.material.findUnique({
      where: { id: materialId }
    });

    if (!existingMaterial || existingMaterial.campaignId !== campaignId) {
      return NextResponse.json(
        { success: false, error: "Materiał nie istnieje lub nie należy do tej kampanii" },
        { status: 404 }
      );
    }

    // Walidacja
    if (type && !['LINK', 'ATTACHMENT'].includes(type)) {
      return NextResponse.json(
        { success: false, error: "Typ materiału musi być LINK lub ATTACHMENT" },
        { status: 400 }
      );
    }

    // Przygotuj dane do aktualizacji
    const updateData: any = {};
    
    if (name !== undefined) updateData.name = name.trim();
    if (type !== undefined) {
      updateData.type = type;
      // Jeśli zmieniono typ, wyczyść przeciwne pole
      if (type === 'LINK') {
        updateData.url = url?.trim() || null;
        updateData.fileName = null; // ✅ Wyczyść fileName (nie ma filePath w schemacie)
      } else if (type === 'ATTACHMENT') {
        // ✅ Użyj fileName (główna ścieżka w schemacie) lub filePath (dla kompatybilności)
        updateData.fileName = (fileName?.trim() || filePath?.trim() || null);
        updateData.url = null;
      }
    }
    if (fileName !== undefined) updateData.fileName = fileName?.trim() || null;
    // ✅ Jeśli fileName nie jest podany, ale filePath jest - użyj filePath jako fileName
    if (fileName === undefined && filePath !== undefined && type === 'ATTACHMENT') {
      updateData.fileName = filePath?.trim() || null;
    }
    if (fileSize !== undefined) {
      updateData.fileSize = fileSize ? (typeof fileSize === 'number' ? fileSize : parseInt(String(fileSize))) : null;
    }
    if (order !== undefined) {
      updateData.order = typeof order === 'number' ? order : parseInt(String(order)) || 0;
    }
    if (isActive !== undefined) {
      updateData.isActive = isActive === true || isActive === 'true';
    }

    console.log(`[MATERIALS PUT] Aktualizacja materiału ${materialId} w kampanii ${campaignId}:`, updateData);

    // Aktualizuj materiał
    const material = await db.material.update({
      where: { id: materialId },
      data: updateData
    });

    return NextResponse.json({
      success: true,
      data: material
    });
  } catch (error: any) {
    console.error("[MATERIALS] Błąd aktualizacji materiału:", error);
    console.error("[MATERIALS] Szczegóły błędu:", error.message);
    console.error("[MATERIALS] Stack:", error.stack);
    return NextResponse.json(
      { success: false, error: `Błąd podczas aktualizacji materiału: ${error.message}` },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Usuń materiał
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; materialId: string } }
) {
  try {
    const campaignId = parseInt(params.id);
    const materialId = parseInt(params.materialId);

    // Sprawdź czy materiał należy do kampanii
    const existingMaterial = await db.material.findUnique({
      where: { id: materialId }
    });

    if (!existingMaterial || existingMaterial.campaignId !== campaignId) {
      return NextResponse.json(
        { success: false, error: "Materiał nie istnieje lub nie należy do tej kampanii" },
        { status: 404 }
      );
    }

    // Usuń materiał (cascade usunie też powiązane MaterialResponse)
    await db.material.delete({
      where: { id: materialId }
    });

    return NextResponse.json({
      success: true,
      message: "Materiał został usunięty"
    });
  } catch (error: any) {
    console.error("[MATERIALS] Błąd usuwania materiału:", error);
    return NextResponse.json(
      { success: false, error: "Błąd podczas usuwania materiału" },
      { status: 500 }
    );
  }
}

