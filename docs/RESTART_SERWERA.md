# 🔄 RESTART SERWERA - WYMAGANY!

## ⚠️ PROBLEM

API zwraca błąd:
```json
{
  "success": false,
  "error": "Błąd podczas pobierania historii",
  "details": "Cannot read properties of undefined (reading 'findMany')"
}
```

## ✅ ROZWIĄZANIE

**Przyczyna:** Prisma Client nie został wygenerowany ponownie po dodaniu nowych modeli (`MaterialResponse`, `PendingMaterialDecision`, `Material`).

**Rozwiązanie:**

### **Krok 1: Wygeneruj Prisma Client**
```bash
npx prisma generate
```

### **Krok 2: Zrestartuj serwer Next.js**

**Jeśli serwer działa w terminalu:**
1. Zatrzymaj serwer (Ctrl+C)
2. Uruchom ponownie: `npm run dev`

**Jeśli serwer działa w tle:**
1. Znajdź proces: `ps aux | grep "next\|node" | grep dev`
2. Zatrzymaj proces
3. Uruchom ponownie: `npm run dev`

---

## ✅ PO RESTARCIE

Po zrestartowaniu serwera:
- ✅ API powinno działać poprawnie
- ✅ MaterialResponse powinny być widoczne w UI
- ✅ Endpoint `/api/campaigns/3/auto-replies` powinien zwracać dane

---

## 🔍 SPRAWDZENIE

Po restarcie sprawdź:
```bash
curl "http://127.0.0.1:3000/api/campaigns/3/auto-replies?type=material&status=sent&limit=50"
```

**Powinno zwrócić:**
```json
{
  "success": true,
  "data": [/* 2 elementy */],
  "total": 2
}
```

---

## ⚠️ UWAGA

**Zawsze po dodaniu nowych modeli do `schema.prisma`:**
1. ✅ Uruchom `npx prisma generate`
2. ✅ Zrestartuj serwer Next.js

**Inaczej Prisma Client nie będzie miał nowych modeli!**

