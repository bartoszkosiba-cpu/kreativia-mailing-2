#!/bin/bash

# Auto Commit Script for Kreativia Mailing
# Automatyczny commit po każdej sesji pracy

set -e

# Konfiguracja
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Sprawdź czy jesteśmy w katalogu projektu
if [ ! -f "$PROJECT_DIR/package.json" ]; then
    echo "[!] Błąd: Nie jesteś w katalogu projektu"
    exit 1
fi

cd "$PROJECT_DIR"

# Sprawdź czy jest repo git
if [ ! -d ".git" ]; then
    echo "[!] Błąd: Brak repozytorium Git"
    exit 1
fi

# Sprawdź czy są zmiany do commitu
if git diff --quiet && git diff --cached --quiet; then
    echo "[→] Brak zmian do commitu"
    exit 0
fi

# Pokaż status
echo "[→] Status Git:"
git status --short

# Dodaj wszystkie zmiany
git add .

# Utwórz commit z automatycznym komunikatem
TIMESTAMP=$(date +"%Y-%m-%d %H:%M")
COMMIT_MSG="feat: Auto commit - $TIMESTAMP

- Automatyczny commit po sesji pracy
- Data: $TIMESTAMP
- Zmiany: $(git diff --cached --name-only | wc -l) plików"

git commit -m "$COMMIT_MSG"

echo "[ok] Commit utworzony: $TIMESTAMP"

# Dodaj wpis do changelog
CHANGELOG="$PROJECT_DIR/docs/changelog.md"
if [ -f "$CHANGELOG" ]; then
    echo "" >> "$CHANGELOG"
    echo "## $TIMESTAMP - Auto Commit" >> "$CHANGELOG"
    echo "- Automatyczny commit po sesji pracy" >> "$CHANGELOG"
    echo "- Zmienione pliki: $(git diff HEAD~1 --name-only | wc -l)" >> "$CHANGELOG"
    echo "- Commit hash: \`$(git rev-parse HEAD)\`" >> "$CHANGELOG"
fi

echo "[ok] Auto commit zakończony pomyślnie"
