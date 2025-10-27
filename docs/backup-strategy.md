# Strategia Backup i Bezpieczeństwa

## ✅ Co jest bezpieczne

### 1. **Kod źródłowy** 
- ✅ W Git + GitHub
- ✅ Wszystkie zmiany są commitowane
- ✅ Możesz cofnąć się do dowolnego commita
- **Lokalizacja**: https://github.com/bartoszkosiba-cpu/kreativia-mailing-2

### 2. **Historia zmian**
- ✅ Każdy commit zapisuje pełną wersję kodu
- ✅ Możesz zrobić `git log` aby zobaczyć historię
- ✅ Każda zmiana ma opisowy commit message

## ⚠️ Co NIE jest w Git (i dlaczego)

### Baza danych (`prisma/dev.db`)
- ❌ Nie jest w Git (ze względu na rozmiar i dane wrażliwe)
- ✅ Jest backupowana lokalnie w folderze `backups/`
- ✅ Możesz robić manualny backup przez skrypt

## 🔄 Automatyczny Backup Bazy

### Jak uruchomić backup ręcznie:

```bash
cd "/Users/bartoszkosiba/Library/Mobile Documents/com~apple~CloudDocs/Katalogi/Cursor/Projekty/Kopie/Kreativia Mailing 2"
./scripts/auto-backup-db.sh
```

To:
1. Skopiuje bazę z `prisma/dev.db` do `backups/dev_backup_[timestamp].db`
2. Doda plik do Git
3. Zrobi commit

### Automatyczny backup (cron - co dzień):

Edytuj crontab:
```bash
crontab -e
```

Dodaj linię (codziennie o 3:00):
```bash
0 3 * * * /Users/bartoszkosiba/Library/Mobile\ Documents/com~apple~CloudDocs/Katalogi/Cursor/Projekty/Kopie/Kreativia\ Mailing\ 2/scripts/auto-backup-db.sh >> /tmp/db-backup.log 2>&1
```

## 📦 Backup pełny (folder backups/)

Skrypt `scripts/auto-backup.sh` robi pełny backup całego projektu:

```bash
./scripts/auto-backup.sh
```

To tworzy kopię całego projektu (bez node_modules) w `backups/backup-[timestamp]/`.

## 🎯 Rekomendacja

**Codzienne:**
1. Automatyczny backup bazy (przez cron) → Git
2. Przy każdej większej zmianie → pełny backup folderu

**Przed importantnymi zmianami:**
1. Uruchom: `./scripts/auto-backup.sh` (pełna kopia)
2. Lub: `./scripts/auto-backup-db.sh` (tylko baza)

## 🔐 Bezpieczeństwo danych

**W Git:**
- ✅ Wszystki kod
- ✅ Konfiguracja
- ✅ Historia zmian
- ✅ Backupy bazy (jako binary)

**Lokalnie (backups/):**
- ✅ Pełne kopie projektu
- ✅ Backupy bazy z timestampem

**Jak wrócić do poprzedniej wersji:**

```bash
# 1. Zobacz historię
git log --oneline

# 2. Wróć do konkretnego commita
git checkout [commit-hash]

# 3. Albo zobacz co było w danej wersji
git show [commit-hash]:filename

# 4. Przywróć konkretny plik
git checkout [commit-hash] -- filename
```

## 📊 Status obecny

**Ostatni commit:** `74aef91` - "feat: Dodano format HH:MM dla harmonogramów kampanii"  
**Branch:** `main`  
**Zdystansowany do:** `origin/main` (GitHub)

**Backupy lokalne:**
- `backups/backup-2025-10-24_16-57-14/`
- `backups/backup-2025-10-25_08-58-54/`

**Baza danych:**
- `prisma/dev.db` (296KB) - aktywna baza
- Lokalizacja backupów: `backups/*.db`

