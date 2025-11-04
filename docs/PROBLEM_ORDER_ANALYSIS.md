# Problem: Utrata kolejności priorytetów przy przekładaniu maili

## 🔍 Problem

Gdy przekładam maile na jutro (zbyt stare lub poza oknem), tracę kolejność zgodną z priorytetami leadów.

### Przykład problemu:

```
Kolejność leadów (priority):
1. Lead A (priority 1) - scheduledAt = 10:03:00
2. Lead B (priority 2) - scheduledAt = 10:06:00
3. Lead C (priority 3) - scheduledAt = 10:09:00
4. Lead D (priority 4) - scheduledAt = 10:12:00

System restart o 10:10:00 (Lead A jest zbyt stary >5 min)

OBECNE ZACHOWANIE:
- Lead A → przekładany na jutro 9:00
- Lead B → wysyłany teraz (10:10:00) ✅
- Lead C → wysyłany o 10:13:00 ✅
- Lead D → wysyłany o 10:16:00 ✅

JUTRO:
- Lead A → wysyłany o 9:00 ✅
- Lead E (priority 5) → może być zaplanowany na 9:03:00 (przed Lead A!)

PROBLEM: Lead E (priority 5) może być wysłany przed Lead A (priority 1)!
```

## 🎯 Dlaczego to się dzieje?

1. **W `getNextEmailForCampaign`** sortuję tylko po `scheduledAt: 'asc'` - nie uwzględniam priorytetu
2. **Gdy przekładam na jutro** - wszystkie maile dostają ten sam `scheduledAt = jutro 9:00`
3. **Priorytet nie jest uwzględniany** w sortowaniu w `getNextEmailForCampaign`

## ✅ Rozwiązanie

### Opcja 1: Uwzględnić priorytet w sortowaniu (RECOMMENDED)

```typescript
orderBy: [
  { scheduledAt: 'asc' },      // Najpierw po czasie
  { campaignLead: { priority: 'asc' } } // Potem po priorytecie
]
```

**Plusy:**
- Zachowuje kolejność priorytetów
- Proste rozwiązanie
- Nie wymaga zmian w logice przekładania

**Minusy:**
- Wymaga join przez campaignLead (już jest w include)

### Opcja 2: Przekładać wszystkie przeterminowane maile razem

Zamiast przekładać każdy mail osobno, przekładaj wszystkie przeterminowane maile w jednej operacji, zachowując kolejność priorytetów.

**Plusy:**
- Zachowuje pełną kolejność
- Wszystkie przeterminowane maile razem na jutro

**Minusy:**
- Wymaga dodatkowej logiki
- Trudniejsze w implementacji

### Opcja 3: Zaplanować na "teraz + delay" zamiast jutro

Zamiast przekładać na jutro, zaplanować na najbliższy dostępny czas (teraz + delayBetweenEmails), jeśli w oknie czasowym.

**Plusy:**
- Nie traci kolejności
- Szybciej wysyła

**Minusy:**
- Może wysłać zbyt szybko (ignoruje delayBetweenEmails)
- Nie rozwiązuje problemu gdy poza oknem czasowym

## 🎯 Rekomendacja: Opcja 1

Najprostsze i najskuteczniejsze rozwiązanie - dodać sortowanie po priorytecie w `getNextEmailForCampaign`.

