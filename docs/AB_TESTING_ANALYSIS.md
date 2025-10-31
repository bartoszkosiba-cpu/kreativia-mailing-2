# Analiza implementacji A/B testów w kampaniach

## Cel
Dodanie możliwości testowania dwóch wariantów treści kampanii (A i B) w celu porównania skuteczności.

## Obecna struktura

### Baza danych (`Campaign`)
- `subject: String?` - Temat maila
- `text: String?` - Tekst kampanii
- `jobDescription: String?` - Opis stanowiska
- `postscript: String?` - PS. na końcu
- `linkText: String?` - Tekst linku
- `linkUrl: String?` - URL linku

### Proces wysyłki (`scheduledSender.ts`)
1. Pobiera kampanię z bazy
2. Dla każdego leada konstruuje treść maila używając pól kampanii
3. Wywołuje `sendCampaignEmail()` z `subject` i `content`
4. Zapisuje do `SendLog` z `campaignId`, `leadId`, `subject`, `content`

### Mierzenie skuteczności
- `InboxReply` zawiera `campaignId`, `classification` (INTERESTED, NOT_INTERESTED, etc.)
- Można porównać liczbę odpowiedzi między wariantami

## Propozycja implementacji

### Opcja 1: Prosta (jedna kampania z polami A/B)

**Zmiany w bazie:**
```prisma
model Campaign {
  // ... istniejące pola ...
  
  // A/B Testing
  abTestEnabled        Boolean  @default(false)
  abTestVariantMode   String?  // "alternating" | "random" | "50_50"
  
  // Wariant A (główny, istniejące pola)
  subject              String?  // Wariant A
  text                 String?  // Wariant A
  jobDescription       String?  // Wariant A
  postscript           String?  // Wariant A
  linkText             String?  // Wariant A
  linkUrl              String?  // Wariant A
  
  // Wariant B
  subjectB             String?
  textB                String?
  jobDescriptionB      String?
  postscriptB           String?
  linkTextB             String?
  linkUrlB              String?
}
```

**Zmiany w kodzie:**
1. W `scheduledSender.ts` - logika wyboru wariantu
2. W `SendLog` - zapis użytego wariantu

**Zalety:**
- Prosta implementacja
- Wszystko w jednej tabeli
- Łatwa migracja istniejących kampanii

**Wady:**
- Duplikacja pól w bazie
- Trudne rozszerzenie na więcej wariantów (C, D...)

### Opcja 2: Zaawansowana (osobna tabela wariantów)

**Zmiany w bazie:**
```prisma
model Campaign {
  // ... istniejące pola ...
  abTestEnabled    Boolean  @default(false)
  abTestMode       String?  // "alternating" | "random" | "50_50"
  variants         CampaignVariant[]
}

model CampaignVariant {
  id            Int      @id @default(autoincrement())
  campaignId    Int
  variantLetter String  // "A" | "B"
  subject       String?
  text          String?
  jobDescription String?
  postscript    String?
  linkText      String?
  linkUrl       String?
  isActive      Boolean  @default(true)
  
  campaign Campaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  
  @@unique([campaignId, variantLetter])
}

model SendLog {
  // ... istniejące pola ...
  variantLetter String? // "A" | "B" - który wariant został użyty
}
```

**Zalety:**
- Elastyczna struktura
- Łatwe rozszerzenie na więcej wariantów
- Lepsza normalizacja danych

**Wady:**
- Bardziej złożona implementacja
- Wymaga migracji istniejących danych
- Więcej JOIN-ów w zapytaniach

## Metody rozdziału wariantów

### 1. Alternating (ABABAB)
- Kolejność: A, B, A, B, A, B...
- Prosta implementacja: `variant = (index % 2 === 0) ? 'A' : 'B'`
- ✅ Równomierny rozdział (50/50)
- ✅ Deterministic (spójny dla tego samego leada przy restartach)
- ⚠️ Możliwe bias przy sortowaniu leadów (np. alfabetycznie)

### 2. Random (50/50)
- Losowy wybór z prawdopodobieństwem 50%
- `variant = Math.random() < 0.5 ? 'A' : 'B'`
- ✅ Równomierny rozdział (statystycznie)
- ⚠️ Może być nierównomierny dla małych próbek
- ⚠️ Nie-deterministic (lead może dostać inny wariant po restarcie)

### 3. Hash-based (deterministic random)
- Używa hash z `leadId` + `campaignId`
- `variant = (hash(leadId + campaignId) % 2 === 0) ? 'A' : 'B'`
- ✅ Deterministic (zawsze ten sam wariant dla leada)
- ✅ Statystycznie 50/50
- ✅ Niezależny od kolejności leadów

**REKOMENDACJA:** Hash-based (opcja 3)

## Mierzenie skuteczności

### Metryki do porównania:
1. **Response Rate** - % leadów które odpowiedziały
2. **Interested Rate** - % leadów z klasyfikacją INTERESTED
3. **Open Rate** - jeśli tracking (trudniejsze bez pixeli)
4. **Conversion Rate** - % leadów które przeszły do następnego etapu

