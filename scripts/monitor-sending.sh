#!/bin/bash

# Monitor wysyłek - sprawdza czy nie są masowe
# Uruchom: ./scripts/monitor-sending.sh

CAMPAIGN_ID=3
CHECK_INTERVAL=30  # sekundy

echo "🔍 Monitor wysyłek kampanii $CAMPAIGN_ID"
echo "Sprawdzanie co $CHECK_INTERVAL sekund..."
echo ""

while true; do
  echo "=========================================="
  echo "📊 $(date '+%H:%M:%S') - Status wysyłek"
  echo "=========================================="
  
  # Sprawdź ostatnie 5 maili
  cd "/Users/bartoszkosiba/Library/Mobile Documents/com~apple~CloudDocs/Katalogi/Cursor/Projekty/Kopie/Kreativia Mailing 2"
  
  npx tsx -e "
    import { db } from './src/lib/db';
    
    async function quickCheck() {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const recent = await db.sendLog.findMany({
        where: {
          campaignId: $CAMPAIGN_ID,
          status: 'sent',
          createdAt: { gte: fiveMinutesAgo }
        },
        orderBy: { createdAt: 'desc' },
        take: 5
      });
      
      console.log(\`Ostatnie 5 maili (ostatnie 5 min): \${recent.length}\`);
      
      if (recent.length > 1) {
        const first = new Date(recent[recent.length - 1].createdAt).getTime();
        const last = new Date(recent[0].createdAt).getTime();
        const avg = (last - first) / (recent.length - 1) / 1000;
        console.log(\`Średni odstęp: \${Math.floor(avg)}s\`);
        
        if (avg < 60) {
          console.log('❌ ZBYT SZYBKO!');
        } else {
          console.log('✅ OK');
        }
      }
      
      await db.\$disconnect();
    }
    
    quickCheck();
  "
  
  echo ""
  echo "Następne sprawdzenie za $CHECK_INTERVAL sekund..."
  sleep $CHECK_INTERVAL
done

