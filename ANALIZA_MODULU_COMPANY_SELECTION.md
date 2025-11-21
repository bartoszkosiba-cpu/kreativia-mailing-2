# Analiza modułu Company Selection

## 📋 Przegląd modułu

Moduł `company-selection` jest rozbudowanym systemem do:
- Importu i zarządzania firmami
- Klasyfikacji firm przez AI
- Tworzenia selekcji firm na podstawie filtrów
- Weryfikacji person w firmach
- Zarządzania kryteriami weryfikacji

## 🐛 Znalezione błędy

### 1. **Duplikacja linków w głównej stronie** ⚠️
**Plik:** `app/company-selection/page.tsx` (linie 150-175)

**Problem:** Dwa identyczne linki prowadzące do `/company-selection/import-mass`:
- Linia 151: "Import CSV"
- Linia 164: "Masowy import CSV"

**Rozwiązanie:** Usunąć jeden z linków lub zmienić jeden na `/company-selection/import`

```tsx
// PRZED:
<Link href="/company-selection/import-mass">Import CSV</Link>
<Link href="/company-selection/import-mass">Masowy import CSV</Link>

// PO:
<Link href="/company-selection/import">Import CSV</Link>
<Link href="/company-selection/import-mass">Masowy import CSV</Link>
```

### 2. **Nadmierne użycie console.log/error** ⚠️
**Pliki:** Wszystkie pliki w module

**Problem:** Znaleziono 117 wystąpień `console.log/error/warn` zamiast użycia dedykowanego loggera

**Przykłady:**
- `app/company-selection/verify-personas/[selectionId]/page.tsx` - 20+ wystąpień
- `app/company-selection/classify/page.tsx` - 15+ wystąpień
- `app/company-selection/selections/page.tsx` - kilka wystąpień

**Rozwiązanie:** Zastąpić wszystkie `console.*` przez `logger` z `@/services/logger`

### 3. **Brak obsługi błędów w loadStats** ⚠️
**Plik:** `app/company-selection/page.tsx` (linie 48-80)

**Problem:** Błędy są tylko logowane, użytkownik nie widzi komunikatu

```tsx
// PRZED:
catch (error) {
  console.error("Błąd ładowania statystyk:", error);
}

// PO:
catch (error) {
  console.error("Błąd ładowania statystyk:", error);
  // Dodać stan błędu i wyświetlić komunikat użytkownikowi
  setStatsError("Nie udało się załadować statystyk");
}
```

### 4. **Potencjalny problem z wydajnością - wielokrotne zapytania** ⚠️
**Plik:** `app/company-selection/page.tsx` (linie 48-66)

**Problem:** 5 równoległych zapytań do API tylko po to, aby pobrać `pagination.total`

**Rozwiązanie:** Utworzyć dedykowany endpoint `/api/company-selection/stats` zwracający wszystkie statystyki w jednym zapytaniu

### 5. **Brak walidacji w handlePreview** ⚠️
**Plik:** `app/company-selection/selections/page.tsx` (linie 571-618)

**Problem:** Brak walidacji przed wywołaniem API (np. czy wybrano specjalizacje)

**Rozwiązanie:** Dodać walidację przed wywołaniem:

```tsx
if (selectedSubSegments.length === 0) {
  setFormError("Wybierz przynajmniej jedną specjalizację");
  return;
}
```

### 6. **Użycie `any` w typach** ⚠️
**Plik:** `app/company-selection/page.tsx` (linia 482)

**Problem:** 
```tsx
const [companies, setCompanies] = useState<any[]>([]);
```

**Rozwiązanie:** Utworzyć właściwy typ `CompanyPreview`

### 7. **Brak obsługi timeout w długich operacjach** ⚠️
**Plik:** `app/company-selection/selections/page.tsx`

**Problem:** Długie operacje (np. `handlePreview`) mogą wisieć bez limitu czasu

**Rozwiązanie:** Dodać timeout i AbortController

### 8. **Duplikacja kodu paginacji** ⚠️
**Plik:** `app/company-selection/selections/page.tsx` i `app/company-selection/components/PreviewTable.tsx`

**Problem:** Funkcja `buildPageList` jest zduplikowana w dwóch miejscach

**Rozwiązanie:** Wyekstrahować do wspólnego utility

## 💡 Możliwości ulepszeń

### 1. **Optymalizacja zapytań API** 🚀

**Problem:** W `app/company-selection/selections/page.tsx` (linie 384-526) jest useEffect, który wykonuje zapytanie przy każdej zmianie filtrów, nawet gdy użytkownik jeszcze nie skończył wybierać.

**Rozwiązanie:** Zwiększyć debounce z 350ms do 500-800ms lub dodać przycisk "Zastosuj filtry"

### 2. **Lepsze komunikaty błędów dla użytkownika** 🎨

**Problem:** Wiele błędów jest tylko logowanych, użytkownik nie widzi co się stało

**Rozwiązanie:** 
- Dodać toast notifications
- Wyświetlać komunikaty błędów w UI
- Dodać retry buttons

### 3. **Loading states** 🎨

**Problem:** Niektóre operacje nie mają wizualnych wskaźników ładowania

**Przykład:** `loadSelectionsList` w `selections/page.tsx` - użytkownik nie wie, że trwa odświeżanie

**Rozwiązanie:** Dodać skeleton loaders lub spinners

### 4. **Optymalizacja re-renderów** ⚡

**Problem:** W `selections/page.tsx` jest wiele useState, które mogą powodować niepotrzebne re-rendery

**Rozwiązanie:** 
- Użyć `useReducer` dla powiązanych stanów
- Dodać `React.memo` dla ciężkich komponentów
- Użyć `useMemo` i `useCallback` tam gdzie potrzeba

