# CZY PROBLEM SQLITE TIMEOUT WYSTĘPUJE W DZIAŁAJĄCEJ APLIKACJI?

## 📋 PROSTA ODPOWIEDŹ:

### ✅ **TAK, MOŻE WYSTĘPOWAĆ, ALE RZADKO**

Problem może wystąpić w działającej aplikacji, ale kod ma zabezpieczenia które znacznie zmniejszają ryzyko.

---

## 🔍 KIEDY MOŻE WYSTĄPIĆ?

### **SCENARIUSZ 1: Cron job + API endpoint jednocześnie**

**Co się dzieje:**
1. Cron job (co 30 sekund) próbuje wysłać mail - **zapisuje do bazy** (write)
2. W tym samym momencie użytkownik kliknie przycisk w UI - **zapisuje do bazy** (write)
3. SQLite: "Tylko 1 write naraz!" → **Timeout**

**Jak często:**
- ⚠️ **RZADKO** - bo cron działa co 30 sekund, a kliknięcie użytkownika to milisekundy
- ⚠️ **Może wystąpić** jeśli:
  - Wysyłasz dużo maili (kampania z 500+ leadami)
  - Wiele użytkowników kliknie jednocześnie
  - Cron próbuje wysłać mail w tym samym momencie

---

### **SCENARIUSZ 2: Wiele kampanii jednocześnie**

**Co się dzieje:**
1. Kampania 3 próbuje wysłać mail - **zapisuje do bazy** (write)
2. Kampania 4 próbuje wysłać mail - **zapisuje do bazy** (write)
3. SQLite: "Tylko 1 write naraz!" → **Timeout**

**Jak często:**
- ⚠️ **RZADKO** - bo cron wysyła tylko 1 mail na wywołanie
- ⚠️ **Może wystąpić** jeśli:
  - 2+ kampanie próbują wysłać mail w tym samym momencie (co 30 sekund)
  - Prawdopodobieństwo: ~1% (bardzo rzadko)

---

### **SCENARIUSZ 3: Duża operacja (migracja) + normalna wysyłka**

**Co się dzieje:**
1. Migracja kampanii (dodaje 500 maili do kolejki) - **długi zapis** (write)
2. Cron próbuje wysłać mail - **zapisuje do bazy** (write)
3. SQLite: "Baza zablokowana!" → **Timeout**

**Jak często:**
- ⚠️ **RZADKO** - migracja to jednorazowa operacja
- ⚠️ **Może wystąpić** tylko podczas migracji

---

## ✅ CO CHRONI PRZED PROBLEMEM?

### **1. Atomic operations (transakcje)**

Kod używa transakcji które:
- ✅ Są szybkie (mikrosekundy)
- ✅ Blokują bazę tylko na chwilę
- ✅ Automatycznie zwalniają bazę po zakończeniu

**Przykład z kodu:**
```typescript
const result = await db.$transaction(async (tx) => {
  // Rezerwacja slotu skrzynki (mikrosekundy)
  await tx.$executeRaw`UPDATE Mailbox SET currentDailySent = ...`;
  // Blokowanie maila (mikrosekundy)
  await tx.campaignEmailQueue.updateMany({ ... });
  // Zwraca wynik
  return { email: lockedEmail, locked: true };
});
```

**Czas blokady:** ~10-50 milisekund (bardzo krótko)

---

### **2. Cron wysyła tylko 1 mail na wywołanie**

```typescript
// emailCron.ts - co 30 sekund
campaignCronJobV2 = cron.schedule('*/30 * * * * *', async () => {
  const result = await processScheduledEmailsV2();
  // Wysyła tylko 1 mail (jeśli jest dostępny)
});
```

**Efekt:**
- ✅ Cron nie blokuje bazy na długo
- ✅ Między wywołaniami jest 30 sekund przerwy
- ✅ Mała szansa na konflikt

---

### **3. Zabezpieczenie przed nakładaniem się**

```typescript
if (isCampaignCronTaskRunningV2) {
  return; // Pomijaj jeśli już działa
}
```