### Zapytanie SQL:
```sql
SELECT 
  sl.variantLetter,
  COUNT(DISTINCT sl.leadId) as totalSent,
  COUNT(DISTINCT ir.id) as totalReplied,
  COUNT(DISTINCT CASE WHEN ir.classification = 'INTERESTED' THEN ir.id END) as totalInterested,
  ROUND(100.0 * COUNT(DISTINCT ir.id) / COUNT(DISTINCT sl.leadId), 2) as responseRate,
  ROUND(100.0 * COUNT(DISTINCT CASE WHEN ir.classification = 'INTERESTED' THEN ir.id END) / COUNT(DISTINCT sl.leadId), 2) as interestedRate
FROM SendLog sl
LEFT JOIN InboxReply ir ON ir.leadId = sl.leadId AND ir.campaignId = sl.campaignId
WHERE sl.campaignId = ?
  AND sl.variantLetter IN ('A', 'B')
  AND sl.status = 'sent'
GROUP BY sl.variantLetter;
```

## Komplikacje i wyzwania

### 1. **Backward compatibility**
- Istniejące kampanie mają tylko wariant A
- Musimy upewnić się, że działają normalnie gdy `abTestEnabled = false`
- ✅ Rozwiązanie: Domyślnie `abTestEnabled = false`, używa istniejących pól

### 2. **Follow-upy**
- Follow-up powinien używać tego samego wariantu co initial email?
- ✅ Rozwiązanie: Zapisz `variantLetter` w `CampaignLead`, użyj tego samego dla follow-upów

### 3. **Edytowanie kampanii**
- Jeśli ktoś zmieni treść w trakcie wysyłki, może popsuć test
- ⚠️ Rozwiązanie: Zablokować edycję wariantów gdy kampania `IN_PROGRESS`

### 4. **Statystyki w UI**
- Gdzie pokazać porównanie A vs B?
- ✅ Rozwiązanie: Nowa sekcja w szczegółach kampanii z wykresami

### 5. **Wielkość próbki**
- Potrzebne minimum ~100-200 maili na wariant dla statystycznej istotności
- ⚠️ Rozwiązanie: Informacja w UI "Za mało danych, kontynuuj test"

### 6. **Migracja istniejących danych**
- Istniejące `SendLog` nie mają `variantLetter`
- ✅ Rozwiązanie: Domyślnie `variantLetter = 'A'` dla starych rekordów

## Rekomendacja końcowa

### **Opcja 1 (Prosta)** jest lepsza dla startu:
- ✅ Szybka implementacja (2-3 godziny pracy)
- ✅ Mało zmian w kodzie
- ✅ Łatwa do zrozumienia
- ✅ Wystarczająca dla 2 wariantów

### Implementacja krok po kroku:

1. **Migracja bazy:**
   - Dodaj pola `abTestEnabled`, `abTestMode`, `subjectB`, `textB`, `jobDescriptionB`, `postscriptB`, `linkTextB`, `linkUrlB` do `Campaign`
   - Dodaj `variantLetter` do `SendLog`

2. **UI kampanii:**
   - Checkbox "Włącz A/B test"
   - Drugi zestaw pól (Wariant B) który pokazuje się gdy test włączony
   - Select: "Rozdział wariantów" (Alternating / Random / Hash-based)

3. **Logika wysyłki (`scheduledSender.ts`):**
   ```typescript
   function selectVariant(campaign: Campaign, leadId: number, index: number): 'A' | 'B' {
     if (!campaign.abTestEnabled) return 'A';
     
     switch (campaign.abTestMode) {
       case 'alternating':
         return index % 2 === 0 ? 'A' : 'B';
       case 'random':
         return Math.random() < 0.5 ? 'A' : 'B';
       case 'hash':
       default:
         // Hash-based deterministic
         const hash = simpleHash(leadId + campaign.id);
         return hash % 2 === 0 ? 'A' : 'B';
     }
   }
   ```

4. **Zapisywanie wariantu:**
   - W `SendLog` zapisz `variantLetter`
   - Użyj odpowiednich pól kampanii (A lub B) do konstrukcji maila

5. **Panel statystyk:**
   - Nowa sekcja w szczegółach kampanii
   - Porównanie A vs B (response rate, interested rate)
   - Wykres słupkowy lub tabela

## Czy jest warte implementowania?

### ✅ **TAK, jeśli:**
- Testujesz różne message'owe
- Masz wystarczająco dużo leadów (min. 100 na wariant)
- Chcesz optymalizować response rate
- Masz czas na analizę wyników

### ❌ **NIE, jeśli:**
- Małe kampanie (< 50 leadów)
- Rzadko uruchamiasz kampanie
- Nie masz czasu na analizę wyników
- Preferujesz jedną sprawdzoną treść

## Szacowany czas implementacji

- **Minimum (funkcjonalne):** 3-4 godziny
  - Migracja bazy + podstawowa logika
- **Kompletne (z UI i statystykami):** 6-8 godziny
  - + UI do edycji wariantów
  - + Panel statystyk A/B

## Następne kroki (jeśli zaimplementujemy)

1. Migracja bazy danych
2. Logika wyboru wariantu
3. UI do edycji kampanii
4. Panel statystyk
5. Testy na małej grupie leadów



