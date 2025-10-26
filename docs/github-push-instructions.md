# GitHub Push - Instrukcja

## Problem
Push do GitHub wymaga uwierzytelnienia, które nie jest skonfigurowane w terminalu Cursor.

## Rozwiązanie - Wykonaj Ręcznie w Terminalu

### Krok 1: Otwórz Terminal
```bash
# Przejdź do katalogu projektu
cd "/Users/bartoszkosiba/Library/Mobile Documents/com~apple~CloudDocs/Katalogi/Cursor/Projekty/Kopie/Kreativia Mailing 2"
```

### Krok 2: Sprawdź Status
```bash
git status
```

### Krok 3: Push do GitHub
```bash
git push origin main
```

### Krok 4: Jeśli Zapyta o Credentials
Opcja A (Personal Access Token):
1. Wejdź na GitHub.com → Settings → Developer settings → Personal access tokens
2. Wygeneruj token z uprawnieniami `repo`
3. Użyj tokena jako hasła

Opcja B (GitHub CLI):
```bash
# Instalacja GitHub CLI (jeśli brak)
brew install gh

# Logowanie
gh auth login

# Push
git push origin main
```

## Alternatywne Rozwiązanie (SSH)

Jeśli masz skonfigurowany klucz SSH:

```bash
# Sprawdź czy masz klucz SSH
ls -la ~/.ssh/

# Jeśli brak, wygeneruj:
ssh-keygen -t ed25519 -C "twoj-email@example.com"

# Dodaj do GitHub: Settings → SSH and GPG keys

# Zmień remote na SSH
git remote set-url origin git@github.com:bartoszkosiba-cpu/kreativia-mailing-2.git

# Push
git push origin main
```

## Weryfikacja

```bash
# Sprawdź czy push się udał
git log origin/main

# Lub sprawdź na GitHub.com
# https://github.com/bartoszkosiba-cpu/kreativia-mailing-2
```

