# 🔍 DEBUG - DLACZEGO MAIL NIE JEST WYSYŁANY?

## 📊 STAN:
- Mail zaplanowany: **21:41:49** (20:41:49 UTC)
- Teraz: **22:00:15** (21:00:15 UTC)
- Mail jest **18 minut w przeszłości**
- Status w UI: "Gotowy do wysłania" + "cron wyśle gdy scheduledAt minie"
- **Ale cron nie wysyła!**

## 🔍 ANALIZA LOGIKI:

### 1. KROK 1: Znajdź mail
```typescript
scheduledAt: {
  lte: toleranceWindow // toleranceWindow = now + 5 min
}
```
✅ Mail jest w przeszłości → `scheduledAt <= toleranceWindow` → **ZNAJDZIE**

### 2. KROK 2: Sprawdź kampanię
```typescript
if (nextEmail.campaign.status !== "IN_PROGRESS") return
```
❓ Sprawdź czy kampania jest IN_PROGRESS

### 3. KROK 3: Sprawdź okno czasowe
```typescript
if (isPastDue) {
  // Wysyłaj catch-up (pomijamy okno czasowe)
} else if (!validation.isValid) {
  return // Odkładam
}
```
✅ Mail jest w przeszłości → `isPastDue = true` → **KONTYNUUJE**

### 4. KROK 4: Atomowa blokada
```typescript
updateMany({
  where: { id: nextEmail.id, status: "pending" },
  data: { status: "sending" }
})
```
❓ Jeśli updateMany.count === 0 → inny proces zajął

### 5. KROK 5: Sprawdź skrzynkę
```typescript
availableMailbox = await getNextAvailableMailbox(...)
if (!availableMailbox) {
  // Przywróć do pending
  return
}
```
❓ Może brak skrzynek?

## 🎯 MOŻLIWE PROBLEMY:

### Problem 1: **Brak dostępnych skrzynek**
- Jeśli wszystkie skrzynki osiągnęły limit dzienny
- System odkłada mail do pending
- Ale cron nie wysyła ponownie

### Problem 2: **Kampania nie jest IN_PROGRESS**
- Jeśli status zmienił się na PAUSED/SCHEDULED
- Mail jest odkładany

### Problem 3: **Race condition**
- Inny proces już zajął mail (status: sending)
- Ale nie wysłał (crash/błąd)
- Mail pozostaje w statusie "sending"

### Problem 4: **Cron nie działa**
- Cron nie jest uruchomiony
- Albo nie wywołuje sendScheduledCampaignEmails

## 🔧 CO SPRAWDZIĆ:

1. **Sprawdź logi serwera:**
   ```
   [CRON] 📧 Sprawdzam kolejkę kampanii...
   [CAMPAIGN SENDER] 📧 Znaleziono mail do wysłania...
   [CAMPAIGN SENDER] ⚠️ Mail opóźniony... - wysyłam catch-up
   ```

2. **Sprawdź status maila w kolejce:**
   ```sql
   SELECT id, status, scheduledAt, error
   FROM CampaignEmailQueue
   WHERE campaignId = 4 AND status IN ('pending', 'sending')
   ORDER BY scheduledAt ASC
   LIMIT 5;
   ```

3. **Sprawdź status kampanii:**
   ```sql
   SELECT id, name, status FROM Campaign WHERE id = 4;
   ```

4. **Sprawdź dostępność skrzynek:**
   - Czy handlowiec ma skrzynki?
   - Czy skrzynki mają limit dzienny?

## 🎯 PODEJRZENIA:

Najbardziej prawdopodobne:
1. **Brak dostępnych skrzynek** → mail odkładany, ale cron nie próbuje ponownie
2. **Cron nie działa** → nie wywołuje sendScheduledCampaignEmails
3. **Mail w statusie "sending"** → zablokowany przez poprzedni proces (crash)


