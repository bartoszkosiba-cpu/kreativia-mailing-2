import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type"); // "all", "tag", "single"
    const tagId = searchParams.get("tagId");
    const leadId = searchParams.get("leadId");

    if (type === "all") {
      // Usuń wszystkich leadów - w odpowiedniej kolejności (najpierw relacje)
      await prisma.sendLog.deleteMany({});
      await prisma.inboxReply.deleteMany({});
      await prisma.campaignLead.deleteMany({});
      await prisma.leadTag.deleteMany({});
      await prisma.lead.deleteMany({});
      
      return NextResponse.json({ 
        success: true, 
        message: "Wszyscy leadzi zostali usunięci",
        deleted: "all"
      });
    }
    
    if (type === "tag" && tagId) {
      // Usuń leadów z określonym tagiem
      const deletedCount = await prisma.lead.deleteMany({
        where: {
          LeadTag: {
            some: {
              tagId: parseInt(tagId)
            }
          }
        }
      });
      
      return NextResponse.json({ 
        success: true, 
        message: `Usunięto ${deletedCount.count} leadów z tagiem`,
        deleted: deletedCount.count
      });
    }
    
    if (type === "single" && leadId) {
      // Usuń pojedynczego leada - w odpowiedniej kolejności
      const leadIdInt = parseInt(leadId);
      
      // Usuń wszystkie relacje w odpowiedniej kolejności
      await prisma.sendLog.deleteMany({
        where: { leadId: leadIdInt }
      });
      await prisma.inboxReply.deleteMany({
        where: { leadId: leadIdInt }
      });
      await prisma.campaignLead.deleteMany({
        where: { leadId: leadIdInt }
      });
      await prisma.leadTag.deleteMany({
        where: { leadId: leadIdInt }
      });
      await prisma.lead.delete({
        where: { id: leadIdInt }
      });
      
      return NextResponse.json({ 
        success: true, 
        message: "Lead został usunięty",
        deleted: 1
      });
    }

    return NextResponse.json({ 
      success: false, 
      error: "Nieprawidłowe parametry" 
    }, { status: 400 });

  } catch (error) {
    console.error("Błąd usuwania leadów:", error);
    return NextResponse.json({ 
      success: false, 
      error: `Wystąpił błąd podczas usuwania leadów: ${error instanceof Error ? error.message : 'Nieznany błąd'}` 
    }, { status: 500 });
  }
}
