# 📋 ANALIZA: Co się dzieje gdy wyłączamy autoReplyEnabled?

## 🎯 PROBLEM

Użytkownik wyłączył `autoReplyEnabled` dla kampanii 3 **po tym, jak** zostały utworzone PendingMaterialDecision dla leadów z 3.11.

**Pytanie:** Co powinno się stać z istniejącymi PendingMaterialDecision gdy wyłączamy autoReplyEnabled?

---

## 🔍 OBECNA LOGIKA

### **1. Tworzenie PendingMaterialDecision:**

**Kod:** `src/services/emailAgentAI.ts` (linia 169)

```typescript
case 'INTERESTED':
  const campaign = reply.campaign;
  if (campaign?.autoReplyEnabled && campaignId) {
    // ✅ TYLKO jeśli autoReplyEnabled = true
    const materialAnalysis = await this.checkMaterialRequest(reply, campaign);
    if (materialAnalysis.isMaterialRequest && materialAnalysis.confidence >= 0.6) {
      // Tworzy PendingMaterialDecision
      return {
        actions: [{ type: 'ASK_ADMIN_MATERIALS' }],
        // ...
      };
    }
  }
  // ❌ Jeśli autoReplyEnabled = false → pomija całą logikę materiałów
```

**Wnioski:**
- ✅ **NOWE** odpowiedzi INTERESTED **NIE** tworzą PendingMaterialDecision gdy `autoReplyEnabled = false`
- ✅ To jest **POPRAWNE** zachowanie

### **2. Wysyłka MaterialResponse:**

**Kod:** `src/services/emailCron.ts` (linia 178)

```typescript
// Wyślij zaplanowane odpowiedzi z materiałami
try {
  const { sendScheduledMaterialResponses } = await import('./materialResponseSender');
  const sentCount = await sendScheduledMaterialResponses();
  if (sentCount > 0) {
    console.log(`[CRON] ✓ Wysłano ${sentCount} odpowiedzi z materiałami`);
  }
} catch (error: any) {
  console.error('[CRON] ✗ Błąd wysyłki materiałów:', error.message);
}
```

**Sprawdza:** `sendScheduledMaterialResponses` w `materialResponseSender.ts`

**Kod:** `src/services/materialResponseSender.ts` (linia 256)

```typescript
export async function sendScheduledMaterialResponses(): Promise<number> {
  const now = new Date();
  
  // Pobierz zaplanowane odpowiedzi
  const scheduledResponses = await db.materialResponse.findMany({
    where: {
      status: 'scheduled',
      scheduledAt: {
        lte: now // Zaplanowane na teraz lub wcześniej
      }
    },
    include: {
      lead: true,
      campaign: {
        include: {
          virtualSalesperson: {
            include: {
              mailboxes: {
                where: { isActive: true },
                orderBy: [
                  // ...
                ]
              }
            }
          }
        }
      }
    }
  });
  
  // ❌ PROBLEM: NIE sprawdza czy campaign.autoReplyEnabled = true!
  // Jeśli użytkownik wyłączy autoReplyEnabled, MaterialResponse w statusie 'scheduled'
  // będą nadal wysyłane!
}
```

---

## ❌ ZNALEZIONE PROBLEMY

### **Problem 1: MaterialResponse są wysyłane nawet gdy autoReplyEnabled = false**

**Sytuacja:**
1. Użytkownik włącza `autoReplyEnabled = true`
2. System tworzy MaterialResponse (status: 'scheduled')
3. Użytkownik wyłącza `autoReplyEnabled = false`
4. Cron nadal wysyła MaterialResponse (bo nie sprawdza `autoReplyEnabled`)

**Kod problematyczny:** `sendScheduledMaterialResponses` nie sprawdza `campaign.autoReplyEnabled`

### **Problem 2: PendingMaterialDecision pozostają bez zmian**

**Obecna logika:**
- ✅ **NOWE** odpowiedzi nie tworzą PendingMaterialDecision gdy `autoReplyEnabled = false`
- ❓ **ISTNIEJĄCE** PendingMaterialDecision pozostają bez zmian

**Pytania:**
- Czy istniejące PendingMaterialDecision powinny zostać?
- Czy powinny być automatycznie odrzucone (REJECTED)?
- Czy powinny być ukryte w UI?

---

## ✅ REKOMENDACJA

### **1. Naprawa: Sprawdzenie autoReplyEnabled w sendScheduledMaterialResponses**

