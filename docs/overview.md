# Kreativia Mailing - Przegląd Projektu

## Cel Projektu
Profesjonalny system do zarządzania kampaniami email B2B z integracją AI do personalizacji i klasyfikacji odpowiedzi.

## Główne Funkcjonalności
- **Kampanie Email**: Tworzenie, planowanie i wysyłanie kampanii B2B
- **Zarządzanie Leadami**: Import CSV, personalizacja, tagowanie
- **Wirtualni Handlowcy**: Multi-mailbox, rotacja, limity wysyłek
- **AI Content Planner**: Generowanie treści z Meta-AI Agent
- **Warmup System**: Rozgrzewka skrzynek email, DNS setup, metryki deliverability
- **AI Classification**: 8 kategorii klasyfikacji odpowiedzi (INTERESTED, NOT_INTERESTED, MAYBE_LATER, REDIRECT, OOO, UNSUBSCRIBE, BOUNCE, OTHER)
- **Inbox Management**: Automatyczna klasyfikacja i akcje AI
- **Raporty**: Statystyki kampanii, metryki warmup, tokeny AI

## Architektura Techniczna
- **Frontend**: Next.js 14.2.5, React 18.3.1, TypeScript
- **Backend**: Next.js API Routes, Prisma ORM
- **Baza Danych**: SQLite (dev.db)
- **AI**: OpenAI GPT-4o, GPT-4o-mini
- **Email**: Nodemailer (SMTP), IMAP
- **Automatyzacja**: Node-cron
- **Import**: PapaParse (CSV)

## Status Projektu
- **Wersja**: 0.1.0
- **Status**: Aktywny development
- **Ostatnia aktualizacja**: 2025-10-23
- **TypeScript**: 0 błędów (naprawione 67 błędów)
- **Build**: Działa poprawnie
- **Aplikacja**: Uruchomiona na http://localhost:3001

## Struktura Katalogów
```
app/                    # Next.js App Router
├── api/               # API endpoints
├── campaigns/         # Strony kampanii
├── leads/            # Zarządzanie leadami
├── salespeople/      # Wirtualni handlowcy
├── inbox/            # Skrzynka odbiorcza
├── reports/          # Raporty
├── settings/         # Ustawienia
└── warmup/           # System warmup

src/                   # Kod źródłowy
├── integrations/     # Integracje (SMTP, IMAP, AI)
├── services/         # Logika biznesowa
└── lib/             # Narzędzia pomocnicze

docs/                  # Dokumentacja
├── chat-history/     # Historia rozmów
├── overview.md       # Ten plik
├── ideas.md         # Pomysły na przyszłość
├── changelog.md     # Historia zmian
├── decisions.md     # Ważne decyzje
├── code-review.md   # Przegląd kodu
├── code-health.md   # Stan kodu
└── system-statusy.md # System statusów leadów

backups/              # Kopie zapasowe
project-config/       # Konfiguracja projektu
```

## Ważne Uwagi
- Aplikacja używa systemu AI do klasyfikacji odpowiedzi email
- Implementuje zaawansowany system warmup dla deliverability
- Wspiera multi-mailbox z rotacją dla wirtualnych handlowców
- Ma zintegrowany system cron jobs do automatyzacji
