/**
 * Skrypt testowy - Automatyczne odpowiedzi z materiałami
 * 
 * Ten skrypt tworzy testową odpowiedź od leada i wywołuje AI Agent
 * aby sprawdzić czy system rozpoznaje prośbę o materiały.
 */

import { db } from './src/lib/db';
import { EmailAgentAI } from './src/services/emailAgentAI';

async function testMaterialResponse() {
  console.log('🧪 TEST: Automatyczne odpowiedzi z materiałami\n');

  // 1. Znajdź leada
  const lead = await db.lead.findFirst({
    where: { email: 'adam.majewski@kreativia.pl' },
    include: {
      campaigns: {
        where: { id: 2 },
        include: {
          campaign: {
            include: {
              materials: {
                where: { isActive: true }
              }
            }
          }
        }
      }
    }
  });

  if (!lead) {
    console.error('❌ Nie znaleziono leada: adam.majewski@kreativia.pl');
    process.exit(1);
  }

  console.log(`✅ Znaleziono leada: ${lead.firstName} ${lead.lastName} (ID: ${lead.id})`);

  // 2. Sprawdź czy kampania ma włączony auto-reply
  const campaign = await db.campaign.findUnique({
    where: { id: 2 },
    include: {
      materials: {
        where: { isActive: true }
      },
      virtualSalesperson: true
    }
  });

  if (!campaign) {
    console.error('❌ Nie znaleziono kampanii ID: 2');
    process.exit(1);
  }

  console.log(`✅ Kampania: ${campaign.name}`);
  console.log(`   Auto-reply: ${campaign.autoReplyEnabled ? '✅ Włączony' : '❌ Wyłączony'}`);
  console.log(`   Materiały: ${campaign.materials.length}`);
  
  if (!campaign.autoReplyEnabled) {
    console.error('❌ Auto-reply nie jest włączony dla tej kampanii!');
    console.log('   Wejdź na: http://localhost:3000/campaigns/2 i włącz checkbox');
    process.exit(1);
  }

  if (campaign.materials.length === 0) {
    console.error('❌ Kampania nie ma żadnych materiałów!');
    console.log('   Dodaj materiały na: http://localhost:3000/campaigns/2');
    process.exit(1);
  }

  // 3. Utwórz testową odpowiedź z prośbą o materiały
  console.log('\n📧 Tworzę testową odpowiedź...');
  
  const testReply = await db.inboxReply.create({
    data: {
      leadId: lead.id,
      campaignId: 2,
      fromEmail: 'adam.majewski@kreativia.pl',
      subject: 'Re: Podwieszenia targowe - prośba o materiały',
      content: 'Dzień dobry,\n\nTak, proszę przesłać katalog i cennik. Jestem bardzo zainteresowany podwieszeniami targowymi!\n\nPozdrawiam\nAdam Majewski',
      receivedAt: new Date(),
      messageId: `test-${Date.now()}@kreativia.pl`,
      classification: null // NULL - AI Agent sklasyfikuje
    }
  });

  console.log(`✅ Utworzono odpowiedź ID: ${testReply.id}`);

  // 4. Wywołaj AI Agent
  console.log('\n🤖 Wywołuję AI Agent...');
  
  try {
    const analysis = await EmailAgentAI.processEmailReply(testReply.id);
    await EmailAgentAI.executeActions(analysis, testReply.id);

    console.log('\n✅ AI Agent przetworzył odpowiedź:');
    console.log(`   Klasyfikacja: ${analysis.classification.classification}`);
    console.log(`   Pewność: ${(analysis.classification.confidence * 100).toFixed(0)}%`);
    
    if (analysis.materialAnalysis) {
      console.log(`\n📦 Analiza materiałów:`);
      console.log(`   Czy to prośba o materiały: ${analysis.materialAnalysis.isMaterialRequest ? '✅ TAK' : '❌ NIE'}`);
      console.log(`   Pewność: ${(analysis.materialAnalysis.confidence * 100).toFixed(0)}%`);
      console.log(`   Uzasadnienie: ${analysis.materialAnalysis.reasoning}`);
    }

    console.log(`\n🔧 Akcje:`);
    analysis.actions.forEach((action, idx) => {
      console.log(`   ${idx + 1}. ${action.type} - ${action.description}`);
    });

    // 5. Sprawdź czy utworzono PendingMaterialDecision
    const pendingDecision = await db.pendingMaterialDecision.findFirst({
      where: { replyId: testReply.id }
    });

    if (pendingDecision) {
      console.log('\n✅ Utworzono kolejkę decyzji administratora!');
      console.log(`   ID decyzji: ${pendingDecision.id}`);
      console.log(`   Status: ${pendingDecision.status}`);
      console.log(`   Sugerowana akcja: ${pendingDecision.suggestedAction}`);
      console.log(`\n   👉 Sprawdź w UI: http://localhost:3000/material-decisions`);
    }

    // 6. Sprawdź czy utworzono MaterialResponse (jeśli confidence >= 0.8)
    const materialResponse = await db.materialResponse.findFirst({
      where: { replyId: testReply.id }
    });

    if (materialResponse) {
      console.log('\n✅ Utworzono zaplanowaną wysyłkę materiałów!');
      console.log(`   ID odpowiedzi: ${materialResponse.id}`);
      console.log(`   Status: ${materialResponse.status}`);
      console.log(`   Zaplanowano na: ${materialResponse.scheduledAt}`);
      console.log(`\n   👉 Materiały zostaną wysłane automatycznie przez cron`);
    }

    console.log('\n🎉 TEST ZAKOŃCZONY POMYŚLNIE!\n');

  } catch (error: any) {
    console.error('\n❌ Błąd podczas przetwarzania:');
    console.error(`   ${error.message}`);
    console.error(`   Stack: ${error.stack}`);
    process.exit(1);
  }
}

// Uruchom test
testMaterialResponse()
  .then(() => {
    console.log('✅ Skrypt zakończony');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Nieoczekiwany błąd:', error);
    process.exit(1);
  });

