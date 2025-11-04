import { db } from '../src/lib/db';

async function findAndUpdateInterestedFrom311() {
  const campaignId = 3;
  const dateStart = new Date('2025-11-03T00:00:00Z');
  const dateEnd = new Date('2025-11-04T00:00:00Z');
  
  console.log('\n🔍 SZUKANIE I AKTUALIZACJA: Zainteresowani z 3.11.2025\n');
  console.log('='.repeat(70));
  
  // 1. Znajdź wszystkie odpowiedzi INTERESTED z 3.11 dla kampanii 3
  const replies = await db.inboxReply.findMany({
    where: {
      campaignId: campaignId,
      classification: 'INTERESTED',
      receivedAt: {
        gte: dateStart,
        lt: dateEnd
      }
    },
    include: {
      lead: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true
        }
      }
    },
    orderBy: {
      receivedAt: 'asc'
    }
  });
  
  console.log(`📊 Znaleziono ${replies.length} odpowiedzi INTERESTED z 3.11\n`);
  
  if (replies.length === 0) {
    console.log('❌ Brak odpowiedzi INTERESTED z 3.11');
    await db.$disconnect();
    return;
  }
  
  // 2. Dla każdej odpowiedzi sprawdź i zaktualizuj
  const leadIdsToUpdate: number[] = [];
  
  console.log('📋 SZCZEGÓŁY:\n');
  
  for (const reply of replies) {
    const leadId = reply.leadId;
    if (!leadId) {
      console.log(`⚠️  Reply ${reply.id} - brak leadId`);
      continue;
    }
    
    console.log(`📧 ${reply.lead.email}`);
    console.log(`   → Reply ID: ${reply.id}`);
    console.log(`   → Lead ID: ${leadId}`);
    console.log(`   → receivedAt: ${reply.receivedAt.toISOString()}`);
    
    // Sprawdź MaterialResponse
    const materialResponse = await db.materialResponse.findFirst({
      where: { replyId: reply.id }
    });
    
    if (materialResponse) {
      console.log(`   → ✅ MaterialResponse: ID ${materialResponse.id}, Status: ${materialResponse.status}`);
      if (materialResponse.sentAt) {
        console.log(`   → ✅ Wysłano: ${materialResponse.sentAt.toISOString()}`);
      }
    } else {
      console.log(`   → MaterialResponse: BRAK`);
    }
    
    // Sprawdź CampaignLead
    const campaignLead = await db.campaignLead.findFirst({
      where: {
        leadId: leadId,
        campaignId: campaignId
      }
    });
    
    if (campaignLead) {
      console.log(`   → CampaignLead Status: ${campaignLead.status}`);
      
      if (campaignLead.status !== 'INTERESTED') {
        console.log(`   → ⚠️  NIE MA STATUSU INTERESTED - dodaję do listy aktualizacji`);
        leadIdsToUpdate.push(leadId);
      } else {
        console.log(`   → ✅ Ma już status INTERESTED`);
      }
    } else {
      console.log(`   → ⚠️  CampaignLead: BRAK - lead nie jest w kampanii?`);
    }
    
    console.log('');
  }
  
  console.log('='.repeat(70));
  console.log('\n📊 PODSUMOWANIE:\n');
  console.log(`   → Wszystkich odpowiedzi INTERESTED z 3.11: ${replies.length}`);
  console.log(`   → Do zaktualizowania (status != INTERESTED): ${leadIdsToUpdate.length}`);
  console.log('');
  
  // 3. Zaktualizuj CampaignLead.status → INTERESTED
  if (leadIdsToUpdate.length > 0) {
    console.log(`🔧 AKTUALIZACJA: CampaignLead.status → INTERESTED\n`);
    
    const result = await db.campaignLead.updateMany({
      where: {
        campaignId: campaignId,
        leadId: { in: leadIdsToUpdate }
      },
      data: {
        status: 'INTERESTED'
      }
    });
    
    console.log(`✅ Zaktualizowano ${result.count} rekordów CampaignLead.status → INTERESTED\n`);
    
    // Pokaż zaktualizowane leady
    const updatedLeads = await db.campaignLead.findMany({
      where: {
        campaignId: campaignId,
        leadId: { in: leadIdsToUpdate },
        status: 'INTERESTED'
      },
      include: {
        lead: {
          select: {
            email: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });
    
    console.log(`📋 ZAKTUALIZOWANE LEADY:\n`);
    updatedLeads.forEach((cl, i) => {
      console.log(`   ${i + 1}. ${cl.lead.email} - Status: ${cl.status}`);
    });
    console.log('');
  }
  
  // 4. Sprawdź czy wszystkie mają status INTERESTED
  const allLeadIds = replies.map(r => r.leadId!).filter((id): id is number => id !== null);
  const allInterested = await db.campaignLead.count({
    where: {
      campaignId: campaignId,
      leadId: { in: allLeadIds },
      status: 'INTERESTED'
    }
  });
  
  // 5. Sprawdź wszystkich zainteresowanych z kampanii 3
  const allInterestedInCampaign = await db.campaignLead.count({
    where: {
      campaignId: campaignId,
      status: 'INTERESTED'
    }
  });
  
  console.log('='.repeat(70));
  console.log('\n✅ FINALNE SPRAWDZENIE:\n');
  console.log(`   → Wszystkich leadów z 3.11: ${replies.length}`);
  console.log(`   → Z statusem INTERESTED: ${allInterested}`);
  console.log(`   → Wszystkich zainteresowanych w kampanii 3: ${allInterestedInCampaign}`);
  
  if (allInterested === replies.length) {
    console.log('\n✅ Wszyscy zainteresowani z 3.11 mają status INTERESTED!');
  } else {
    console.log(`\n⚠️  Różnica: ${replies.length - allInterested} leadów bez statusu INTERESTED`);
  }
  
  console.log('');
  await db.$disconnect();
}

findAndUpdateInterestedFrom311();