**Zmiana:** Dodać filtrowanie w `sendScheduledMaterialResponses`:

```typescript
const scheduledResponses = await db.materialResponse.findMany({
  where: {
    status: 'scheduled',
    scheduledAt: { lte: now },
    campaign: {
      autoReplyEnabled: true // ✅ TYLKO jeśli autoReplyEnabled = true
    }
  },
  // ...
});
```

**Dodatkowo:** Oznaczyć MaterialResponse jako 'cancelled' jeśli `autoReplyEnabled = false`:

```typescript
// Jeśli MaterialResponse jest w statusie 'scheduled' ale kampania ma autoReplyEnabled = false
// Zmień status na 'cancelled'
await db.materialResponse.updateMany({
  where: {
    status: 'scheduled',
    campaign: {
      autoReplyEnabled: false
    }
  },
  data: {
    status: 'cancelled',
    error: 'Automatyczne odpowiedzi zostały wyłączone dla tej kampanii'
  }
});
```

### **2. PendingMaterialDecision: Pozostaw bez zmian**

**Rekomendacja:** 
- ✅ **ZOSTAW** istniejące PendingMaterialDecision bez zmian
- ✅ **POKAZUJ** je w UI (nawet jeśli `autoReplyEnabled = false`)
- ✅ **POZWÓL** administratorowi podjąć decyzję (APPROVED/REJECTED)

**Uzasadnienie:**
- PendingMaterialDecision to **decyzje administratora**, nie automatyczne akcje
- Jeśli użytkownik wyłączy autoReplyEnabled, to nie znaczy że chce anulować **już oczekujące decyzje**
- Administrator powinien mieć możliwość ręcznej decyzji dla istniejących PendingMaterialDecision

**Alternatywa (opcjonalna):**
- Dodać informację w UI: "Automatyczne odpowiedzi są wyłączone, ale istnieją oczekujące decyzje"
- Dodać przycisk "Odrzuć wszystkie oczekujące" gdy wyłączamy autoReplyEnabled

---

## 🔧 IMPLEMENTACJA

### **Krok 1: Naprawa sendScheduledMaterialResponses**

**Plik:** `src/services/materialResponseSender.ts`

**Zmiana:**
```typescript
const scheduledResponses = await db.materialResponse.findMany({
  where: {
    status: 'scheduled',
    scheduledAt: { lte: now },
    campaign: {
      autoReplyEnabled: true // ✅ NOWE: Sprawdź autoReplyEnabled
    }
  },
  // ...
});
```

### **Krok 2: Anulowanie MaterialResponse gdy wyłączamy autoReplyEnabled**

**Plik:** `app/api/campaigns/[id]/auto-replies/route.ts` (lub miejsce gdzie zapisujemy autoReplyEnabled)

**Zmiana:**
```typescript
// Po zapisaniu autoReplyEnabled = false
if (!autoReplyEnabled) {
  // Anuluj wszystkie MaterialResponse w statusie 'scheduled'
  await db.materialResponse.updateMany({
    where: {
      campaignId: campaignId,
      status: 'scheduled'
    },
    data: {
      status: 'cancelled',
      error: 'Automatyczne odpowiedzi zostały wyłączone dla tej kampanii'
    }
  });
}
```

### **Krok 3: UI - Informacja o wyłączonych automatycznych odpowiedziach**

**Plik:** `app/campaigns/[id]/CampaignMaterialDecisions.tsx`

**Zmiana:**
- Dodać komunikat gdy `autoReplyEnabled = false` ale są PendingMaterialDecision
- Dodać przycisk "Odrzuć wszystkie oczekujące" (opcjonalnie)

---

## 📊 PODSUMOWANIE

| Element | Obecna logika | Problemy | Rekomendacja |
|---------|---------------|----------|--------------|
| **NOWE MaterialResponse** | ✅ Nie tworzy gdy `autoReplyEnabled = false` | ✅ OK | ✅ Zostaw bez zmian |
| **ISTNIEJĄCE MaterialResponse (scheduled)** | ❌ Wysyła nawet gdy `autoReplyEnabled = false` | ❌ BŁĄD | ✅ Dodać filtrowanie + anulowanie |
| **NOWE PendingMaterialDecision** | ✅ Nie tworzy gdy `autoReplyEnabled = false` | ✅ OK | ✅ Zostaw bez zmian |
| **ISTNIEJĄCE PendingMaterialDecision** | ✅ Pozostają bez zmian | ✅ OK | ✅ Zostaw bez zmian (decyzja administratora) |

