# 🔍 Jak działa automatyczna odpowiedź z materiałami?

## ✅ **TAK - tylko odpowiedzi do kampanii**

Automatyczne odpowiedzi z materiałami działają **TYLKO** dla maili które są odpowiedzią do danej kampanii.

## 📋 **Jak system określa do której kampanii należy odpowiedź?**

### Krok 1: System znajduje leada
Gdy przychodzi email:
- System sprawdza czy nadawca jest w bazie leadów
- Jeśli TAK → znajduje leada
- Jeśli NIE → tworzy nowego leada (dla odpowiedzi INTERESTED)

### Krok 2: System znajduje kampanię
```typescript
// Z processor.ts linia 244-252
if (currentLead) {
  const campaignLead = await db.campaignLead.findFirst({
    where: { leadId: currentLead.id },
    include: { campaign: true },
    orderBy: { createdAt: "desc" } // Najnowsza kampania
  });
  campaign = campaignLead?.campaign;
}
```

**Logika:**
- Szuka najnowszej kampanii gdzie lead jest przypisany
- Jeśli lead jest w wielu kampaniach → wybiera **najnowszą** (orderBy: createdAt desc)

### Krok 3: System sprawdza czy kampania ma włączone auto-reply
```typescript
// Z emailAgentAI.ts linia 169
if (campaign?.autoReplyEnabled && campaignId) {
  // Sprawdź czy to prośba o materiały
  const materialAnalysis = await this.checkMaterialRequest(reply, campaign);
  // ...
}
```

**Warunki:**
- ✅ Musi być kampania (`campaign` nie jest null)
- ✅ Kampania musi mieć `autoReplyEnabled = true`
- ✅ Musi być `campaignId` (reply musi być powiązany z kampanią)

## 🎯 **Kiedy automatyczna odpowiedź NIE zadziała?**

### ❌ **Przypadek 1: Email nie jest odpowiedzią do kampanii**
- Lead pisze z własnej inicjatywy (nie był w kampanii)
- Lead został usunięty z kampanii przed odpowiedzią
- Lead jest w bazie, ale nigdy nie był w żadnej kampanii

**Efekt:** System nie znajdzie kampanii → `campaign = null` → auto-reply nie zadziała

### ❌ **Przypadek 2: Kampania nie ma włączonego auto-reply**
- Lead jest w kampanii, ale kampania ma `autoReplyEnabled = false`

**Efekt:** System znajdzie kampanię, ale auto-reply jest wyłączone → nie zadziała

### ❌ **Przypadek 3: Lead nie jest zainteresowany**
- Klasyfikacja emaila to NIE `INTERESTED`
- Np. `NOT_INTERESTED`, `MAYBE_LATER`, `REDIRECT`, etc.

**Efekt:** System sprawdza auto-reply tylko dla klasyfikacji `INTERESTED`

## ✅ **Kiedy automatyczna odpowiedź ZADZIAŁA?**

### ✅ **Scenariusz 1: Odpowiedź do kampanii z włączonym auto-reply**
1. Lead jest w kampanii (przez `CampaignLead`)
2. Kampania ma `autoReplyEnabled = true`
3. Lead odpowiada z klasyfikacją `INTERESTED`
4. AI rozpozna prośbę o materiały (pewność >= 60%)
5. System doda do kolejki administratora (`ASK_ADMIN_MATERIALS`)

**Efekt:** ✅ Trafia do kolejki decyzji administratora

### ✅ **Scenariusz 2: Lead w wielu kampaniach**
- Lead jest w kampanii A (stara) i kampanii B (nowa)
- Oba mają włączone auto-reply
- Lead odpowiada

**Efekt:** System używa **najnowszej kampanii** (kampania B) → auto-reply z materiałami kampanii B

## 📊 **Diagram przepływu**

```
Email przychodzi
    ↓
Czy nadawca jest w bazie?
    ├─ NIE → Tworzy nowego leada (tylko dla INTERESTED)
    └─ TAK → Znajduje leada
        ↓
Czy lead jest w kampanii?
    ├─ NIE → campaign = null → ❌ Auto-reply NIE działa
    └─ TAK → Znajduje najnowszą kampanię
        ↓
Czy kampania ma autoReplyEnabled = true?
    ├─ NIE → ❌ Auto-reply NIE działa
    └─ TAK → ✅ Sprawdza auto-reply
        ↓
Czy klasyfikacja = INTERESTED?
    ├─ NIE → ❌ Auto-reply NIE działa
    └─ TAK → Sprawdza czy to prośba o materiały
        ↓
Czy AI rozpozna prośbę (pewność >= 60%)?
    ├─ NIE → ❌ Auto-reply NIE działa (normalny forward)
    └─ TAK → ✅ Dodaje do kolejki administratora
```

## 🔑 **Kluczowe informacje**

### 1. **Powiązanie leada z kampanią**
- Lead musi być w tabeli `CampaignLead`
- To oznacza że lead został dodany do kampanii (przez import, ręcznie, etc.)
- **Bez powiązania → auto-reply nie działa**

### 2. **Najnowsza kampania**
- Jeśli lead jest w wielu kampaniach → system używa **najnowszej** (najpóźniej dodanej)
- To ma sens: jeśli lead odpowiada, prawdopodobnie chodzi o najnowszą kampanię

### 3. **Auto-reply per kampania**
- Każda kampania ma swoje własne ustawienia auto-reply
- Każda kampania ma swoje własne materiały
- Odpowiedź używa materiałów z **tej kampanii** do której lead jest przypisany

## 📝 **Przykład**

**Sytuacja:**
- Lead: `jan@firma.pl`
- Kampania A: "Podwieszenia targowe" (autoReplyEnabled: true, materiały: katalog podwieszeń)
- Kampania B: "Meble biurowe" (autoReplyEnabled: false)
- Lead jest w OBU kampaniach (najpierw A, potem B)

**Co się stanie gdy lead odpowie?**

1. System znajdzie leada: `jan@firma.pl` ✅
2. System znajdzie kampanię: Najnowsza = **Kampania B** (bo orderBy createdAt desc)
3. System sprawdzi auto-reply: `autoReplyEnabled = false` ❌
4. **Efekt:** Auto-reply NIE zadziała (kampania B ma wyłączone)

**Co gdyby Kampania B miała autoReplyEnabled = true?**

1. System znajdzie kampanię: **Kampania B** ✅
2. System sprawdzi auto-reply: `autoReplyEnabled = true` ✅
3. System sprawdzi klasyfikację: Jeśli `INTERESTED` → ✅
4. System sprawdzi prośbę o materiały: Jeśli AI rozpozna → ✅
5. **Efekt:** Dodaje do kolejki z materiałami z **Kampanii B**

---

## ✅ **Podsumowanie**

**Automatyczne odpowiedzi działają TYLKO gdy:**
1. ✅ Email jest odpowiedzią od leada który jest w bazie
2. ✅ Lead jest przypisany do kampanii (przez `CampaignLead`)
3. ✅ Kampania ma `autoReplyEnabled = true`
4. ✅ Klasyfikacja emaila to `INTERESTED`
5. ✅ AI rozpozna prośbę o materiały (pewność >= 60%)

**Jeśli którykolwiek warunek nie jest spełniony → auto-reply nie działa!**


