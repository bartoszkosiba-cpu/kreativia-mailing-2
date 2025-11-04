# ✅ ODTWORZENIE MaterialResponse dla maili z 3.11.2025

## 🎯 PROBLEM

Sekcja "Historia wysłanych" w interfejsie pokazuje tylko rekordy z tabeli `MaterialResponse` (status = 'sent'). 

**Problem:** Tabele `MaterialResponse` i `PendingMaterialDecision` **NIE ISTNIAŁY** w dniu 3.11.2025, więc maile wysłane wtedy nie są widoczne w historii.

---

## ✅ ROZWIĄZANIE

Odtworzono `MaterialResponse` dla 2 maili wysłanych 3.11.2025:

### **MaterialResponse ID: 1**
- **Lead:** piotr.lach@adrepublic.pl
- **Reply ID:** 197
- **SendLog ID:** 167
- **SentAt:** 2025-11-03 11:55:03 UTC (12:55 PL)
- **Subject:** "Re: Podwieszenia targowe – konstrukcje i tkaniny w jednym miejscu"
- **Status:** sent ✅

### **MaterialResponse ID: 2**
- **Lead:** marcin@artexpo.com.pl
- **Reply ID:** 199
- **SendLog ID:** 198
- **SentAt:** 2025-11-03 13:00:02 UTC (14:00 PL)
- **Subject:** "Re: Oferta podwieszeń targowych – konstrukcje, druk, ceny"
- **Status:** sent ✅

---

## 📊 DANE

**Utworzone rekordy:**
- `leadId`: Z `InboxReply.leadId`
- `campaignId`: 3
- `replyId`: Z `InboxReply.id`
- `materialId`: NULL (wszystkie materiały kampanii)
- `subject`: Z `SendLog.subject`
- `responseText`: Z `SendLog.content`
- `aiConfidence`: 0.9 (wysoka pewność - to była automatyczna odpowiedź)
- `aiReasoning`: "Odtworzone z SendLog dla maila wysłanego 3.11.2025"
- `status`: 'sent'
- `scheduledAt`: `SendLog.createdAt`
- `sentAt`: `SendLog.createdAt`
- `mailboxId`: Z `SendLog.mailboxId`
- `messageId`: Z `SendLog.messageId`

---

## ✅ EFEKT

Po odtworzeniu rekordów:
- ✅ **MaterialResponse są widoczne** w sekcji "Historia wysłanych"
- ✅ **Pełna historia** automatycznych odpowiedzi jest dostępna
- ✅ **Dane są zgodne** z SendLog (oryginalne maile)

---

## 🔧 SKRYPT

Skrypt: `scripts/recreate-material-responses-311.ts`

**Logika:**
1. Znajduje wszystkie odpowiedzi INTERESTED z 3.11.2025
2. Dla każdej odpowiedzi, znajduje mail wysłany PO odpowiedzi (w ciągu 2 godzin)
3. Szuka maili zawierających "załączeniu przesyłam katalog" w treści
4. Tworzy MaterialResponse dla znalezionych maili

**Uruchomienie:**
```bash
npx tsx scripts/recreate-material-responses-311.ts
```

---

## 📝 UWAGI

- **Duplikaty:** Skrypt sprawdza czy MaterialResponse już istnieje dla danego `replyId`
- **Bezpieczeństwo:** Skrypt nie modyfikuje istniejących rekordów
- **Dokładność:** Dane są kopiowane z SendLog (oryginalne maile)

---

## ✅ STATUS

**Gotowe!** MaterialResponse dla maili z 3.11.2025 są teraz widoczne w interfejsie "Historia wysłanych".

