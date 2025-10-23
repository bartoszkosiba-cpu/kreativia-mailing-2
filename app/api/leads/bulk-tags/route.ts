import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const { leadIds, tagIds } = await req.json();

    if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
      return NextResponse.json({ error: "Nieprawidłowa lista ID leadów" }, { status: 400 });
    }

    if (!tagIds || !Array.isArray(tagIds) || tagIds.length === 0) {
      return NextResponse.json({ error: "Nieprawidłowa lista ID tagów" }, { status: 400 });
    }

    // Sprawdź czy leady istnieją
    const existingLeads = await db.lead.findMany({
      where: { id: { in: leadIds } },
      select: { id: true }
    });

    if (existingLeads.length === 0) {
      return NextResponse.json({ error: "Nie znaleziono leadów" }, { status: 404 });
    }

    // Sprawdź czy tagi istnieją
    const existingTags = await db.tag.findMany({
      where: { id: { in: tagIds } },
      select: { id: true }
    });

    if (existingTags.length === 0) {
      return NextResponse.json({ error: "Nie znaleziono tagów" }, { status: 404 });
    }

    // Usuń wszystkie istniejące tagi dla tych leadów
    await db.leadTag.deleteMany({
      where: { leadId: { in: leadIds } }
    });

    // Dodaj nowe tagi - używamy createMany bez skipDuplicates
    // ponieważ już usunęliśmy wszystkie istniejące powiązania
    const leadTagData = [];
    for (const leadId of leadIds) {
      for (const tagId of tagIds) {
        leadTagData.push({ leadId, tagId });
      }
    }

    if (leadTagData.length > 0) {
      await db.leadTag.createMany({
        data: leadTagData
      });
    }

    return NextResponse.json({ 
      message: `Zaktualizowano tagi dla ${leadIds.length} leadów`,
      leadsCount: leadIds.length,
      tagsCount: tagIds.length
    });

  } catch (error: any) {
    console.error("Błąd aktualizacji tagów:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
