# 📖 Objaśnienie wszystkich pozycji w "Automatyczne odpowiedzi"

## 🔘 **1. Włącz automatyczne odpowiedzi z materiałami** (Checkbox)

### Co to jest?
**Główny przełącznik** - włącza/wyłącza cały moduł automatycznych odpowiedzi dla tej kampanii.

### Co trzeba zrobić?
- **Zaznacz checkbox** - jeśli chcesz żeby system automatycznie rozpoznawał prośby o materiały i dodawał do kolejki

### Na co wpływa?
- ✅ **Jeśli ZAZNACZONE:**
  - System będzie analizował odpowiedzi INTERESTED
  - Sprawdzi czy lead prosi o materiały
  - Doda do kolejki administratora (wymaga akceptacji)
  - Pokaże sekcję "Materiały do wysyłki" poniżej

- ❌ **Jeśli ODZNACZONE:**
  - System nie sprawdza prośb o materiały
  - Wszystkie odpowiedzi INTERESTED idą normalnie do handlowca
  - Sekcja materiałów jest ukryta

---

## 📝 **2. Kontekst kampanii dla AI**

### Co to jest?
**Opis kampanii** który pomaga AI zrozumieć kontekst i lepiej rozpoznać prośby o materiały.

### Co trzeba wypełnić?
**Przykład:**
```
Oferujemy podwieszenia targowe. W treści maila pytamy: "Czy mogę przesłać katalog i cennik podwieszeń targowych?"
```

**Dobry kontekst zawiera:**
1. **Co oferujesz** - np. "Oferujemy meble biurowe"
2. **Jakie pytanie zadajesz w mailu** - np. "W treści maila pytamy: 'Czy mogę przesłać katalog?'"

### Na co wpływa?
- **Rozpoznawanie prośby przez AI:**
  - AI używa kontekstu do lepszego zrozumienia czy odpowiedź leada to rzeczywiście prośba o materiały
  - Bez kontekstu AI może mieć problem z rozpoznaniem (zwłaszcza jeśli lead pisze nietypowo)
  
- **Przykłady jak kontekst pomaga:**

  **Bez kontekstu:**
  - Lead pisze: "Tak, proszę przesłać więcej informacji"
  - AI: "Może to prośba o materiały? (pewność: 60%)" ❌

  **Z kontekstem:**
  - Lead pisze: "Tak, proszę przesłać więcej informacji"
  - AI: "W mailu pytaliśmy o katalog, więc to prawdopodobnie prośba o katalog (pewność: 85%)" ✅

### Kiedy wypełniać?
- **Zawsze** - jeśli włączasz automatyczne odpowiedzi
- **Szczególnie ważne** jeśli w treści maila jest pytanie o materiały (katalog, cennik, etc.)

---

## 📋 **3. Zasady dla AI (opcjonalnie, JSON)**

### Co to jest?
**Dodatkowe instrukcje** dla AI jak ma generować odpowiedzi - ton, styl, co uwzględnić.

### Co trzeba wypełnić?
**Format JSON** - opcjonalnie, możesz zostawić puste.

**Przykład:**
```json
{
  "tone": "professional",
  "style": "friendly",
  "include": ["greeting", "thank you"]
}
```

**Dostępne opcje:**

| Pole | Możliwe wartości | Co robi |
|------|------------------|---------|
| `tone` | `"professional"`, `"casual"`, `"formal"`, `"warm"` | Określa ton odpowiedzi |
| `style` | `"friendly"`, `"business"`, `"personal"` | Określa styl odpowiedzi |
| `include` | `["greeting", "thank you", "signature"]` | Co AI ma uwzględnić w odpowiedzi |

**Przykłady:**

**1. Profesjonalny i przyjazny:**
```json
{
  "tone": "professional",
  "style": "friendly",
  "include": ["greeting", "thank you"]
}
```
→ "Dzień dobry, dziękujemy za zainteresowanie! Przesyłamy..."

**2. Formalny biznesowy:**
```json
{
  "tone": "formal",
  "style": "business",
  "include": ["greeting", "signature"]
}
```
→ "Szanowny Panie, uprzejmie przesyłamy..."

**3. Ciepły i osobisty:**
```json
{
  "tone": "warm",
  "style": "personal",
  "include": ["thank you"]
}
```
→ "Bardzo dziękujemy! Oto materiały..."

### Na co wpływa?
- **Generowanie odpowiedzi AI:**
  - Gdy lead prosi o materiały → AI generuje odpowiedź
  - Zasady określają JAK wygląda ta odpowiedź (ton, styl)
  - Bez zasad → AI używa domyślnego stylu

**Przykład różnicy:**

**Bez zasad:**
```
Dzień dobry,
W załączniku przesyłam katalog.
Pozdrawiam
```

**Z zasadami (tone: "warm", style: "personal"):**
```
Dzień dobry Panie Janie,
Bardzo dziękuję za zainteresowanie! Z przyjemnością przesyłam katalog, który przygotowaliśmy specjalnie dla Ciebie.
Pozdrawiam serdecznie
```

### Kiedy wypełniać?
- **Opcjonalnie** - możesz zostawić puste
- **Wypełnij jeśli chcesz:**
  - Konkretny ton odpowiedzi
  - Specjalny styl komunikacji
  - Spójność z marką/firmą

---

## ⏱️ **4. Opóźnienie wysyłki (minuty)**

### Co to jest?
**Czas oczekiwania** między wykryciem prośby o materiały a faktyczną wysyłką.

### Co trzeba wypełnić?
**Liczba minut** - domyślnie: **15 minut**

**Zakres:** 1-1440 minut (1 minuta do 24 godzin)

