# Ważne Decyzje Projektowe

## 2025-10-23

### [DATA] Uruchomiono Autobackup & History
- Włączono system automatycznych backupów
- Utworzono strukturę dokumentacji w `docs/`
- Zainicjalizowano git repository
- Ustanowiono procedury pracy zgodnie z `project-config/startup.md`

### [DATA] Naprawiono 67 błędów TypeScript
- Zaktualizowano interfejsy ImapConfig, ParsedEmail, VirtualSalesperson
- Naprawiono problemy z null safety w Prisma queries
- Poprawiono error handling (unknown -> Error instances)
- Zaktualizowano AI Action types (REMOVE_FROM_CAMPAIGNS -> BLOCK)
- Naprawiono pola w CampaignEmailData (leadFirstName -> leadName)
- Aplikacja kompiluje się bez błędów TypeScript

### [DATA] Ustanowiono standardy pracy
- Wprowadzono piktogramy ASCII zamiast emoji
- Ustanowiono procedury backupów przed zmianami
- Wprowadzono obowiązek opisywania planów przed wykonaniem
- Ustanowiono system dokumentacji w `docs/`

## Architektura

### Wybór Next.js 14.2.5
- **Powód**: App Router, Server Components, łatwa integracja z API
- **Alternatywy**: Express.js + React, Vue.js + Nuxt
- **Decyzja**: Next.js dla pełnej integracji frontend/backend

### Wybór SQLite
- **Powód**: Prosty setup, brak potrzeby serwera bazy danych
- **Alternatywy**: PostgreSQL, MySQL
- **Decyzja**: SQLite dla development, planowana migracja na PostgreSQL

### Wybór Prisma ORM
- **Powód**: Type safety, łatwa migracja schematów, auto-generacja typów
- **Alternatywy**: TypeORM, Sequelize, raw SQL
- **Decyzja**: Prisma dla bezpieczeństwa typów i łatwości rozwoju

### System AI Classification
- **Powód**: Automatyzacja obsługi odpowiedzi email
- **Kategorie**: 8 głównych (INTERESTED, NOT_INTERESTED, MAYBE_LATER, REDIRECT, OOO, UNSUBSCRIBE, BOUNCE, OTHER)
- **Decyzja**: OpenAI GPT-4o dla klasyfikacji, lokalne reguły dla akcji

## Bezpieczeństwo

### Autobackup & History
- **Powód**: Bezpieczeństwo danych, możliwość rollback
- **Implementacja**: Git commits + kopie w `backups/` + dokumentacja w `changelog.md`
- **Decyzja**: Obowiązkowe przed każdą większą zmianą
