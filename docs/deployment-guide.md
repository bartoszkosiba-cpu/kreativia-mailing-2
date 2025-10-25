# 🚀 Przewodnik Wdrożenia - Kreativia Mailing 2

## 📋 Status Wdrożenia: **GOTOWE DO PRODUKCJI**

**Data wdrożenia:** 25 października 2025  
**Wersja:** v2.0.0  
**Status:** ✅ Wszystkie testy przeszły pomyślnie

---

## 🎯 Podsumowanie Systemu

### **Główne Funkcjonalności:**
- ✅ **AI Agent** - Automatyczna klasyfikacja odpowiedzi emailowych
- ✅ **System Statusów** - Zarządzanie statusami leadów (AKTYWNY, BLOKADA, CZEKAJ)
- ✅ **AUTO_FOLLOWUP** - Automatyczne follow-upy dla leadów w statusie CZEKAJ
- ✅ **AI Chat Interface** - Interfejs do zarządzania regułami AI
- ✅ **Centralne Archiwum** - Wszystkie emaile w jednym miejscu
- ✅ **Hot Leads** - Lista priorytetowych leadów
- ✅ **Warmup System** - System rozgrzewania skrzynek emailowych

### **Przetestowane Scenariusze:**
1. ✅ **INTERESTED** - "Proszę o wycenę" → Status: AKTYWNY
2. ✅ **REDIRECT z emailem** - "Przekazuję do działu zakupów" → Status: BLOKADA + utworzenie nowego leada
3. ✅ **REDIRECT bez emaila** - "Odezwą się w ciągu tygodnia" → Status: CZEKAJ + AUTO_FOLLOWUP

---

## 🔧 Wymagania Systemowe

### **Serwer:**
- Node.js 18+ 
- npm 9+
- SQLite (lub PostgreSQL/MySQL)
- 2GB RAM minimum
- 10GB dysku

### **Zmienne Środowiskowe (.env):**
```bash
# Database
DATABASE_URL="file:./dev.db"

# OpenAI
OPENAI_API_KEY="sk-..."

# SMTP (opcjonalne)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"

# IMAP (opcjonalne)
IMAP_HOST="imap.gmail.com"
IMAP_PORT=993
IMAP_USER="your-email@gmail.com"
IMAP_PASS="your-app-password"
```

---

## 🚀 Instrukcje Wdrożenia

### **1. Przygotowanie Środowiska**
```bash
# Klonowanie repozytorium
git clone <repository-url>
cd "Kreativia Mailing 2"

# Instalacja zależności
npm install

# Konfiguracja bazy danych
npx prisma db push

# Seedowanie danych AI
npx tsx scripts/seed-ai-config.ts
```

### **2. Uruchomienie Aplikacji**
```bash
# Development
npm run dev

# Production
npm run build
npm start
```

### **3. Weryfikacja Wdrożenia**
```bash
# Sprawdzenie statusu systemu
./scripts/system-check.sh

# Test API
curl http://localhost:3002/api/ai/health
curl http://localhost:3002/api/leads
```

---

## 📊 Monitoring i Logi

### **Logi Systemowe:**
- **Cron Jobs:** `[CRON]` - zadania zaplanowane
- **AI Agent:** `[EMAIL AGENT AI]` - przetwarzanie odpowiedzi
- **AUTO_FOLLOWUP:** `[AUTO-FOLLOWUP]` - automatyczne follow-upy
- **Warmup:** `[WARMUP CRON]` - system warmup

### **Metryki Kluczowe:**
- Liczba leadów w każdym statusie
- Liczba przetworzonych odpowiedzi przez AI
- Liczba wysłanych AUTO_FOLLOWUP
- Wydajność warmup systemu

### **Endpointy Monitoringu:**
- `GET /api/ai/health` - Status AI Agent
- `GET /api/cron/status` - Status cron jobs
- `GET /api/leads/hot` - Hot leads
- `GET /api/archive` - Centralne archiwum

---

## 🔄 Backup i Przywracanie

### **Automatyczne Backupy:**
```bash
# Tworzenie backupu
./scripts/auto-backup.sh

# Backup bazy danych
cp prisma/dev.db backups/dev-$(date +%Y%m%d).db
```

### **Przywracanie:**
```bash
# Przywrócenie z backupu
cp backups/dev-YYYYMMDD.db prisma/dev.db
npx prisma db push
```

---

## 🛠️ Rozwiązywanie Problemów

### **Częste Problemy:**

1. **AI Agent nie działa:**
   - Sprawdź `OPENAI_API_KEY` w .env
   - Sprawdź logi: `[EMAIL AGENT AI]`

2. **Cron jobs nie działają:**
   - Sprawdź logi: `[CRON]`
   - Restart aplikacji

3. **Baza danych:**
   - Sprawdź `DATABASE_URL`
   - Uruchom `npx prisma db push`

4. **Port zajęty:**
   - Użyj `PORT=3002 npm run dev`
   - Lub zmień port w .env

---

## 📈 Optymalizacja Wydajności

### **Rekomendacje:**
- Użyj PostgreSQL dla produkcji
- Skonfiguruj Redis dla cache
- Ustaw odpowiednie limity dla cron jobs
- Monitoruj użycie pamięci

### **Skalowanie:**
- Dodaj load balancer
- Skonfiguruj multiple instances
- Użyj CDN dla statycznych plików

---

## 🔐 Bezpieczeństwo

### **Zalecenia:**
- Użyj HTTPS w produkcji
- Skonfiguruj firewall
- Regularne backupy
- Monitoruj logi dostępu
- Użyj silnych haseł dla SMTP/IMAP

---

## 📞 Wsparcie

### **Dokumentacja:**
- `docs/system-statusy.md` - System statusów
- `docs/ai-architecture.md` - Architektura AI
- `docs/test-scenarios.md` - Scenariusze testowe

### **Logi:**
- Sprawdź terminal output
- Sprawdź `logs/` directory (jeśli skonfigurowane)
- Użyj `./scripts/system-check.sh`

---

## ✅ Checklist Wdrożenia

- [x] Wszystkie testy przeszły
- [x] Build successful
- [x] Baza danych skonfigurowana
- [x] AI Agent działa
- [x] Cron jobs uruchomione
- [x] Backup utworzony
- [x] Dokumentacja aktualna
- [x] System gotowy do produkcji

---

**🎉 System jest w pełni funkcjonalny i gotowy do użycia!**
