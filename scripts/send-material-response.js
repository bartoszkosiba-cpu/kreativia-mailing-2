// Skrypt do wymuszenia wysłania MaterialResponse
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function forceSendMaterialResponse() {
  try {
    console.log("🔧 Wymuszam wysłanie MaterialResponse do Adama...");
    
    // Znajdź MaterialResponse dla Adama (leadId 508)
    const materialResponse = await prisma.materialResponse.findFirst({
      where: {
        leadId: 508,
        status: { in: ['scheduled', 'pending', 'failed'] }
      },
      orderBy: {
        createdAt: 'desc'
      },
      include: {
        lead: true,
        campaign: {
          include: {
            virtualSalesperson: {
              include: {
                mailboxes: {
                  where: { isActive: true },
                  orderBy: [
                    { priority: 'asc' },
                    { lastUsedAt: 'asc' }
                  ]
                }
              }
            },
            materials: {
              where: { isActive: true }
            }
          }
        },
        reply: true
      }
    });

    if (!materialResponse) {
      console.log("❌ Nie znaleziono MaterialResponse dla Adama");
      await prisma.$disconnect();
      return;
    }

    console.log(`✅ Znaleziono MaterialResponse ID: ${materialResponse.id} (status: ${materialResponse.status})`);
    
    // Zaktualizuj na scheduled z przeszłą datą (żeby cron go od razu wysłał)
    const updated = await prisma.materialResponse.update({
      where: { id: materialResponse.id },
      data: {
        status: 'scheduled',
        scheduledAt: new Date(Date.now() - 60000), // 1 minutę temu (żeby było już gotowe)
        error: null,
        updatedAt: new Date()
      }
    });

    console.log(`✅ Zaktualizowano MaterialResponse ${materialResponse.id} na scheduled (scheduledAt: ${updated.scheduledAt.toISOString()})`);
    
    // Teraz wywołaj sendScheduledMaterialResponses
    console.log("📧 Wywołuję sendScheduledMaterialResponses...");
    
    // Dynamiczny import (ESM)
    const { sendScheduledMaterialResponses } = await import("../src/services/materialResponseSender.ts");
    const sentCount = await sendScheduledMaterialResponses();
    
    console.log(`✅ Wysłano ${sentCount} odpowiedzi z materiałami`);
    
    // Sprawdź czy faktycznie wysłano
    const finalStatus = await prisma.materialResponse.findUnique({
      where: { id: materialResponse.id },
      select: { status: true, sentAt: true, error: true }
    });
    
    console.log(`📊 Finalny status MaterialResponse ${materialResponse.id}:`, finalStatus);
    
    if (finalStatus.status === 'sent') {
      console.log(`✅ SUKCES! MaterialResponse został wysłany do ${materialResponse.lead.email}`);
      console.log(`   Data wysyłki: ${finalStatus.sentAt}`);
    } else if (finalStatus.status === 'failed') {
      console.log(`❌ BŁĄD wysyłki: ${finalStatus.error}`);
    } else {
      console.log(`⚠️ Status: ${finalStatus.status} (może być jeszcze scheduled - spróbuj ponownie za chwilę)`);
    }
    
  } catch (error) {
    console.error("❌ Błąd:", error);
  } finally {
    await prisma.$disconnect();
  }
}

forceSendMaterialResponse();

