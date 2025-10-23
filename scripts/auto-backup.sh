#!/bin/bash

# Auto Backup Script for Kreativia Mailing
# Tworzy kopię zapasową przed większymi zmianami

set -e

# Konfiguracja
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="$PROJECT_DIR/backups"
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
BACKUP_NAME="backup-$TIMESTAMP"

# Sprawdź czy jesteśmy w katalogu projektu
if [ ! -f "$PROJECT_DIR/package.json" ]; then
    echo "[!] Błąd: Nie jesteś w katalogu projektu"
    exit 1
fi

# Utwórz katalog backupów jeśli nie istnieje
mkdir -p "$BACKUP_DIR"

echo "[→] Tworzę kopię zapasową: $BACKUP_NAME"

# Utwórz kopię zapasową (bez node_modules, .git, dist)
rsync -av \
    --exclude='node_modules/' \
    --exclude='.git/' \
    --exclude='dist/' \
    --exclude='build/' \
    --exclude='*.log' \
    --exclude='.DS_Store' \
    --exclude='._*' \
    --exclude='Icon?' \
    "$PROJECT_DIR/" "$BACKUP_DIR/$BACKUP_NAME/"

# Sprawdź czy backup się udał
if [ -d "$BACKUP_DIR/$BACKUP_NAME" ]; then
    echo "[ok] Kopia zapasowa utworzona: $BACKUP_DIR/$BACKUP_NAME"
    
    # Dodaj wpis do changelog
    CHANGELOG="$PROJECT_DIR/docs/changelog.md"
    if [ -f "$CHANGELOG" ]; then
        echo "" >> "$CHANGELOG"
        echo "## $TIMESTAMP - Auto Backup" >> "$CHANGELOG"
        echo "- Utworzono kopię zapasową: \`$BACKUP_NAME\`" >> "$CHANGELOG"
        echo "- Lokalizacja: \`backups/$BACKUP_NAME/\`" >> "$CHANGELOG"
    fi
    
    echo "[ok] Backup zakończony pomyślnie"
else
    echo "[!] Błąd: Nie udało się utworzyć kopii zapasowej"
    exit 1
fi
