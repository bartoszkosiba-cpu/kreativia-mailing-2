# 🔄 PRZEPISANIE MODUŁU WYSYŁKI - ANALIZA

## 🐛 OBECNE PROBLEMY:

1. **Podwójna logika delay** - delay jest w scheduledAt, ale też sprawdzany znowu
2. **Maile w przeszłości nie są wysyłane** - mimo że scheduledAt <= now
3. **Logika jest pokręcona** - wiele warunków, które mogą blokować wysyłkę
4. **Brak klarownej odpowiedzialności** - co odpowiada za co?

## 📊 OBECNA ARCHITEKTURA:

### System 1: CampaignEmailQueue (NOWY)
- Kolejka z precyzyjnymi czasami (scheduledAt)
- Cron co 1 minutę sprawdza i wysyła
- Delay jest w scheduledAt

### System 2: scheduledSender (STARY - backup)
- Wysyła bezpośrednio z CampaignLead
- Używa processScheduledCampaign
- Nie używa kolejki

## ❌ PROBLEMY W OBECNEJ LOGICE:

### Problem 1: **Filtrowanie scheduledAt**
```typescript
scheduledAt: {
  lte: toleranceWindow // toleranceWindow = now + 5 min
}
```
- Maile w przeszłości są znajdowane ✅
- Ale potem jest sprawdzanie okna czasowego ❌
- I sprawdzanie delay (który już jest w scheduledAt) ❌

### Problem 2: **Sprawdzanie okna czasowego dla opóźnionych maili**
```typescript
if (isPastDue) {
  // Wysyłaj catch-up (pomijamy okno czasowe)
} else if (!validation.isValid) {
  return // Odkładam
}
```
- To jest OK, ale może być problem z innymi warunkami

### Problem 3: **Brak skrzynek**
```typescript
if (!availableMailbox) {
  // Przywróć do pending
  return
}
```
- Jeśli brak skrzynek, mail jest odkładany
- Ale następny cron może znowu nie znaleźć skrzynki
- To może powodować "zawieszenie"

## ✅ PROSTA LOGIKA (PROPONOWANA):

### Zasada: **scheduledAt jest jedynym źródłem prawdy**

```typescript
// 1. Znajdź mail gdzie scheduledAt <= now
const nextEmail = await db.campaignEmailQueue.findFirst({
  where: {
    status: "pending",
    scheduledAt: { lte: now } // scheduledAt już zawiera delay!
  }
});

if (!nextEmail) return;

// 2. Sprawdź tylko kampanię (IN_PROGRESS)
if (campaign.status !== "IN_PROGRESS") return;

// 3. Sprawdź tylko skrzynkę
const mailbox = await getNextAvailableMailbox(...);
if (!mailbox) {
  // Przywróć do pending - następny cron spróbuje
  return;
}

// 4. WYŚLIJ!
// scheduledAt <= now oznacza że delay minął - nie sprawdzaj delay znowu!
// Dla opóźnionych maili (isPastDue) - pomijamy okno czasowe (catch-up)
```

## 🎯 CO NAPRAWIĆ:

1. ✅ **Usuń sprawdzanie delay** - scheduledAt już go zawiera
2. ✅ **Uprość warunki** - tylko kampania + skrzynka
3. ✅ **Dla opóźnionych maili** - pomijaj okno czasowe (catch-up)
4. ✅ **Dla normalnych maili** - sprawdź okno czasowe

## 📝 NOWA LOGIKA (UPROSZCZONA):

```typescript
// KROK 1: Znajdź mail (scheduledAt <= now)
// KROK 2: Sprawdź kampanię (IN_PROGRESS)
// KROK 3: Sprawdź skrzynkę
// KROK 4: Sprawdź okno czasowe (tylko dla normalnych maili, nie catch-up)
// KROK 5: Wysyłaj!
```


