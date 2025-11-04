import { db } from '../src/lib/db';

/**
 * Odtwarza MaterialResponse dla maili wysłanych 3.11.2025
 * które były automatycznymi odpowiedziami z katalogiem
 */
async function recreateMaterialResponsesFrom311() {
  const campaignId = 3;
  const targetDate = new Date('2025-11-03T00:00:00.000Z');
  const endDate = new Date('2025-11-04T00:00:00.000Z');

  console.log('\n🔄 ODTWARZANIE MaterialResponse dla maili z 3.11.2025\n');
  console.log('='.repeat(70));

  // 1. Znajdź zainteresowanych leadów z 3.11
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
    },
    orderBy: {
      receivedAt: 'asc',
    },
  });

  console.log(`📊 Znaleziono ${interestedReplies.length} odpowiedzi INTERESTED z 3.11\n`);

  if (interestedReplies.length === 0) {
    console.log('❌ Brak zainteresowanych leadów z 3.11.2025');
    await db.$disconnect();
    return;
  }

  // 2. Dla każdego zainteresowanego leada, znajdź mail wysłany PO odpowiedzi
  let createdCount = 0;

  for (const reply of interestedReplies) {
    if (!reply.leadId) continue;

    // Znajdź mail wysłany PO odpowiedzi (w ciągu 2 godzin)
    // Szukaj po treści zawierającej "załączeniu przesyłam katalog" lub po znanych ID
    const sendLogs = await db.sendLog.findMany({
      where: {
        campaignId: campaignId,
        leadId: reply.leadId,
        createdAt: {
          gte: reply.receivedAt,
          lte: new Date(reply.receivedAt.getTime() + 2 * 60 * 60 * 1000), // 2 godziny po odpowiedzi
        },
        OR: [
          {
            content: {
              contains: 'załączeniu przesyłam katalog', // Treść zawiera "załączeniu przesyłam katalog"
            },
          },
          {
            content: {
              contains: 'W załączeniu przesyłam katalog', // Alternatywna wersja
            },
          },
          {
            id: {
              in: [167, 198], // Znane ID z 3.11
            },
          },
        ],
      },
      orderBy: {
        createdAt: 'asc',
      },
      take: 1, // Weź pierwszy mail (powinien być tylko jeden)
    });

    if (sendLogs.length === 0) {
      console.log(`⚠️  Brak maila z katalogiem dla leada ${reply.lead?.email || reply.fromEmail}`);
      continue;
    }

    const sendLog = sendLogs[0];

    // Sprawdź czy już istnieje MaterialResponse dla tego replyId
    const existing = await db.materialResponse.findFirst({
      where: {
        replyId: reply.id,
      },
    });

    if (existing) {
      console.log(`⏭️  MaterialResponse już istnieje dla replyId ${reply.id} (ID: ${existing.id})`);
      continue;
    }

    // Utwórz MaterialResponse
    try {
      const materialResponse = await db.materialResponse.create({
        data: {
          leadId: reply.leadId!,
          campaignId: campaignId,
          replyId: reply.id,
          materialId: null, // NULL = wszystkie materiały kampanii
          subject: sendLog.subject || 'Re: Podwieszenia targowe',
          responseText: sendLog.content || '',
          aiConfidence: 0.9, // Wysoka pewność (bo to była automatyczna odpowiedź)
          aiReasoning: 'Odtworzone z SendLog dla maila wysłanego 3.11.2025',
          status: 'sent',
          scheduledAt: sendLog.createdAt,
          sentAt: sendLog.createdAt,
          mailboxId: sendLog.mailboxId,
          messageId: sendLog.messageId,
          error: null,
        },
      });

      console.log(`✅ Utworzono MaterialResponse ID: ${materialResponse.id}`);
      console.log(`   Lead: ${reply.lead?.email || reply.fromEmail}`);
      console.log(`   Reply ID: ${reply.id}`);
      console.log(`   SendLog ID: ${sendLog.id}`);
      console.log(`   SentAt: ${sendLog.createdAt.toISOString()}`);
      console.log('');

      createdCount++;
    } catch (error: any) {
      console.error(`❌ Błąd tworzenia MaterialResponse dla replyId ${reply.id}:`, error.message);
    }
  }

  console.log('='.repeat(70));
  console.log(`\n✅ ZAKOŃCZONO: Utworzono ${createdCount} MaterialResponse\n`);

  await db.$disconnect();
}

recreateMaterialResponsesFrom311().catch(async (e) => {
  console.error(e);
  await db.$disconnect();
  process.exit(1);
});

