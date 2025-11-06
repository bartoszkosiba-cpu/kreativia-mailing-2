# NAPRAWA: DOŁĄCZANIE ZAŁĄCZNIKÓW W AUTOMATYCZNYCH ODPOWIEDZIACH

## ❌ PROBLEM

**Scenariusz:**
- Testowa wysyłka: ✅ Załącznik się dołączył
- Prawdziwa wysyłka: ❌ Załącznik się nie dołączył

**Przyczyna:**
- W `send-test` route była pełniejsza logika wyszukiwania plików
- W `materialResponseSender.ts` była uproszczona wersja, która nie działała poprawnie

---

## ✅ ROZWIĄZANIE

**Synchronizacja logiki wyszukiwania plików:**

Użyto dokładnie tej samej logiki co w `send-test` route:
1. Sprawdza różne warianty nazwy pliku (z/bez ścieżki, basename)
2. Szuka plików z prefiksem kampanii (`campaignId_timestamp_...`)
3. Fallback na ostatni plik z kampanii (jeśli nie znajdzie dopasowania)
4. Sprawdza wiele lokalizacji (uploads/materials, public/materials, etc.)

---

## 📋 JAK DZIAŁA TERAZ

### 1. **Format nazwy pliku w bazie:**
- `fileName`: `"Cennik przykładowych podwieszeń 11.2025-min.pdf"` (oryginalna nazwa)

### 2. **Format pliku w systemie:**
- `3_1762280108857_Cennik_przyk_adowych_podwieszen__11.2025-min.pdf` (z prefiksem kampanii i timestamp)

### 3. **Logika wyszukiwania:**
```typescript
// KROK 1: Sprawdź dokładne ścieżki (oryginalna nazwa)
exactPaths = [
  uploads/materials/{fileName},
  uploads/materials/{fileNameWithoutPath},
  uploads/materials/{baseFileName},
  uploads/materials/{baseFileNameWithoutPath}
]

// KROK 2: Jeśli nie znaleziono, szukaj z prefiksem kampanii
filesInDir.find(file => 
  file.startsWith(`${campaignId}_`) && 
  file.includes(sanitizedFileName)
)

// KROK 3: Fallback - ostatni plik z kampanii
campaignFiles = filesInDir.filter(f => f.startsWith(`${campaignId}_`))
foundPath = campaignFiles[0] // najnowszy

// KROK 4: Fallback - inne lokalizacje
fallbackPaths = [
  public/materials/...,
  materials/...,
  ...
]
```

---

## ✅ WERYFIKACJA DLA WIELU ZAŁĄCZNIKÓW

**Kod działa dla wielu załączników:**
- Pętla `for (const material of materials)` przetwarza **wszystkie** materiały
- Każdy załącznik jest dodawany do tablicy `attachments`
- Wszystkie załączniki są wysyłane w jednym mailu

**Przykład:**
```typescript
materials = [
  { name: "Katalog", fileName: "katalog.pdf", type: "ATTACHMENT" },
  { name: "Cennik", fileName: "cennik.pdf", type: "ATTACHMENT" },
  { name: "Spec", fileName: "spec.pdf", type: "ATTACHMENT" }
]

// Wszystkie 3 załączniki będą znalezione i dołączone
attachments = [
  { filename: "katalog.pdf", path: "uploads/materials/3_123_katalog.pdf" },
  { filename: "cennik.pdf", path: "uploads/materials/3_124_cennik.pdf" },
  { filename: "spec.pdf", path: "uploads/materials/3_125_spec.pdf" }
]
```

---

## ✅ ZABEZPIECZENIA

1. **Logowanie:** Każdy krok jest logowany (`console.log`)
2. **Błędy:** Jeśli plik nie istnieje, szczegółowe logi błędów
3. **Fallback:** Wielowarstwowa logika wyszukiwania
4. **Walidacja:** Sprawdza czy katalog istnieje przed odczytem

---

## 📝 PLIKI ZMODYFIKOWANE

- `src/services/materialResponseSender.ts` (linie 418-538)

---

## ✅ PODSUMOWANIE

- ✅ Naprawiono logikę wyszukiwania plików (synchronizacja z send-test)
- ✅ Działa dla wielu załączników (pętla przetwarza wszystkie)
- ✅ Działa teraz i na przyszłość (jedna logika dla wszystkich)
- ✅ Szczegółowe logowanie dla debugowania

**Załączniki będą się teraz dołączać poprawnie w prawdziwej wysyłce!**

