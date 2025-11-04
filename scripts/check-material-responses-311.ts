import { db } from '../src/lib/db';

async function checkMaterialResponsesFrom311() {
  const campaignId = 3;
  const targetDate = new Date('2025-11-03T00:00:00.000Z');
  const endDate = new Date('2025-11-04T00:00:00.000Z');

  console.log('\n🔍 SPRAWDZANIE AUTOMATYCZNYCH ODPOWIEDZI Z MATERIAŁAMI Z 3.11.2025\n');
  console.log('='.repeat(70));

  // 1. Sprawdź zainteresowanych leadów z 3.11
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

  // 2. Sprawdź MaterialResponse (nowe tabele - będą puste)
  const materialResponses = await db.materialResponse.findMany({
    where: {
      campaignId: campaignId,
      createdAt: {
        gte: targetDate,
        lt: endDate,
      },
    },
    include: {
      lead: true,
      reply: true,
    },
  });

  console.log(`📦 MaterialResponse z 3.11: ${materialResponses.length}`);
  if (materialResponses.length > 0) {
    materialResponses.forEach((mr) => {
      console.log(`   - ID: ${mr.id}, Lead: ${mr.lead.email}, Status: ${mr.status}, SentAt: ${mr.sentAt}`);
    });
  }

  // 3. Sprawdź PendingMaterialDecision (nowe tabele - będą puste)
  const pendingDecisions = await db.pendingMaterialDecision.findMany({
    where: {
      campaignId: campaignId,
      createdAt: {
        gte: targetDate,
        lt: endDate,
      },
    },
    include: {
      lead: true,
      reply: true,
    },
  });

  console.log(`\n📋 PendingMaterialDecision z 3.11: ${pendingDecisions.length}`);
  if (pendingDecisions.length > 0) {
    pendingDecisions.forEach((pd) => {
      console.log(`   - ID: ${pd.id}, Lead: ${pd.lead.email}, Status: ${pd.status}`);
    });
  }

  // 4. Sprawdź SendLog - maile wysłane do zainteresowanych leadów PO otrzymaniu odpowiedzi
  console.log(`\n📧 SendLog - maile wysłane do zainteresowanych leadów z 3.11:\n`);
  
  for (const reply of interestedReplies) {
    if (!reply.leadId) continue;

    const sendLogs = await db.sendLog.findMany({
      where: {
        campaignId: campaignId,
        leadId: reply.leadId,
        createdAt: {
          gte: reply.receivedAt, // PO otrzymaniu odpowiedzi
          lte: endDate,
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    console.log(`\n👤 Lead: ${reply.lead?.email || reply.fromEmail}`);
    console.log(`   📥 Otrzymano odpowiedź INTERESTED: ${reply.receivedAt.toISOString()}`);
    console.log(`   📤 Maile wysłane PO odpowiedzi: ${sendLogs.length}`);

    if (sendLogs.length > 0) {
      sendLogs.forEach((sl) => {
        const timeDiff = Math.round((sl.createdAt.getTime() - reply.receivedAt.getTime()) / 1000 / 60); // minuty
        console.log(`      - ID: ${sl.id}, Subject: ${sl.subject || '(brak)'}, CreatedAt: ${sl.createdAt.toISOString()} (${timeDiff} min po odpowiedzi)`);
        if (sl.content) {
          const preview = sl.content.substring(0, 100).replace(/\n/g, ' ');
          console.log(`        Preview: ${preview}...`);
        }
      });
    } else {
      console.log(`      ❌ Brak maili wysłanych PO odpowiedzi`);
    }
  }

  // 5. Sprawdź ustawienia kampanii
  const campaign = await db.campaign.findUnique({
    where: { id: campaignId },
    select: {
      id: true,
      name: true,
      autoReplyEnabled: true,
      autoReplyDelayMinutes: true,
    },
  });

  console.log(`\n⚙️  Ustawienia kampanii 3:`);
  console.log(`   - autoReplyEnabled: ${campaign?.autoReplyEnabled ? '✅ TAK' : '❌ NIE'}`);
  console.log(`   - autoReplyDelayMinutes: ${campaign?.autoReplyDelayMinutes || 'brak'}`);

  // 6. Sprawdź materiały kampanii
  const materials = await db.material.findMany({
    where: {
      campaignId: campaignId,
      isActive: true,
    },
    orderBy: {
      order: 'asc',
    },
  });

  console.log(`\n📎 Materiały kampanii 3: ${materials.length}`);
  if (materials.length > 0) {
    materials.forEach((m) => {
      console.log(`   - ${m.name} (${m.type}): ${m.type === 'LINK' ? m.url : m.fileName}`);
    });
  } else {
    console.log(`   ❌ Brak materiałów przypisanych do kampanii`);
  }

  console.log('\n' + '='.repeat(70));
  console.log('\n✅ ANALIZA ZAKOŃCZONA\n');

  await db.$disconnect();
}

checkMaterialResponsesFrom311().catch(async (e) => {
  console.error(e);
  await db.$disconnect();
  process.exit(1);
});

