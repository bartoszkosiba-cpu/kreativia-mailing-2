# PROBLEM Z SQLITE TIMEOUT - ANALIZA

## 🔍 Co się stało?

Podczas próby uruchomienia automatycznych testów (`scripts/test-complete-system.js`), napotkałem błędy timeout z SQLite:

```
Operations timed out after `N/A`. Context: The database failed to respond to a query within the configured timeout
```

## 📊 Przyczyna problemu

### 1. **SQLite limitations**

SQLite ma fundamentalne ograniczenia:
- **Tylko 1 writer naraz** - SQLite obsługuje tylko jedną operację zapisu w danym momencie
- **Concurrent reads** - wiele operacji odczytu jest OK
- **Concurrent writes** - powodują blokady i timeouty

### 2. **Wiele procesów używających bazy**

Z `lsof prisma/dev.db` widziałem:
```
node    71362  - Monitor wysyłek (tsx skrypt)
node    87156  - Serwer Next.js (9 połączeń do bazy!)
```

**Serwer Next.js ma 9 aktywnych połączeń do bazy:**
- Każde połączenie Prisma Client może wykonywać operacje
- Cron jobs (emailCron.ts) - co 30 sekund
- API endpoints - obsługują requesty
- Monitor wysyłek - co 30 sekund

### 3. **Długie transakcje**

Gdy wiele procesów próbuje jednocześnie:
- **Serwer Next.js:** Wykonuje cron jobs, API requests
- **Skrypt testowy:** Próbuje INSERT (write operation)
- **SQLite:** Blokuje bazę dla write operation

**Rezultat:** Timeout - baza nie odpowiada w czasie (domyślnie 5 sekund)

## 🔧 Rozwiązania

### Rozwiązanie 1: Zatrzymać serwer przed testami ✅ (NAJPROSTSZE)

```bash
# Zatrzymaj serwer Next.js
pkill -f "next dev"

# Uruchom testy
node scripts/test-complete-system.js

# Uruchom serwer ponownie
npm run dev
```

**Zalety:**
- ✅ Proste
- ✅ Nie wymaga zmian w kodzie
- ✅ Działa natychmiast

**Wady:**
- ❌ Musisz ręcznie zatrzymać serwer
- ❌ Nie możesz testować podczas działania serwera

---

### Rozwiązanie 2: Zwiększyć timeout SQLite

**Zmodyfikuj `src/lib/db.ts`:**

```typescript
import { PrismaClient } from "@prisma/client";

const prismaClientOptions: any = {
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
};

// Dla SQLite: zwiększ timeout
if (process.env.DATABASE_URL?.includes('sqlite') || process.env.DATABASE_URL?.includes('.db')) {
  prismaClientOptions.datasources = {
    db: {
      url: process.env.DATABASE_URL + '?busy_timeout=30000' // 30 sekund
    }
  };
}

declare global {
  var prisma: PrismaClient | undefined;
}

export const db = global.prisma ?? new PrismaClient(prismaClientOptions);
if (process.env.NODE_ENV !== "production") global.prisma = db;
```

**Zalety:**
- ✅ Działa z uruchomionym serwerem
- ✅ Dłuższy timeout = mniej błędów

**Wady:**
- ❌ Nadal może być problem z concurrent writes
- ❌ Dłuższe czekanie na timeout

---

### Rozwiązanie 3: Włączyć WAL mode (Write-Ahead Logging)

**WAL mode pozwala na:**
- Wiele concurrent readers
- Jeden writer (ale bez blokowania readers)
- Lepsze performance

**Dodaj do `src/lib/db.ts`:**

```typescript
import { PrismaClient } from "@prisma/client";
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';

// Włącz WAL mode dla SQLite (tylko raz)
if (process.env.DATABASE_URL?.includes('sqlite') || process.env.DATABASE_URL?.includes('.db')) {
  const dbPath = process.env.DATABASE_URL.replace('file:', '').replace('?', '').split('?')[0];
  const fullPath = path.join(process.cwd(), dbPath);
  
  if (existsSync(fullPath)) {
    try {
      execSync(`sqlite3 "${fullPath}" "PRAGMA journal_mode=WAL;"`, { stdio: 'ignore' });
    } catch (e) {
      // Ignore - może być już włączone
    }
  }
}

export const db = global.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") global.prisma = db;
```

**Zalety:**
- ✅ Lepsze performance
- ✅ Więcej concurrent operations
- ✅ Mniej timeoutów

**Wady:**
- ❌ Wymaga dodatkowych plików (`.db-wal`, `.db-shm`)
- ❌ Może być problem z backupami

---

### Rozwiązanie 4: Użyć innej bazy dla testów

**Dla testów użyj PostgreSQL lub in-memory SQLite:**

```typescript
// scripts/test-complete-system.js
const { PrismaClient } = require('@prisma/client');

// Użyj in-memory SQLite dla testów
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'file::memory:?cache=shared'
    }
  }
});
```

**Zalety:**
- ✅ Nie konfliktuje z produkcyjną bazą
- ✅ Szybkie testy
- ✅ Można testować podczas działania serwera

**Wady:**
- ❌ Wymaga osobnej migracji
- ❌ Dane nie są trwałe

---

### Rozwiązanie 5: Użyć testowej bazy plikowej

**Utwórz osobną bazę dla testów:**

```typescript
// scripts/test-complete-system.js
const { PrismaClient } = require('@prisma/client');
const path = require('path');
const fs = require('fs');

// Utwórz testową bazę
const testDbPath = path.join(__dirname, '../prisma/test.db');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: `file:${testDbPath}?busy_timeout=30000`
    }
  }
});

// Cleanup po testach
process.on('exit', () => {
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }
});
```

**Zalety:**
- ✅ Nie konfliktuje z produkcyjną bazą
- ✅ Można testować podczas działania serwera
- ✅ Dane mogą być trwałe (opcjonalnie)

**Wady:**
- ❌ Wymaga osobnej migracji
- ❌ Więcej plików

---

## 🎯 Rekomendacja

**Dla teraz (najszybsze rozwiązanie):**
1. Zatrzymaj serwer Next.js przed testami
2. Uruchom testy
3. Uruchom serwer ponownie

**Dla przyszłości (długoterminowe):**
1. Włącz WAL mode dla SQLite
2. Zwiększ timeout do 30 sekund
3. Rozważ przejście na PostgreSQL dla produkcji

---

## 📝 Dodatkowe informacje

### SQLite connection pooling

Prisma Client używa connection pooling, ale SQLite:
- **Nie obsługuje prawdziwego connection pooling**
- Każde połączenie = osobny proces
- Wiele połączeń = większe ryzyko timeoutów

### Dlaczego serwer Next.js ma 9 połączeń?

- **Hot reload** - każda zmiana kodu tworzy nowe połączenie
- **API routes** - każdy route może mieć własne połączenie
- **Cron jobs** - działają w tle
- **Development mode** - Next.js tworzy wiele worker processes

### Jak sprawdzić ile połączeń jest aktywnych?

```bash
lsof prisma/dev.db | wc -l
```

---

**Data analizy:** 2025-11-04  
**Status:** Problem zidentyfikowany  
**Rekomendacja:** Zatrzymać serwer przed testami lub użyć WAL mode

