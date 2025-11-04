# 🔍 ANALIZA PROBLEMU DUPLIKATÓW MAILI

## ❌ PROBLEM:
**13 duplikatów dzisiaj** - leady dostają po 2 maile w tej samej sekundzie

## 🔬 PRZYCZYNA:

**Timeline dla leadId 288 (12:30:04):**

1. **Cron 1 (12:30:04.000):**
   - `getNextScheduledCampaign()` → kampania 3
   - `campaign.CampaignLead` → lista leadów (w tym lead 288, status: "queued")
   - Sprawdza SendLog → brak
   - Atomic lock: `queued → sending` ✅ (SUCCESS)
   - Wywołuje `sendSingleEmail()`
   - SMTP wysyła mail
   - Zapisuje do SendLog (12:30:04.100)

2. **Cron 2 (12:30:04.050 - równocześnie!):**
   - `getNextScheduledCampaign()` → kampania 3 (TA SAMA!)
   - `campaign.CampaignLead` → lista leadów (w tym lead 288, status: nadal "queued" - pierwszy cron jeszcze nie zaktualizował!)
   - Sprawdza SendLog → brak (pierwszy cron jeszcze nie zapisał - 50ms opóźnienie)
   - Atomic lock: `queued → sending` ✅ (SUCCESS - bo pierwszy jeszcze nie zaktualizował statusu!)
   - Wywołuje `sendSingleEmail()`
   - SMTP wysyła mail
   - Zapisuje do SendLog (12:30:04.150)

## 🐛 ROOT CAUSE:

**Problem:** Relacja `campaign.CampaignLead` jest pobierana RAZ na początku i zawiera listę leadów z ich statusami. Jeśli dwa crony pobiorą kampanię w tym samym momencie, oba dostaną tę samą listę leadów z tymi samymi statusami ("queued").

**Race condition:**
- Cron 1: Pobiera listę → lead 288 ma status "queued"
- Cron 2: Pobiera listę (50ms później) → lead 288 NADAL ma status "queued" (bo Cron 1 jeszcze nie zaktualizował)
- Oba próbują atomic lock → oba mogą przejść jeśli są bardzo blisko w czasie

## ✅ ROZWIĄZANIA:

### Rozwiązanie 1: Pobieraj leada atomowo z bazy (ZALECANE)
Zamiast używać `campaign.CampaignLead` (relacja), pobierz leada BEZPOŚREDNIO z bazy w jednej atomowej operacji:

```typescript
// Zamiast:
for (const cl of campaign.CampaignLead) { ... }

// Użyj:
const atomicLead = await db.campaignLead.findFirst({
  where: {
    campaignId: campaign.id,
    status: "queued",
    lead: { status: { not: "BLOCKED" }, isBlocked: false }
  },
  include: { lead: true },
  orderBy: { createdAt: "asc" }
});

// Atomowy lock w jednej operacji:
const lock = await db.campaignLead.updateMany({
  where: { id: atomicLead.id, status: "queued" },
  data: { status: "sending" }
});
```

### Rozwiązanie 2: Unique constraint w bazie (DODATKOWE ZABEZPIECZENIE)
Dodaj unique constraint na `SendLog(campaignId, leadId, variantLetter)` - to zapobiegnie duplikatom na poziomie bazy danych:

```prisma
model SendLog {
  // ...
  @@unique([campaignId, leadId, variantLetter])
}
```

## 📊 OBECNA SYTUACJA:

- **Atomic locking:** ✅ Działa, ale jest za późno (po pobraniu listy)
- **SendLog check:** ✅ Działa, ale jest za późno (SMTP już wysłał)
- **Unique constraint:** ❌ BRAK - pozwala na duplikaty

## 🎯 REKOMENDACJA:

1. **Natychmiast:** Dodać unique constraint (najszybsze rozwiązanie)
2. **Długoterminowo:** Zmienić logikę na atomowe pobieranie leada (bardziej odporne)