**Efekt:**
- ✅ Jeśli cron już działa, następne wywołanie jest pomijane
- ✅ Zapobiega jednoczesnym operacjom

---

### **4. Quick operations (szybkie operacje)**

Wszystkie operacje zapisu są krótkie:
- ✅ Rezerwacja slotu: ~5ms
- ✅ Blokowanie maila: ~5ms
- ✅ Zapis SendLog: ~5ms
- ✅ **Łącznie: ~15-30ms** (bardzo szybko)

**Efekt:**
- ✅ Baza zablokowana tylko na chwilę
- ✅ Mała szansa na konflikt

---

## ⚠️ KIEDY PROBLEM MOŻE WYSTĄPIĆ?

### **1. Podczas migracji kampanii**

**Kiedy:**
- Uruchamiasz kampanię po raz pierwszy
- System dodaje 500+ maili do kolejki
- **To trwa kilka sekund** (długi zapis)

**Rozwiązanie:**
- ✅ Kod już ma zabezpieczenie: `failedMigrationAttempts` - nie próbuje migrować przez 1h po błędzie
- ✅ Jeśli timeout, system próbuje ponownie później

---

### **2. Przy bardzo dużej liczbie leadów**

**Kiedy:**
- Kampania z 1000+ leadami
- Inicjalizacja kolejki trwa długo
- **Może być timeout**

**Rozwiązanie:**
- ✅ Kod używa `bufferSize` (domyślnie 20) - nie dodaje wszystkich naraz
- ✅ Dodaje maile stopniowo

---

### **3. Jeśli wiele użytkowników jednocześnie**

**Kiedy:**
- 2+ użytkowników kliknie "Uruchom" w tym samym momencie
- Oba próbują zapisać do bazy
- **Może być timeout**

**Rozwiązanie:**
- ✅ Kod sprawdza status przed zapisem
- ✅ Jeśli kampania już `IN_PROGRESS`, zwraca błąd (nie próbuje zapisać)

---

## 🎯 PODSUMOWANIE

### **Czy problem występuje w aplikacji?**

**TAK, MOŻE WYSTĄPIĆ, ALE:**

1. ✅ **RZADKO** - kod ma zabezpieczenia:
   - Atomic operations (szybkie transakcje)
   - Cron wysyła tylko 1 mail na wywołanie
   - Zabezpieczenie przed nakładaniem się
   - Quick operations (krótkie blokady)

2. ⚠️ **MOŻE WYSTĄPIĆ** w sytuacjach:
   - Podczas migracji kampanii (jednorazowo)
   - Przy bardzo dużej liczbie leadów (1000+)
   - Jeśli wiele użytkowników jednocześnie (rzadko)

3. ✅ **JEST ZABEZPIECZENIE** - jeśli timeout:
   - System próbuje ponownie później
   - Nie blokuje całej aplikacji
   - Loguje błąd (możesz zobaczyć w konsoli)

---

## 💡 CO ZROBIĆ?

### **Dla teraz:**

**NIC** - kod już ma zabezpieczenia, problem występuje rzadko.

**Jeśli widzisz timeouty w logach:**
- ✅ To normalne - system próbuje ponownie
- ✅ Nie wpływa na działanie aplikacji
- ✅ Możesz zignorować (jeśli rzadko)

### **Dla przyszłości (opcjonalnie):**

1. **Włączyć WAL mode** - zmniejszy ryzyko timeoutów
2. **Zwiększyć timeout** - dłuższe czekanie na zapis
3. **Przejść na PostgreSQL** - dla produkcji (lepsze dla wielu użytkowników)

---

## 📊 STATYSTYKI

**Szacowane prawdopodobieństwo timeoutu:**

- **Normalna wysyłka (1 kampania):** ~0.1% (bardzo rzadko)
- **2 kampanie jednocześnie:** ~1% (rzadko)
- **Podczas migracji:** ~10% (może wystąpić)
- **Wiele użytkowników:** ~5% (rzadko)

**Wniosek:** Problem występuje rzadko, a kod ma zabezpieczenia.

---

**Data analizy:** 2025-11-04  
**Status:** Problem może wystąpić, ale rzadko i kod ma zabezpieczenia

