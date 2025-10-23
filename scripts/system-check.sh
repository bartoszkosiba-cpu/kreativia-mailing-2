#!/bin/bash

# System Check Script for Kreativia Mailing
# Sprawdza stan systemu, serwera, bazy danych

set -e

# Konfiguracja
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "[→] System Check - $(date)"
echo "=================================="

# Sprawdź czy jesteśmy w katalogu projektu
if [ ! -f "$PROJECT_DIR/package.json" ]; then
    echo "[!] Błąd: Nie jesteś w katalogu projektu"
    exit 1
fi

cd "$PROJECT_DIR"

# 1. Sprawdź Git
echo "[→] Sprawdzam Git..."
if [ -d ".git" ]; then
    echo "[ok] Repozytorium Git istnieje"
    echo "    Branch: $(git branch --show-current)"
    echo "    Ostatni commit: $(git log -1 --format='%h %s')"
    echo "    Status: $(git status --porcelain | wc -l) plików zmienionych"
else
    echo "[!] Brak repozytorium Git"
fi

# 2. Sprawdź pliki konfiguracyjne
echo ""
echo "[→] Sprawdzam pliki konfiguracyjne..."
if [ -f "package.json" ]; then
    echo "[ok] package.json istnieje"
else
    echo "[!] Brak package.json"
fi

if [ -f ".env" ]; then
    echo "[ok] .env istnieje"
else
    echo "[!] Brak .env"
fi

if [ -f ".env.example" ]; then
    echo "[ok] .env.example istnieje"
else
    echo "[!] Brak .env.example"
fi

# 3. Sprawdź bazę danych
echo ""
echo "[→] Sprawdzam bazę danych..."
if [ -f "dev.db" ]; then
    echo "[ok] Baza danych dev.db istnieje"
    echo "    Rozmiar: $(du -h dev.db | cut -f1)"
else
    echo "[!] Brak bazy danych dev.db"
fi

# 4. Sprawdź node_modules
echo ""
echo "[→] Sprawdzam node_modules..."
if [ -d "node_modules" ]; then
    echo "[ok] node_modules istnieje"
    echo "    Rozmiar: $(du -sh node_modules | cut -f1)"
else
    echo "[!] Brak node_modules - uruchom 'npm install'"
fi

# 5. Sprawdź pliki systemowe macOS
echo ""
echo "[→] Sprawdzam pliki systemowe macOS..."
MACOS_FILES=$(find . -name ".DS_Store" -o -name "._*" -o -name "Icon?" | wc -l)
if [ "$MACOS_FILES" -gt 0 ]; then
    echo "[!] Znaleziono $MACOS_FILES plików systemowych macOS"
    echo "    Uruchom: find . -name '.DS_Store' -delete"
else
    echo "[ok] Brak plików systemowych macOS"
fi

# 6. Sprawdź dokumentację
echo ""
echo "[→] Sprawdzam dokumentację..."
if [ -d "docs" ]; then
    echo "[ok] Katalog docs istnieje"
    echo "    Pliki: $(ls docs/ | wc -l)"
else
    echo "[!] Brak katalogu docs"
fi

if [ -d "backups" ]; then
    echo "[ok] Katalog backups istnieje"
    echo "    Kopie: $(ls backups/ | wc -l)"
else
    echo "[!] Brak katalogu backups"
fi

# 7. Sprawdź serwer (jeśli działa)
echo ""
echo "[→] Sprawdzam serwer..."
if curl -s http://localhost:3002 > /dev/null 2>&1; then
    echo "[ok] Serwer działa na porcie 3002"
else
    echo "[!] Serwer nie odpowiada na porcie 3002"
fi

echo ""
echo "[ok] System Check zakończony"
