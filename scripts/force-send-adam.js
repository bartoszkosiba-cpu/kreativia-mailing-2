// Skrypt do wymuszenia wysłania MaterialResponse dla Adama
const { PrismaClient } = require("@prisma/client");
const path = require("path");

async function forceSend() {
  const prisma = new PrismaClient();
  
  try {
    console.log("🔧 Wymuszam wysłanie MaterialResponse do Adama...");
    
    // Zaktualizuj MaterialResponse ID 4 na scheduled
    const updated = await prisma.materialResponse.update({
      where: { id: 4 },
      data: {
        status: 'scheduled',
        scheduledAt: new Date(Date.now() - 60000), // 1 minutę temu
        error: null,
        updatedAt: new Date()
      }
    });
    
    console.log(`✅ Zaktualizowano MaterialResponse 4 na scheduled`);
    console.log(`   scheduledAt: ${updated.scheduledAt.toISOString()}`);
    
    // Wywołaj sendScheduledMaterialResponses przez require
    process.chdir(path.join(__dirname, ".."));
    const modulePath = path.join(process.cwd(), "src/services/materialResponseSender.ts");
    
    console.log("📧 Wywołuję sendScheduledMaterialResponses...");
    
    // Użyj dynamicznego importu lub require z transpilacją
    // Najprościej: użyj ts-node lub wywołaj przez API
    
    console.log("💡 Wykonaj teraz: curl http://localhost:3000/api/cron/material-responses");
    console.log("   lub poczekaj na następny cron job (który uruchomi się automatycznie)");
    
  } catch (error) {
    console.error("❌ Błąd:", error.message);
  } finally {
    await prisma.$disconnect();
  }
}

forceSend();
