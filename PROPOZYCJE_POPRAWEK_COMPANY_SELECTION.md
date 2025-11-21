# Propozycje poprawek dla modułu Company Selection

## ✅ Wykonane (commit d421673)
- ✅ Naprawiono duplikację linków
- ✅ Dodano obsługę błędów w loadStats
- ✅ Dodano walidację w handlePreview
- ✅ Poprawiono typ any na CompanyPreview

## 🎯 Proponowane poprawki - priorytet WYSOKI

### 1. Utworzenie endpointu `/api/company-selection/stats` ⚡
**Problem:** 5 równoległych zapytań tylko po to, aby pobrać `pagination.total`

**Rozwiązanie:**
```typescript
// app/api/company-selection/stats/route.ts
export async function GET() {
  const [pending, qualified, rejected, needsReview, total] = await Promise.all([
    db.company.count({ where: { verificationStatus: "PENDING" } }),
    db.company.count({ where: { verificationStatus: "QUALIFIED" } }),
    db.company.count({ where: { verificationStatus: "REJECTED" } }),
    db.company.count({ where: { verificationStatus: "NEEDS_REVIEW" } }),
    db.company.count(),
  ]);
  
  return NextResponse.json({
    pending, qualified, rejected, needsReview, total
  });
}
```

**Korzyści:**
- 1 zapytanie zamiast 5
- Szybsze ładowanie strony
- Mniejsze obciążenie bazy danych

---

### 2. Zastąpienie console.* przez logger 🔧
**Problem:** 117 wystąpień console.log/error/warn

**Rozwiązanie:** Utworzyć skrypt do automatycznej zamiany:
```bash
# Zastąp w plikach company-selection
find app/company-selection -name "*.tsx" -o -name "*.ts" | xargs sed -i '' \
  's/console\.error(/logger.error("company-selection", /g' \
  's/console\.log(/logger.info("company-selection", /g' \
  's/console\.warn(/logger.warn("company-selection", /g'
```

**Lub ręcznie w kluczowych miejscach:**
- `app/company-selection/page.tsx` - 3 wystąpienia
- `app/company-selection/selections/page.tsx` - 3 wystąpienia
- `app/company-selection/verify-personas/[selectionId]/page.tsx` - 20+ wystąpień

---

### 3. Dodanie loading states dla wszystkich operacji 🎨
**Problem:** Niektóre operacje nie mają wizualnych wskaźników

**Przykład poprawki w `selections/page.tsx`:**
```tsx
const loadSelectionsList = async () => {
  try {
    setSelectionsLoading(true);
    // ... istniejący kod
  } finally {
    setSelectionsLoading(false);
  }
};

// W UI:
{selectionsLoading && (
  <div style={{ padding: "1rem", textAlign: "center" }}>
    <span>Odświeżanie listy...</span>
  </div>
)}
```

---

### 4. Utworzenie wspólnego utility dla paginacji 🔧
**Problem:** Funkcja `buildPageList` jest zduplikowana

**Rozwiązanie:**
```typescript
// utils/pagination.ts
export function buildPageList(total: number, current: number): Array<number | string> {
  const pages: Array<number | string> = [];
  if (!Number.isFinite(total) || total <= 0) return [1];
  if (total <= 9) {
    for (let i = 1; i <= total; i++) pages.push(i);
    return pages;
  }
  const add = (p: number | string) => pages.push(p);
  add(1);
  if (current > 4) add("…");
  const start = Math.max(2, current - 2);
  const end = Math.min(total - 1, current + 2);
  for (let i = start; i <= end; i++) add(i);
  if (current < total - 3) add("…");
  add(total);
  return pages;
}
```

**Użycie:**
```tsx
import { buildPageList } from "@/utils/pagination";
```

---

## 🎯 Proponowane poprawki - priorytet ŚREDNI

### 5. Optymalizacja debounce w useEffect ⚡
**Problem:** Debounce 350ms może być za krótki dla szybkiego wpisywania

**Rozwiązanie:**
```tsx
// Zwiększyć do 500-800ms lub dodać przycisk "Zastosuj filtry"
useEffect(() => {
  if (loading) return;
  const debounce = setTimeout(() => {
    setPreviewPage(1);
    void handlePreview();
  }, 600); // Zwiększone z 350ms
  return () => clearTimeout(debounce);
}, [selectedSubSegments, selectedLanguages, selectedBatchIds, onlyPrimary, minScore, minConfidence, market]);
```

---

