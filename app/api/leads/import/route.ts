import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
// import { chatgptService } from "@/services/chatgptService"; // USUNIĘTE - import bez odmiany imion

// Zwiększ timeout dla importu dużych list
export const maxDuration = 300; // 5 minut
export const dynamic = 'force-dynamic';

// Mapowanie krajów na języki
function getLanguageFromCountry(country: string | null | undefined): string {
  if (!country) return 'pl';
  
  const countryLower = country.toLowerCase().trim();
  
  // Kraje niemieckojęzyczne (bez konfliktów)
  if (['germany', 'deutschland', 'niemcy', 'austria', 'österreich', 'austria'].includes(countryLower)) {
    return 'de';
  }
  
  // Kraje francuskojęzyczne (bez konfliktów)
  if (['france', 'frankreich', 'francja'].includes(countryLower)) {
    return 'fr';
  }
  
  // Szwajcaria - domyślnie angielski (główny język biznesowy międzynarodowy)
  if (['switzerland', 'schweiz', 'suisse', 'szwajcaria'].includes(countryLower)) {
    return 'en';
  }
  
  // Belgia - domyślnie francuski (główny język biznesowy)
  if (['belgium', 'belgique', 'belgia'].includes(countryLower)) {
    return 'fr';
  }
  
  // Kraje anglojęzyczne
  if (['united kingdom', 'uk', 'great britain', 'britain', 'wielka brytania', 'brytania', 'united states', 'usa', 'us', 'america', 'stany zjednoczone', 'usa', 'canada', 'kanada', 'australia', 'australia'].includes(countryLower)) {
    return 'en';
  }
  
  // Kraje używające angielskiego w B2B (nowe)
  if (['netherlands', 'holland', 'holandia', 'sweden', 'szwecja', 'denmark', 'dania', 'norway', 'norwegia', 'finland', 'finlandia'].includes(countryLower)) {
    return 'en';
  }
  
  // Kraje polskojęzyczne
  if (['poland', 'polska', 'polen'].includes(countryLower)) {
    return 'pl';
  }
  
  // Domyślnie polski
  return 'pl';
}

function getGreetingByLanguage(language: string): string {
  switch (language.toLowerCase()) {
    case 'de':
      return 'Guten Tag';
    case 'en':
      return 'Hello';
    case 'fr':
      return 'Bonjour';
    case 'pl':
    default:
      return 'Dzień dobry';
  }
}

