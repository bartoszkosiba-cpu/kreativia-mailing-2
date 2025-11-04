# 📎 Nazwa materiału i Kolejność - Objaśnienie

## 1️⃣ **Nazwa materiału** * (wymagane)

### Co to jest?
**Wyświetlana nazwa** materiału - jak będzie się nazywał dla Ciebie i dla leada.

### Co wpisać?
**Przykłady:**
- `Katalog podwieszeń targowych 2025`
- `Cennik mebli biurowych`
- `Katalog produktów`
- `Broszura informacyjna`

### Na co wpływa?

#### ✅ **1. W treści maila wysyłanego do leada**

AI używa nazwy w generowanej odpowiedzi:

**Przykład (3 materiały):**
```
Dzień dobry Panie Janie,

Dziękuję za zainteresowanie!

Załączam materiały:
1. Katalog podwieszeń targowych 2025 - link do pobrania: https://...
2. Cennik podwieszeń targowych (załącznik: cennik.pdf)
3. Instrukcja montażu (załącznik: instrukcja.pdf)

Pozdrawiam
```

**Widzisz?** Nazwy materiałów pojawiają się w mailu! ✅

#### ✅ **2. Nazwa załącznika w mailu**

Dla załączników - jeśli nie podasz `fileName`, nazwa materiału będzie użyta jako nazwa pliku:

- **Nazwa materiału:** `Cennik podwieszeń`
- **Nazwa pliku (nie podana)** → użyje: `Cennik podwieszeń.pdf`
- **Nazwa pliku (podana):** `cennik-2025.pdf` → użyje tej nazwy

#### ✅ **3. Wyświetlanie w interfejsie**

Na liście materiałów zobaczysz nazwę:

```
[Katalog podwieszeń targowych 2025]  🔗 Link
[Cennik podwieszeń targowych]       📎 Załącznik
```

#### ✅ **4. Dla linków - etykieta przy URL**

W mailu link będzie wyglądał tak:
```
Katalog podwieszeń targowych 2025: https://example.com/katalog.pdf
```

**Nazwa** = etykieta przy linku

---

## 2️⃣ **Kolejność**

### Co to jest?
**Numer kolejności** - określa w jakiej kolejności materiały będą:
- Wyświetlane na liście
- Wysyłane w mailu
- Wymieniane w treści odpowiedzi AI

### Co wpisać?
**Liczba** - domyślnie: `0`

**Zakres:** Dowolna liczba (może być ujemna, np. -1, 0, 1, 2, 100)

**Kolejność sortowania:** Rosnąco (0, 1, 2, 3...)

### Na co wpływa?

#### ✅ **1. Kolejność wyświetlania w interfejsie**

Materiały są sortowane według kolejności:

**Przykład:**
- Materiał 1: Kolejność = `0` → Pojawi się pierwszy
- Materiał 2: Kolejność = `1` → Pojawi się drugi  
- Materiał 3: Kolejność = `2` → Pojawi się trzeci

#### ✅ **2. Kolejność w treści maila**

AI wymienia materiały w kolejności:

**Przykład:**

Materiały:
1. Katalog (kolejność: 0)
2. Cennik (kolejność: 1)
3. Instrukcja (kolejność: 2)

**Treść maila:**
```
Załączam materiały:
1. Katalog podwieszeń targowych 2025 - link do pobrania: https://...
2. Cennik podwieszeń targowych (załącznik: cennik.pdf)
3. Instrukcja montażu (załącznik: instrukcja.pdf)
```

**Widzisz?** Numeracja i kolejność zgodna z ustawioną kolejnością! ✅

#### ✅ **3. Kolejność załączników w mailu**

Załączniki są dodawane do maila w kolejności:

- Najpierw: Materiał z kolejnością 0
- Potem: Materiał z kolejnością 1
- Na końcu: Materiał z kolejnością 2

**To ważne** jeśli chcesz żeby lead otwierał materiały w określonej kolejności!

---

## 📝 Przykłady użycia

### Przykład 1: Podstawowa kolejność

```
Nazwa: "Katalog podwieszeń 2025"
Kolejność: 0

Nazwa: "Cennik podwieszeń"
Kolejność: 1

Nazwa: "Instrukcja montażu"
Kolejność: 2
```

**Efekt w mailu:**
```
Załączam materiały:
1. Katalog podwieszeń 2025
2. Cennik podwieszeń
3. Instrukcja montażu
```

### Przykład 2: Zmiana kolejności

Chcesz żeby cennik był pierwszy:

```
Nazwa: "Cennik podwieszeń"
Kolejność: 0  ← Zmienione z 1 na 0

Nazwa: "Katalog podwieszeń 2025"
Kolejność: 1  ← Zmienione z 0 na 1
```

**Efekt:**
```
Załączam materiały:
1. Cennik podwieszeń  ← Teraz pierwszy!
2. Katalog podwieszeń 2025
```

### Przykład 3: Nazwa wpływa na odbiór

**Dobra nazwa:**
```
Nazwa: "Katalog podwieszeń targowych 2025"
```
→ Lead wie dokładnie co dostanie ✅

**Zła nazwa:**
```
Nazwa: "Plik1"
```
→ Lead nie wie co to jest ❌

---

## ⚠️ **Najważniejsze zasady**

### Nazwa materiału:
1. **Opisowa** - lead powinien wiedzieć co to jest
2. **Zawiera rok** - jeśli dotyczy (np. "2025")
3. **Zawiera typ** - jeśli ważne (np. "Katalog", "Cennik")
4. **Brak skrótów** - nie "Kat-2025", lepiej "Katalog 2025"

### Kolejność:
1. **Zaczynaj od 0** - pierwszy materiał = 0
2. **Rosnąco** - 0, 1, 2, 3...
3. **Zostaw przerwy** - 0, 5, 10 (łatwiej wstawić coś między)
4. **Możesz zmieniać** - edytuj i zmień kolejność gdy potrzeba

---

## 💡 **Praktyczne wskazówki**

### Kiedy zmienić kolejność?
- **Gdy chcesz pokazać najważniejszy materiał pierwszy**
  - Np. Cennik powinien być przed katalogiem → ustaw kolejność 0

- **Gdy dodajesz nowy materiał**
  - Ustaw kolejność wyższą niż ostatni (np. jeśli ostatni to 5, ustaw 6)

### Jakie nazwy używać?
✅ **DOBRE:**
- "Katalog podwieszeń targowych 2025"
- "Cennik mebli biurowych"
- "Broszura informacyjna - Sezon 2025"

❌ **ZŁE:**
- "Plik"
- "Materiał"
- "Dokument1"

**Dlaczego?** Lead dostanie maila i zobaczy listę materiałów - nazwa powinna być czytelna!

---

Gotowe! Teraz wiesz na co wpływa każda pozycja! 🎯


