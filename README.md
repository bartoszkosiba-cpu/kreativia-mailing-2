# Kreativia Mailing (Skeleton)

Wewnętrzne narzędzie do wysyłki maili B2B przez Gmail API, z AI do krótkiej personalizacji i klasyfikacji odpowiedzi. Repozytorium zawiera tylko szkielet (bez logiki biznesowej).

## Struktura

- `app/` – Next.js App Router, layout i strona startowa.
- `src/lib/` – utilsy, m.in. klient bazy `db.ts`.
- `src/integrations/gmail/` – placeholder klienta Gmail (`client.ts`).
- `src/integrations/ai/` – placeholder klienta AI (`client.ts`).
- `prisma/` – schema Prisma (SQLite) i migracje.
- `public/` – zasoby statyczne.

## Wymagania

- Node.js 18+ (zalecane LTS)
- pnpm / npm / yarn (dowolny manager pakietów)

## Szybki start

1. Zainstaluj zależności:
```bash
npm install
```
2. Skonfiguruj zmienne środowiskowe – utwórz plik `.env` (patrz niżej):
```bash
cp .env.example .env || true
```
3. Wygeneruj klienta Prisma i stwórz bazę:
```bash
npm run prisma:generate
npm run prisma:migrate
```
4. Uruchom dev server:
```bash
npm run dev
```

## Zmienne środowiskowe

Plik `.env` (przykład w `.env.example`):

- `DATABASE_URL` – ścieżka do SQLite, np. `file:./dev.db`
- (przyszłościowo) `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `OPENAI_API_KEY` – nieużywane w skeletonie.

## Jak testować (na tym etapie)

- Wejdź na `http://localhost:3000` – zobaczysz minimalną stronę.
- Brak akcji – integracje Gmail/AI mają tylko placeholdery i rzucają wyjątek lub zwracają wartości przykładowe.

## Pliki i jak je testować

- `app/page.tsx` – prosty ekran. Test: uruchom dev server i sprawdź render.
- `app/layout.tsx` – layout HTML. Test: zmień tytuł/opis, sprawdź efekt w przeglądarce.
- `src/lib/db.ts` – inicjalizacja PrismaClient. Test: po migracji zaimportuj w dowolnej funkcji i wykonaj prosty odczyt (dodamy później).
- `src/integrations/gmail/client.ts` – placeholder Gmail. Test: wywołanie zakończy się błędem "not implemented".
- `src/integrations/ai/client.ts` – placeholder AI. Test: zwracają stałe wartości placeholderów.
- `prisma/schema.prisma` – definicje modeli. Test: `npm run prisma:generate && npm run prisma:migrate`.

## Kolejne kroki (poza skeletonem)

- Implementacja OAuth do Gmail i wysyłki.
- Import CSV z Apollo i UI kampanii.
- Generacja personalizacji AI i klasyfikacja odpowiedzi.
- Kolejka wysyłki i polling odpowiedzi.