// Funkcja do aktualizacji postępu
async function updateProgress(importId: string, data: {
  total?: number;
  processed?: number;
  currentStep?: string;
  error?: string;
}) {
  try {
    await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/leads/import/progress`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ importId, ...data })
    });
  } catch (error) {
    console.error('Błąd aktualizacji postępu:', error);
  }
}

export async function POST(req: NextRequest) {
  let importId = `import_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    console.log("Import: Rozpoczynam import leadów...");
    const { leads, tagId, importId: clientImportId } = await req.json();
    console.log(`Import: Otrzymano ${leads?.length || 0} leadów, tagId: ${tagId}`);
    
    // Użyj importId z klienta lub wygeneruj nowy
    importId = clientImportId || importId;
    console.log(`Import: Używam importId: ${importId}`);

    if (!Array.isArray(leads) || leads.length === 0) {
      console.log("Import: Błąd - brak leadów");
      return NextResponse.json({ error: "Lista leadów jest wymagana" }, { status: 400 });
    }

    // Inicjalizuj postęp OD RAZU - żeby frontend mógł pobrać dane
    await updateProgress(importId, {
      total: leads.length,
      processed: 0,
      currentStep: "Inicjalizacja importu..."
    });

    // ✅ IMPORT BEZ CHATGPT API - LEADY Z STATUSEM "NO_GREETING"
    await updateProgress(importId, { currentStep: "Import bez odmiany imion..." });
    console.log("Import: Importuję leady bez odmiany imion (status: NO_GREETING)");

    // Tag jest wymagany
    if (!tagId || typeof tagId !== "number") {
      return NextResponse.json({ error: "Tag jest wymagany dla importu leadów" }, { status: 400 });
    }

    const tag = await db.tag.findUnique({
      where: { id: tagId }
    });

    if (!tag) {
      return NextResponse.json({ error: "Tag nie został znaleziony" }, { status: 404 });
    }

    const { normalizeUrl } = await import("@/lib/url");
    
    // Import leadów - tylko dodawanie nowych lub aktualizacja istniejących
    let importedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    
    console.log(`Import: Przetwarzanie ${leads.length} leadów...`);
    
    await updateProgress(importId, { currentStep: "Zapisywanie leadów do bazy danych..." });
    console.log(`Import: Rozpoczynam zapis leadów bez odmiany imion...`);
    
    for (let i = 0; i < leads.length; i++) {
      const leadData = leads[i];
      
      // Aktualizuj postęp co 10 leadów lub na końcu
      if (i % 10 === 0 || i === leads.length - 1) {
        await updateProgress(importId, { 
          processed: i + 1,
          currentStep: `Zapisywanie leadów... (${i + 1}/${leads.length})`
        });
      }
      if (!leadData.email) {
        console.log(`Import: Pominięto lead bez emaila`);
        continue;
      }

      const language = getLanguageFromCountry(leadData.companyCountry);
      
      // Sprawdź czy lead już istnieje
      const existingLead = await db.lead.findUnique({
        where: { email: leadData.email }
      });

      let lead;
      if (existingLead) {
        console.log(`Import: Lead ${leadData.email} już istnieje - aktualizacja`);
        // Aktualizuj istniejący lead - tylko jeśli nowe dane nie są puste
        const updateData: any = {};
        
        if (leadData.firstName && leadData.firstName.trim()) {
          updateData.firstName = leadData.firstName.trim();
        }
        if (leadData.lastName && leadData.lastName.trim()) {
          updateData.lastName = leadData.lastName.trim();
        }
        if (leadData.title && leadData.title.trim()) {
          updateData.title = leadData.title.trim();
        }
        if (leadData.company && leadData.company.trim()) {
          updateData.company = leadData.company.trim();
        }
        if (leadData.industry && leadData.industry.trim()) {
          updateData.industry = leadData.industry.trim();
        }
        if (leadData.keywords && leadData.keywords.trim()) {
          updateData.keywords = leadData.keywords.trim();
        }
        if (leadData.linkedinUrl && leadData.linkedinUrl.trim()) {
          updateData.linkedinUrl = normalizeUrl(leadData.linkedinUrl);
        }
        if (leadData.website && leadData.website.trim()) {
          updateData.websiteUrl = normalizeUrl(leadData.website);
        }
        if (leadData.companyCity && leadData.companyCity.trim()) {
          updateData.companyCity = leadData.companyCity.trim();
        }
        if (leadData.companyCountry && leadData.companyCountry.trim()) {
          updateData.companyCountry = leadData.companyCountry.trim();
        }
        if (language) {
          updateData.language = language;
        }

        // Aktualizuj tylko jeśli są nowe dane
        if (Object.keys(updateData).length > 0) {
          console.log(`Import: Aktualizacja ${leadData.email} z danymi:`, updateData);
          lead = await db.lead.update({
            where: { email: leadData.email },
            data: updateData
          });
          updatedCount++;
        } else {
          console.log(`Import: Brak nowych danych dla ${leadData.email} - pominięto`);
          lead = existingLead;
          skippedCount++;
        }
      } else {
        console.log(`Import: Nowy lead ${leadData.email} - dodawanie (bez odmiany imion)`);
        // Dodaj nowy lead bez odmiany imion - status NO_GREETING
        lead = await db.lead.create({
          data: {
            firstName: leadData.firstName || null,
            lastName: leadData.lastName || null,
            title: leadData.title || null,
            company: leadData.company || null,
            email: leadData.email,
            industry: leadData.industry || null,
            keywords: leadData.keywords || null,
            linkedinUrl: normalizeUrl(leadData.linkedinUrl),
            websiteUrl: normalizeUrl(leadData.website),
            companyCity: leadData.companyCity || null,
            companyCountry: leadData.companyCountry || null,
            language: language,
            greetingForm: null, // Bez odmiany imion
            status: "NO_GREETING" // Status: brak powitania
          }
        });
        console.log(`Import: Lead ${leadData.email} utworzony ze statusem NO_GREETING`);
        importedCount++;
      }

      // Dodaj tag do leada (jeśli tag został wybrany i jeszcze go nie ma)
      if (tag) {
        await db.leadTag.upsert({
          where: {
            leadId_tagId: {
              leadId: lead.id,
              tagId: tagId
            }
          },
          update: {},
          create: {
            leadId: lead.id,
            tagId: tagId
          }
        });
      }
    }

    console.log(`Import: Zakończono - dodano: ${importedCount}, zaktualizowano: ${updatedCount}, pominięto: ${skippedCount}`);
    
    // Finalizuj postęp
    await updateProgress(importId, { 
      processed: leads.length,
      currentStep: `Zakończono! Dodano: ${importedCount}, Zaktualizowano: ${updatedCount}, Pominięto: ${skippedCount}`
    });
    
    return NextResponse.json({ 
      message: tag 
        ? `Dodano ${importedCount} nowych leadów, zaktualizowano ${updatedCount} istniejących, pominięto ${skippedCount} bez zmian z tagiem "${tag.name}"`
        : `Dodano ${importedCount} nowych leadów, zaktualizowano ${updatedCount} istniejących, pominięto ${skippedCount} bez zmian (bez tagu)`,
      importedCount,
      updatedCount,
      skippedCount,
      totalCount: importedCount + updatedCount + skippedCount,
      tagName: tag?.name || null,
      importId // Zwróć ID importu dla śledzenia postępu
    });

  } catch (error) {
    console.error("Błąd importu leadów:", error);
    console.error("Stack trace:", error instanceof Error ? error.stack : 'No stack trace');
    
    // Zaktualizuj postęp z błędem (jeśli importId jest dostępne)
    if (importId) {
      await updateProgress(importId, { 
        currentStep: "Błąd podczas importu",
        error: error instanceof Error ? error.message : String(error)
      });
    }
    
    return NextResponse.json({ 
      error: "Wystąpił błąd podczas importu leadów",
      details: error instanceof Error ? error.message : 'Unknown error',
      importId
    }, { status: 500 });
  }
}
