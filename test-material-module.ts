/**
 * Szybki skrypt testowy dla modułu automatycznych odpowiedzi z materiałami
 * 
 * Uruchom: npx ts-node test-material-module.ts
 */

import { db } from './src/lib/db';
import { analyzeMaterialRequest, generateMaterialResponse } from './src/services/materialResponseAI';
import { scheduleMaterialResponse, sendScheduledMaterialResponses } from './src/services/materialResponseSender';

async function testAnalysis() {
  console.log('\n🧪 TEST 1: Analiza prośby o materiały\n');
  
  const testCases = [
    {
      reply: "Tak, proszę przesłać katalog i cennik. Jestem bardzo zainteresowany!",
      context: "Oferujemy meble biurowe. W treści maila pytamy: 'Czy mogę przesłać katalog i cennik?'"
    },
    {
      reply: "Moglibyście przesłać więcej informacji o waszych produktach?",
      context: "Oferujemy meble biurowe."
    },
    {
      reply: "Dziękuję za ofertę, ale nie jestem zainteresowany.",
      context: "Oferujemy meble biurowe."
    }
  ];

  for (const testCase of testCases) {
    try {
      const result = await analyzeMaterialRequest(
        testCase.reply,
        testCase.context,
        'pl'
      );
      
      console.log(`📧 Odpowiedź: "${testCase.reply.substring(0, 50)}..."`);
      console.log(`   ✓ Prośba o materiały: ${result.isMaterialRequest}`);
      console.log(`   ✓ Pewność: ${(result.confidence * 100).toFixed(0)}%`);
      console.log(`   ✓ Akcja: ${result.suggestedAction}`);
      console.log(`   ✓ Uzasadnienie: ${result.reasoning.substring(0, 100)}...`);
      console.log('');
    } catch (error: any) {
      console.error(`❌ Błąd: ${error.message}`);
    }
  }
}

async function testGeneration() {
  console.log('\n🧪 TEST 2: Generowanie odpowiedzi AI\n');
  
  try {
    const response = await generateMaterialResponse(
      {
        firstName: "Jan",
        lastName: "Kowalski",
        greetingForm: "Dzień dobry Panie Janie",
        language: "pl"
      },
      {
        id: 1,
        name: "Kampania mebli biurowych",
        autoReplyContext: "Oferujemy meble biurowe. W treści maila pytamy: 'Czy mogę przesłać katalog i cennik?'",
        autoReplyRules: null,
        virtualSalespersonLanguage: "pl"
      },
      [
        {
          name: "Katalog mebli biurowych 2025",
          type: "LINK",
          url: "https://example.com/katalog.pdf",
          fileName: null
        }
      ],
      "Tak, proszę przesłać katalog!"
    );

    console.log(`📨 Temat: ${response.subject}`);
    console.log(`\n📝 Treść:\n${response.content}`);
    console.log('\n✅ Generowanie zakończone sukcesem\n');
  } catch (error: any) {
    console.error(`❌ Błąd: ${error.message}`);
  }
}

async function testDatabase() {
  console.log('\n🧪 TEST 3: Sprawdzenie bazy danych\n');
  
  try {
    // Sprawdź kampanie z auto-reply
    const campaignsWithAutoReply = await db.campaign.findMany({
      where: { autoReplyEnabled: true },
      select: {
        id: true,
        name: true,
        autoReplyEnabled: true,
        autoReplyDelayMinutes: true,
        _count: {
          select: {
            materials: true
          }
        }
      }
    });

    console.log(`📊 Kampanie z włączonym auto-reply: ${campaignsWithAutoReply.length}`);
    campaignsWithAutoReply.forEach(c => {
      console.log(`   - ${c.name} (ID: ${c.id}) - ${c._count.materials} materiałów, delay: ${c.autoReplyDelayMinutes}min`);
    });

    // Sprawdź materiały
    const allMaterials = await db.campaignMaterial.findMany({
      where: { isActive: true },
      include: {
        campaign: {
          select: { name: true }
        }
      }
    });

    console.log(`\n📎 Aktywne materiały: ${allMaterials.length}`);
    allMaterials.forEach(m => {
      console.log(`   - ${m.name} (${m.type}) - Kampania: ${m.campaign.name}`);
    });

    // Sprawdź zaplanowane wysyłki
    const scheduledResponses = await db.materialResponse.findMany({
      where: { status: 'scheduled' },
      include: {
        lead: {
          select: { email: true }
        },
        campaign: {
          select: { name: true }
        }
      }
    });

    console.log(`\n📤 Zaplanowane wysyłki: ${scheduledResponses.length}`);
    scheduledResponses.forEach(r => {
      console.log(`   - Lead: ${r.lead.email}, Kampania: ${r.campaign.name}, Zaplanowane: ${r.scheduledAt?.toLocaleString('pl-PL')}`);
    });

    // Sprawdź kolejkę decyzji
    const pendingDecisions = await db.pendingMaterialDecision.findMany({
      where: { status: 'PENDING' },
      include: {
        lead: {
          select: { email: true }
        },
        campaign: {
          select: { name: true }
        }
      }
    });

    console.log(`\n⚖️ Oczekujące decyzje: ${pendingDecisions.length}`);
    pendingDecisions.forEach(d => {
      console.log(`   - Lead: ${d.lead.email}, Kampania: ${d.campaign.name}, Confidence: ${(d.aiConfidence * 100).toFixed(0)}%`);
    });

    console.log('\n✅ Sprawdzenie bazy zakończone\n');
  } catch (error: any) {
    console.error(`❌ Błąd: ${error.message}`);
  }
}

async function main() {
  console.log('🚀 Uruchamianie testów modułu automatycznych odpowiedzi z materiałami\n');
  console.log('=' .repeat(60));

  try {
    await testAnalysis();
    await testGeneration();
    await testDatabase();

    console.log('=' .repeat(60));
    console.log('\n✅ Wszystkie testy zakończone!\n');
  } catch (error: any) {
    console.error(`\n❌ Błąd krytyczny: ${error.message}\n`);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

// Uruchom tylko jeśli wywołany bezpośrednio
if (require.main === module) {
  main();
}

export { testAnalysis, testGeneration, testDatabase };


