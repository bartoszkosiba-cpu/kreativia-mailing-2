/**
 * Szybkie sprawdzenie tempa wysyłek
 * Uruchom: npx tsx scripts/check-sending-rate.ts
 */

import { db } from '../src/lib/db';

async function checkSendingRate() {
  const campaignId = 3;
  
  // Sprawdź status kampanii
  const campaign = await db.campaign.findUnique({
    where: { id: campaignId },
    select: {
      status: true,
      delayBetweenEmails: true
    }
  });
  
  console.log('\n📊 SPRAWDZENIE TEMPA WYSYŁEK\n');
  console.log('='.repeat(60));
  console.log(`Status kampanii: ${campaign?.status || 'N/A'}`);
  console.log(`Delay: ${campaign?.delayBetweenEmails || 90}s`);
  
  // Sprawdź ostatnie 10 maili (ostatnie 5 minut)
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  const recentSent = await db.sendLog.findMany({
    where: {
      campaignId,
      status: 'sent',
      createdAt: { gte: fiveMinutesAgo }
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: {
      lead: {
        select: { email: true }
      }
    }
  });
  
  console.log(`\n📧 Ostatnie ${recentSent.length} maili (ostatnie 5 min):`);
  
  if (recentSent.length === 0) {
    console.log('   ⚠️  Brak wysłanych maili');
  } else {
    // Oblicz odstępy
    const intervals: number[] = [];
    for (let i = 1; i < recentSent.length; i++) {
      const prevTime = new Date(recentSent[i - 1].createdAt).getTime();
      const currTime = new Date(recentSent[i].createdAt).getTime();
      const interval = (prevTime - currTime) / 1000; // sekundy
      intervals.push(interval);
    }
    
    if (intervals.length > 0) {
      const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const min = Math.min(...intervals);
      const max = Math.max(...intervals);
      
      console.log(`\n⏱️  ODSTĘPY:`);
      console.log(`   Średni: ${Math.floor(avg)}s`);
      console.log(`   Min: ${Math.floor(min)}s`);
      console.log(`   Max: ${Math.floor(max)}s`);
      console.log(`   Oczekiwany: 72-108s (90s ±20%)`);
      
      console.log(`\n✅ WERYFIKACJA:`);
      if (min < 30) {
        console.log(`   ❌ ZBYT SZYBKO! Najmniejszy odstęp: ${Math.floor(min)}s`);
        console.log(`   ⚠️  MOŻLIWE MASOWE WYSYŁKI!`);
      } else if (avg >= 72 && avg <= 108) {
        console.log(`   ✅ OK! Tempo jest prawidłowe`);
      } else if (avg < 72) {
        console.log(`   ⚠️  Zbyt szybko (średnio ${Math.floor(avg)}s, oczekiwane 72-108s)`);
      } else {
        console.log(`   ⚠️  Zbyt wolno (średnio ${Math.floor(avg)}s, oczekiwane 72-108s)`);
      }
      
      // Pokaż ostatnie maile
      console.log(`\n📋 Ostatnie maile:`);
      recentSent.slice(0, 5).forEach((log, index) => {
        const time = new Date(log.createdAt);
        const timeStr = time.toLocaleTimeString('pl-PL');
        console.log(`   ${index + 1}. ${timeStr} - ${log.lead?.email || 'N/A'}`);
      });
    }
  }
  
  // Sprawdź kolejkę
  const queueCount = await db.campaignEmailQueue.count({
    where: {
      campaignId,
      status: { in: ['pending', 'sending'] }
    }
  });
  
  console.log(`\n📋 Kolejka V2: ${queueCount} maili`);
  
  console.log('\n' + '='.repeat(60) + '\n');
  
  await db.$disconnect();
}

checkSendingRate();