### 5. **Accessibility (a11y)** ♿

**Problem:** 
- Brak `aria-labels` na niektórych przyciskach
- Brak obsługi klawiatury w niektórych miejscach
- Brak focus management

**Rozwiązanie:** Dodać właściwe atrybuty ARIA i obsługę klawiatury

### 6. **TypeScript - lepsze typy** 📘

**Problem:** 
- Użycie `any` w kilku miejscach
- Brak typów dla niektórych odpowiedzi API
- Niektóre typy są zbyt szerokie

**Rozwiązanie:** 
- Utworzyć wspólne typy w `types/company-selection.ts`
- Użyć `zod` do walidacji odpowiedzi API
- Usunąć wszystkie `any`

### 7. **Refaktoryzacja długich komponentów** 🔧

**Problem:** 
- `app/company-selection/selections/page.tsx` - 1603 linie
- `app/company-selection/verify-personas/[selectionId]/page.tsx` - 4889 linii

**Rozwiązanie:** 
- Podzielić na mniejsze komponenty
- Wyekstrahować logikę do custom hooks
- Utworzyć osobne pliki dla różnych sekcji

### 8. **Caching i optymalizacja** ⚡

**Problem:** 
- Dane są pobierane za każdym razem od nowa
- Brak cache dla statycznych danych (np. specjalizacje)

**Rozwiązanie:** 
- Dodać React Query lub SWR
- Cache dla danych, które rzadko się zmieniają
- Stale-while-revalidate pattern

### 9. **Lepsze zarządzanie stanem formularza** 📝

**Problem:** W `selections/page.tsx` jest wiele niezależnych useState dla formularza

**Rozwiązanie:** Użyć biblioteki typu `react-hook-form` lub `formik`

### 10. **Testy** 🧪

**Problem:** Brak widocznych testów w module

**Rozwiązanie:** 
- Dodać unit testy dla utility functions
- Dodać integration testy dla API routes
- Dodać E2E testy dla głównych flow

### 11. **Dokumentacja** 📚

**Problem:** Brak dokumentacji inline dla złożonych funkcji

**Rozwiązanie:** Dodać JSDoc comments dla:
- Funkcji budujących filtry
- Funkcji weryfikacji
- Złożonych algorytmów

### 12. **Error boundaries** 🛡️

**Problem:** Brak error boundaries - błąd w jednym komponencie może zepsuć całą stronę

**Rozwiązanie:** Dodać React Error Boundaries w kluczowych miejscach

### 13. **Optymalizacja bundle size** 📦

**Problem:** Duże komponenty mogą powodować duży bundle

**Rozwiązanie:** 
- Code splitting dla dużych komponentów
- Lazy loading dla rzadko używanych sekcji
- Tree shaking dla nieużywanych importów

### 14. **Lepsze UX dla długich operacji** ⏱️

**Problem:** Długie operacje (np. klasyfikacja wielu firm) mogą trwać długo bez feedbacku

**Rozwiązanie:** 
- Dodać progress bars
- Dodać możliwość anulowania
- Pokazywać szacowany czas

### 15. **Walidacja po stronie klienta** ✅

**Problem:** Niektóre walidacje są tylko po stronie serwera

**Rozwiązanie:** Dodać walidację po stronie klienta przed wysłaniem requestu

## 🎯 Priorytety napraw

### Wysoki priorytet (naprawić natychmiast):
1. ✅ Duplikacja linków w `page.tsx`
2. ✅ Brak obsługi błędów w `loadStats`
3. ✅ Walidacja w `handlePreview`
4. ✅ Zastąpienie `console.*` przez logger

### Średni priorytet (naprawić w najbliższym czasie):
1. ⚠️ Optymalizacja zapytań API (endpoint stats)
2. ⚠️ Lepsze komunikaty błędów
3. ⚠️ Loading states
4. ⚠️ Refaktoryzacja długich komponentów

### Niski priorytet (ulepszenia):
1. 📝 Accessibility
2. 📝 Testy
3. 📝 Dokumentacja
4. 📝 Caching

## 📊 Statystyki

- **Plików:** ~25 komponentów + ~51 API routes
- **Linii kodu:** ~15,000+ (szacunkowo)
- **Console.log/error:** 117 wystąpień
- **Użycie `any`:** ~10+ miejsc
- **Najdłuższy komponent:** 4889 linii (`verify-personas/[selectionId]/page.tsx`)

## 🔍 Szczegółowe rekomendacje

### 1. Utworzenie wspólnych typów

```typescript
// types/company-selection.ts
export interface CompanyPreview {
  id: number;
  name: string;
  industry: string | null;
  market: string | null;
  description?: string | null;
  verificationStatus: string | null;
  // ...
}

export interface SelectionFilters {
  specializationCodes?: string[];
  onlyPrimary?: boolean;
  minScore?: number;
  minConfidence?: number;
  languages?: string[];
  importBatchIds?: number[];
}
```

### 2. Utility dla paginacji

```typescript
// utils/pagination.ts
export function buildPageList(total: number, current: number): Array<number | string> {
  // ... istniejąca logika
}
```

### 3. Custom hook dla statystyk

```typescript
// hooks/useCompanyStats.ts
export function useCompanyStats() {
  const [stats, setStats] = useState<CompanyStats>({...});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    // logika ładowania
  }, []);
  
  return { stats, loading, error, refetch };
}
```

## ✅ Podsumowanie

Moduł jest funkcjonalny, ale wymaga:
- **Refaktoryzacji** długich komponentów
- **Optymalizacji** zapytań i wydajności
- **Ulepszenia** obsługi błędów
- **Dodania** testów i dokumentacji
- **Poprawy** TypeScript types

Większość problemów to kwestie jakości kodu i UX, a nie krytyczne błędy funkcjonalne.