### Na co wpływa?
- **Kiedy materiały zostaną wysłane:**

**Przykład:**
- Lead pisze: "Tak, proszę przesłać katalog" → **10:00**
- System wykrywa prośbę → **10:00**
- Administrator zatwierdza → **10:05**
- Materiały zostaną wysłane → **10:20** (10:05 + 15 min)

### Dlaczego opóźnienie?
1. **Nie wygląda automatycznie** - lead nie pomyśli że to bot
2. **Daje czas na ręczną interwencję** - jeśli potrzeba
3. **Lepsze wrażenie** - wygląda jak ręczna odpowiedź

### Kiedy zmieniać?
- **Zwiększ opóźnienie** jeśli:
  - Chcesz więcej czasu na ręczną kontrolę
  - Chcesz żeby wyglądało bardziej "ludzko"
  
- **Zmniejsz opóźnienie** jeśli:
  - Chcesz szybką odpowiedź
  - Ufasz AI i nie potrzebujesz kontroli

**Zalecane wartości:**
- 15 minut - standard (dobry balans)
- 30-60 minut - bardziej "ludzko"
- 5-10 minut - szybka odpowiedź (może wyglądać automatycznie)

---

## 📎 **5. Materiały do wysyłki**

### Co to jest?
**Lista materiałów** (katalogi, cenniki) które będą wysyłane automatycznie gdy lead prosi o materiały.

### Co trzeba zrobić?
**Dodaj materiały** klikając "+ Dodaj materiał"

**Dwa typy:**
1. **LINK** - link do pobrania (np. Google Drive, Dropbox)
2. **ATTACHMENT** - załącznik (plik uploadowany z dysku)

### Na co wpływa?
- **Co zostanie wysłane:**
  - Gdy lead prosi o materiały → system wysyła WSZYSTKIE aktywne materiały z tej kampanii
  - Materiały są wysyłane w kolejności (pole "Kolejność")

**Przykład:**
Masz 3 materiały:
1. Katalog (kolejność: 0)
2. Cennik (kolejność: 1)
3. Instrukcja (kolejność: 2)

Lead prosi o materiały → dostanie wszystkie 3 w jednym mailu!

### Co jest wymagane?
- **Przynajmniej 1 materiał** - bez materiałów system nie może wysłać odpowiedzi
- **Materiał musi być aktywny** - możesz deaktywować niepotrzebne

### Kiedy dodawać?
- **Od razu** - gdy włączasz automatyczne odpowiedzi
- **Przed wysyłką kampanii** - żeby system miał co wysłać

---

## 🔄 **Jak to wszystko działa razem?**

### Scenariusz krok po kroku:

1. **Włączasz checkbox** → System zaczyna analizować odpowiedzi
2. **Wypełniasz kontekst** → AI wie o co chodzi w kampanii
3. **Dodajesz materiały** → System ma co wysłać
4. **Ustawiasz opóźnienie** → Określasz kiedy wysłać (15 min)

**Gdy lead odpowiada:**

1. Lead pisze: "Tak, proszę przesłać katalog"
2. **AI analizuje:**
   - Używa **kontekstu** żeby zrozumieć czy to prośba o katalog
   - Określa pewność (np. 85%)
   - Dodaje do kolejki administratora
3. **Administrator zatwierdza:**
   - Sprawdza kolejkę (`/material-decisions`)
   - Kliknij "Zatwierdź"
4. **System generuje odpowiedź:**
   - Używa **zasad** (tone, style) do generowania treści
   - Tworzy odpowiedź z materiałami
   - Czeka **opóźnienie** (15 min)
   - Wysyła maila z materiałami

---

## ✅ **Checklist - co musisz wypełnić?**

### Minimum (żeby działało):
- [x] Zaznacz checkbox "Włącz automatyczne odpowiedzi"
- [x] Wypełnij "Kontekst kampanii dla AI" (bardzo ważne!)
- [x] Dodaj przynajmniej 1 materiał
- [x] Opóźnienie: 15 min (domyślne)

### Opcjonalnie (dla lepszych wyników):
- [ ] Wypełnij "Zasady dla AI" (dla spersonalizowanego stylu)
- [ ] Dostosuj opóźnienie (jeśli potrzebujesz innego czasu)

---

## 💡 **Najważniejsze zasady**

1. **Kontekst jest KLUCZOWY** - bez niego AI może nie rozpoznać prośby
2. **Materiały są WYMAGANE** - bez materiałów system nie wyśle odpowiedzi
3. **Zasady są OPCJONALNE** - ale pomagają w lepszym stylu odpowiedzi
4. **Opóźnienie to BALANS** - za krótkie = automatycznie, za długie = wolno

---

## 🎯 **Przykładowa konfiguracja**

**Dla kampanii "Meble biurowe":**

```
✅ Włącz automatyczne odpowiedzi z materiałami

Kontekst:
Oferujemy meble biurowe do biur i przestrzeni współdzielonych. 
W treści maila pytamy: "Czy mogę przesłać katalog mebli biurowych i cennik?"

Zasady (opcjonalnie):
{
  "tone": "professional",
  "style": "friendly",
  "include": ["greeting", "thank you"]
}

Opóźnienie: 15 minut

Materiały:
1. Katalog mebli biurowych 2025 (LINK: https://...)
2. Cennik mebli biurowych (ATTACHMENT: cennik.pdf)
```

**Efekt:**
- Lead prosi o katalog → AI rozpoznaje (85% pewności)
- Trafia do kolejki → Administrator zatwierdza
- Po 15 min → Lead dostaje profesjonalną, przyjazną odpowiedź z katalogiem i cennikiem

---

Gotowe! Teraz wiesz co i jak wypełniać! 🎯