### 6. Lepsze komunikaty błędów z możliwością retry 🔄
**Problem:** Błędy są tylko wyświetlane, brak możliwości ponowienia

**Rozwiązanie:**
```tsx
{statsError && (
  <div style={{...}}>
    {statsError}
    <button 
      onClick={loadStats}
      style={{ marginLeft: "1rem", padding: "0.5rem 1rem" }}
    >
      Spróbuj ponownie
    </button>
  </div>
)}
```

---

### 7. Utworzenie wspólnych typów TypeScript 📘
**Problem:** Typy są rozproszone, użycie `any`

**Rozwiązanie:**
```typescript
// types/company-selection.ts
export interface CompanyPreview {
  id: number;
  name: string;
  industry: string | null;
  market: string | null;
  description?: string | null;
  activityDescription?: string | null;
  verificationStatus: string | null;
  importBatch?: {
    id: number;
    name: string;
    language: string;
    market: string;
  } | null;
  classifications?: Array<{
    specializationCode: string;
    score: number;
    confidence: number | null;
    isPrimary: boolean;
    reason?: string | null;
  }>;
}

export interface SelectionFilters {
  specializationCodes?: string[];
  onlyPrimary?: boolean;
  minScore?: number;
  minConfidence?: number;
  languages?: string[];
  importBatchIds?: number[];
}

export interface CompanyStats {
  pending: number;
  qualified: number;
  rejected: number;
  needsReview: number;
  total: number;
}
```

---

### 8. Custom hook dla statystyk 🔧
**Problem:** Logika ładowania statystyk jest w komponencie

**Rozwiązanie:**
```typescript
// hooks/useCompanyStats.ts
import { useState, useEffect } from "react";
import { CompanyStats } from "@/types/company-selection";

export function useCompanyStats() {
  const [stats, setStats] = useState<CompanyStats>({
    pending: 0,
    qualified: 0,
    rejected: 0,
    needsReview: 0,
    total: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/company-selection/stats");
      if (!response.ok) throw new Error("Błąd pobierania statystyk");
      const data = await response.json();
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nieznany błąd");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  return { stats, loading, error, refetch: loadStats };
}
```

**Użycie:**
```tsx
const { stats, loading, error, refetch } = useCompanyStats();
```

---

## 🎯 Proponowane poprawki - priorytet NISKI (ulepszenia)

### 9. Accessibility (a11y) ♿
- Dodać `aria-labels` do przycisków bez tekstu
- Dodać `aria-live` dla dynamicznych komunikatów
- Dodać obsługę klawiatury (Enter, Escape)

### 10. Error Boundaries 🛡️
```tsx
// components/ErrorBoundary.tsx
export class CompanySelectionErrorBoundary extends React.Component {
  // ... implementacja
}
```

### 11. Code splitting dla dużych komponentów 📦
```tsx
// Lazy load dla verify-personas
const VerifyPersonasPage = dynamic(() => import('./verify-personas/[selectionId]/page'), {
  loading: () => <div>Ładowanie...</div>
});
```

### 12. Testy jednostkowe 🧪
```typescript
// __tests__/utils/pagination.test.ts
describe('buildPageList', () => {
  it('should return correct pages for small total', () => {
    expect(buildPageList(5, 3)).toEqual([1, 2, 3, 4, 5]);
  });
  // ...
});
```

---

## 📋 Plan implementacji

### Faza 1 (1-2 godziny) - Szybkie poprawki
1. ✅ Endpoint `/api/company-selection/stats`
2. ✅ Custom hook `useCompanyStats`
3. ✅ Utility `buildPageList`
4. ✅ Wspólne typy TypeScript

### Faza 2 (2-3 godziny) - Optymalizacje
5. ✅ Zastąpienie console.* przez logger (kluczowe miejsca)
6. ✅ Loading states
7. ✅ Lepsze komunikaty błędów z retry
8. ✅ Optymalizacja debounce

### Faza 3 (4-6 godzin) - Refaktoryzacja
9. ✅ Podział długich komponentów
10. ✅ Error boundaries
11. ✅ Accessibility
12. ✅ Code splitting

### Faza 4 (opcjonalnie) - Testy i dokumentacja
13. ✅ Testy jednostkowe
14. ✅ Dokumentacja JSDoc
15. ✅ E2E testy

---

## 🚀 Gotowe do implementacji

Wszystkie poprawki są gotowe do implementacji. Zacznijmy od Fazy 1, która da największe korzyści przy najmniejszym wysiłku.

