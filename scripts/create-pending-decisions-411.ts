import { db } from '../src/lib/db';
import { EmailAgentAI } from '../src/services/emailAgentAI';

async function createPendingDecisionsFor411() {
  const campaignId = 3;
  const targetDate = new Date('2025-11-04T00:00:00.000Z');
  const endDate = new Date('2025-11-05T00:00:00.000Z');

  console.log('\n🔍 SZUKANIE ZAINTERESOWANYCH Z 4.11.2025\n');
  console.log('='.repeat(70));

  // Pobierz zainteresowanych z 4.11
  const interestedReplies = await db.inboxReply.findMany({
    where: {
      campaignId: campaignId,
      classification: 'INTERESTED',
      receivedAt: {
        gte: targetDate,
        lt: endDate,
      },
    },
    include: {
      lead: true,
      campaign: {
        include: {
          virtualSalesperson: {
            include: {
              mailboxes: {
                where: { isActive: true },
                take: 1
              }
            }
          }
        }
      }
    }
  });

  console.log(`📊 Znaleziono ${interestedReplies.length} odpowiedzi INTERESTED z 4.11\n`);

  if (interestedReplies.length === 0) {
    console.log('Brak zainteresowanych leadów z 4.11.2025.');
    return;
  }

  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const reply of interestedReplies) {
    try {
      // Sprawdź czy już istnieje PendingMaterialDecision lub MaterialResponse
      const existingDecision = await db.pendingMaterialDecision.findFirst({
        where: { replyId: reply.id }
      });

      const existingMaterialResponse = await db.materialResponse.findFirst({
        where: { replyId: reply.id }
      });

      if (existingDecision || existingMaterialResponse) {
        console.log(`⏭️  Pomijam Reply ID ${reply.id} (${reply.lead?.email}) - już ma decyzję lub odpowiedź`);
        skipped++;
        continue;
      }

      // Sprawdź czy to prośba o materiały używając AI
      const materialAnalysis = await EmailAgentAI['checkMaterialRequest'](reply, reply.campaign);
      
      if (materialAnalysis.isMaterialRequest && materialAnalysis.confidence >= 0.6) {
        // Utwórz PendingMaterialDecision
        const pending = await db.pendingMaterialDecision.create({
          data: {
            leadId: reply.lead!.id,
            campaignId: campaignId,
            replyId: reply.id,
            aiConfidence: materialAnalysis.confidence,
            aiReasoning: materialAnalysis.reasoning,
            leadResponse: reply.content || '',
            suggestedAction: materialAnalysis.suggestedAction === 'SEND' ? 'SEND' : 'DONT_SEND',
            status: 'PENDING'
          }
        });

        console.log(`✅ Utworzono PendingMaterialDecision ID ${pending.id} dla Reply ID ${reply.id}`);
        console.log(`   Lead: ${reply.lead?.email}`);
        console.log(`   Pewność AI: ${(materialAnalysis.confidence * 100).toFixed(0)}%`);
        console.log('');
        created++;
      } else {
        console.log(`⏭️  Pomijam Reply ID ${reply.id} (${reply.lead?.email}) - nie rozpoznano jako prośba o materiały`);
        console.log(`   Pewność: ${(materialAnalysis.confidence * 100).toFixed(0)}%, isMaterialRequest: ${materialAnalysis.isMaterialRequest}`);
        console.log('');
        skipped++;
      }
    } catch (error: any) {
      console.error(`❌ Błąd dla Reply ID ${reply.id}:`, error.message);
      errors++;
    }
  }

  console.log('='.repeat(70));
  console.log('\n✅ PODSUMOWANIE:');
  console.log(`   Utworzono: ${created}`);
  console.log(`   Pominięto: ${skipped}`);
  console.log(`   Błędy: ${errors}`);
  console.log('');
}

createPendingDecisionsFor411().catch(async (e) => {
  console.error(e);
  await db.$disconnect();
  process.exit(1);
});
