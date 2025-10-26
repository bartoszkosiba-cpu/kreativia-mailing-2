#!/bin/bash

# Auto Backup Script for Database
# Automatyczny backup bazy danych do Git

set -e

# Konfiguracja
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB_SOURCE="$PROJECT_DIR/prisma/dev.db"
DB_BACKUP_DIR="$PROJECT_DIR/backups"
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
BACKUP_NAME="dev_backup_$TIMESTAMP.db"

echo "[→] Tworzę backup bazy danych..."

# Utwórz katalog backupów jeśli nie istnieje
mkdir -p "$DB_BACKUP_DIR"

# Sprawdź czy baza istnieje
if [ ! -f "$DB_SOURCE" ]; then
    echo "[!] Błąd: Baza danych nie istnieje: $DB_SOURCE"
    exit 1
fi

# Utwórz kopię bazy
cp "$DB_SOURCE" "$DB_BACKUP_DIR/$BACKUP_NAME"

echo "[ok] Backup utworzony: $DB_BACKUP_DIR/$BACKUP_NAME ($(du -h "$DB_BACKUP_DIR/$BACKUP_NAME" | cut -f1))"

# Dodaj do Git (jako binary)
cd "$PROJECT_DIR"
git add "backups/$BACKUP_NAME"
git commit -m "chore: auto-backup database $TIMESTAMP" 2>/dev/null || echo "[info] Nie było zmian do commita"

echo "[ok] Backup zakończony pomyślnie"

