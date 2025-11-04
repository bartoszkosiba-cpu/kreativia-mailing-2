# ⚠️ ANALIZA OPÓŹNIENIA WYSYŁKI - Problem z cronem

**Data:** 2025-11-03  
**Problem:** Maile wychodzą co ~15 minut zamiast co 90 sekund

---

## 🔍 PRZYCZYNA PROBLEMU

### Obecna implementacja:

1. **Cron job uruchamia się co 5 minut:**
   ```typescript
   campaignCronJob = cron.schedule('*/5 * * * *', async () => {
     await processScheduledCampaign();
   });
   ```

2. **`processScheduledCampaign()` próbuje wysłać WSZYSTKIE maile:**
   - Pobiera wszystkie leady z statusem `queued`
   - Wysyła je w pętli z delay 90 sekund między każdym
   - **ALE:** Jeśli w trakcie pętli minie 5 minut, następne wywołanie cron może zrobić to samo

3. **Problem:**
   - Cron o 10:00:00 → wysyła 1 mail
   - Cron o 10:05:00 → wysyła kolejny mail (5 minut później)
   - Cron o 10:10:00 → wysyła kolejny mail (10 minut później)
   - **Realne opóźnienie: ~5 minut (najlepszy przypadek) lub więcej**

### Co powinno być:

- **Opcja 1:** Cron co 1 minutę → wtedy delay 90 sekund zadziała
- **Opcja 2:** Wysyłać tylko 1 mail na wywołanie cron → wtedy delay będzie respektowany
- **Opcja 3:** Użyć `setInterval` zamiast cron dla wysyłki (co 90 sekund)

---

## 📊 OBECNE ZACHOWANIE

**Kampania:**
- Delay między mailami: **90 sekund**
- Cron sprawdza: **co 5 minut**
- **Realne opóźnienie:** ~5-15 minut (zależnie od tego kiedy cron się uruchomi)

**Przykład:**
```
10:00:00 - Cron → wysyła mail #1
10:05:00 - Cron → wysyła mail #2 (5 min później)
10:10:00 - Cron → wysyła mail #3 (10 min później)
10:15:00 - Cron → wysyła mail #4 (15 min później)
```

**Oczekiwane:**
```
10:00:00 - Wysyła mail #1
10:01:30 - Wysyła mail #2 (90 sekund)
10:03:00 - Wysyła mail #3 (90 sekund)
10:04:30 - Wysyła mail #4 (90 sekund)
```

---

## 💡 REKOMENDOWANE ROZWIĄZANIE

### **Rozwiązanie 1: Zmień cron na co 1 minutę (NAJSZYBSZE)**

```typescript
// emailCron.ts
campaignCronJob = cron.schedule('* * * * *', async () => {  // Co 1 minutę
  await processScheduledCampaign();
});
```

**Zalety:**
- ✅ Proste - tylko zmiana częstotliwości
- ✅ `processScheduledCampaign()` może wysyłać 1 mail i czekać na następne wywołanie
- ✅ Delay 90 sekund będzie respektowany

**Wady:**
- ⚠️ Cron uruchamia się częściej (60x dziennie zamiast 12x)
- ⚠️ Więcej logów, ale to nie problem

---

### **Rozwiązanie 2: Wysyłać tylko 1 mail na wywołanie (LEPSZE)**

Zmodyfikuj `processScheduledCampaign()` aby wysyłało tylko 1 mail i kończyło:

```typescript
// Wysyła tylko 1 mail i kończy (nie całą pętlę)
const firstLead = leads[0];
if (firstLead) {
  await sendSingleEmail(campaign, firstLead, companySettings, 0);
  // Nie czekaj na delay - następne wywołanie cron wyśle kolejny
}
```

**Zalety:**
- ✅ Zachowuje obecny cron (co 5 minut)
- ✅ Bardziej kontrolowane (1 mail na sprawdzenie)
- ✅ Delay będzie faktycznie 5 minut (nie 90 sekund, ale przynajmniej regularnie)

**Wady:**
- ⚠️ Jeśli cron jest co 5 minut, delay będzie 5 minut, nie 90 sekund

---

### **Rozwiązanie 3: Użyj setInterval dla wysyłki (NAJLEPSZE, ale bardziej skomplikowane)**

Stwórz osobny mechanizm który:
1. Sprawdza co minutę czy jest kampania IN_PROGRESS
2. Wysyła 1 mail jeśli minęło 90 sekund od ostatniego

**Zalety:**
- ✅ Dokładny delay 90 sekund
- ✅ Niezależny od cron

**Wady:**
- ⚠️ Wymaga większych zmian w architekturze

---

## 🎯 REKOMENDACJA

**Najlepsze rozwiązanie: Rozwiązanie 1** (cron co 1 minutę)

**Dlaczego:**
- ✅ Najprostsze do wdrożenia
- ✅ Zachowuje obecną logikę
- ✅ Delay 90 sekund będzie działał poprawnie
- ✅ Minimalne ryzyko zmian

**Jak wdrożyć:**
1. Zmień `*/5 * * * *` na `* * * * *` w `emailCron.ts`
2. Opcjonalnie: zmodyfikuj `processScheduledCampaign()` aby wysyłało tylko 1 mail na wywołanie (dla większej kontroli)

---

## ⚠️ UWAGA

**Nie wprowadzę zmian bez Twojej zgody!**

Jeśli chcesz, mogę:
1. Zmienić cron na co 1 minutę (najprostsze)
2. Zmodyfikować `processScheduledCampaign()` aby wysyłało tylko 1 mail (zachowa cron co 5 min, ale delay będzie 5 min zamiast 90 sekund)
3. Zostawić jak jest (delay będzie 5-15 minut zamiast 90 sekund)

---

**Status:** 🔍 **ANALIZA ZAKOŃCZONA - CZEKAM NA DECYZJĘ**


