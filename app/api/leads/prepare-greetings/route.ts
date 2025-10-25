import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { chatgptService } from "@/services/chatgptService";

// Zwiększ timeout dla przygotowania powitań
export const maxDuration = 300; // 5 minut
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { leadIds, refresh = false } = await req.json();
    
    if (!Array.isArray(leadIds) || leadIds.length === 0) {
      return NextResponse.json({ error: "Lista ID leadów jest wymagana" }, { status: 400 });
    }

    console.log(`[PREPARE GREETINGS] Rozpoczynam ${refresh ? 'odświeżanie' : 'przygotowanie'} powitań dla ${leadIds.length} leadów...`);

    // Pobierz leady - różne warunki dla odświeżania vs nowe powitania
    let whereCondition;
    if (refresh) {
      // Odświeżanie - bierz wszystkie leady (nawet z istniejącymi powitaniami)
      whereCondition = {
        id: { in: leadIds }
      };
    } else {
      // Nowe powitania - tylko leady bez powitań
      whereCondition = {
        id: { in: leadIds },
        OR: [
          { status: "NO_GREETING" },
          { greetingForm: null }
        ]
      };
    }

    const leads = await db.lead.findMany({
      where: whereCondition,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        language: true,
        email: true,
        greetingForm: true
      }
    });

    if (leads.length === 0) {
      return NextResponse.json({ 
        message: refresh ? "Nie znaleziono leadów do odświeżenia" : "Brak leadów do przygotowania powitań",
        processedCount: 0 
      });
    }

    console.log(`[PREPARE GREETINGS] Znaleziono ${leads.length} leadów do przetworzenia`);

    // Przygotuj imiona do odmiany
    const namesForProcessing = leads
      .filter(lead => lead.firstName && lead.firstName.trim())
      .map(lead => ({
        id: lead.id,
        firstName: lead.firstName!,
        lastName: lead.lastName || '',
        language: lead.language || 'pl'
      }));

    if (namesForProcessing.length === 0) {
      return NextResponse.json({ 
        message: "Brak imion do przetworzenia",
        processedCount: 0 
      });
    }

    console.log(`[PREPARE GREETINGS] ${namesForProcessing.length} imion do odmiany`);

    // Sprawdź czy ChatGPT API działa
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("Brak OPENAI_API_KEY - przygotowanie powitań niemożliwe");
    }

    // Przygotuj dane dla batchProcessNames
    const firstNames = namesForProcessing.map(lead => lead.firstName || '');
    const lastNames = namesForProcessing.map(lead => lead.lastName || '');
    const languages = namesForProcessing.map(lead => lead.language || 'pl');

    console.log(`[PREPARE GREETINGS] Grupowanie według języków:`, Array.from(new Set(languages)));

    // Stwórz mapę firstName -> greetingForm
    const greetingMap = new Map<string, string>();
    
    console.log(`[PREPARE GREETINGS] Przetwarzanie ${firstNames.length} imion...`);
    
    const chatgptResults = await chatgptService.batchProcessNames(firstNames, lastNames, languages);
    console.log(`[PREPARE GREETINGS] Otrzymano ${chatgptResults.length} odmian`);
    
    namesForProcessing.forEach((lead, index) => {
      const result = chatgptResults[index];
      if (result?.greetingForm) {
        greetingMap.set(lead.firstName || '', result.greetingForm);
        console.log(`[PREPARE GREETINGS] ${lead.firstName} ${lead.lastName || ''} (${lead.language || 'pl'}) → "${result.greetingForm}"`);
      }
    });

    console.log(`[PREPARE GREETINGS] Mapa odmian utworzona (${greetingMap.size} wpisów)`);

    // Aktualizuj leady z nowymi powitaniami
    let processedCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    for (const lead of leads) {
      try {
        const greetingForm = greetingMap.get(lead.firstName || '');
        
        if (greetingForm) {
          await db.lead.update({
            where: { id: lead.id },
            data: {
              greetingForm: greetingForm,
              status: refresh ? "ACTIVE" : "ACTIVE" // Zawsze ustaw na ACTIVE po przygotowaniu/odświeżeniu
            }
          });
          
          processedCount++;
          console.log(`[PREPARE GREETINGS] Zaktualizowano lead ${lead.id} (${lead.email})`);
        } else {
          errorCount++;
          errors.push(`Brak powitania dla: ${lead.firstName} (${lead.email})`);
          console.warn(`[PREPARE GREETINGS] Brak powitania dla: ${lead.firstName}`);
        }
      } catch (error: any) {
        errorCount++;
        errors.push(`Błąd aktualizacji leada ${lead.id}: ${error.message}`);
        console.error(`[PREPARE GREETINGS] Błąd aktualizacji leada ${lead.id}:`, error);
      }
    }

    console.log(`[PREPARE GREETINGS] Zakończono. Zaktualizowano ${processedCount} leadów, ${errorCount} błędów.`);

    return NextResponse.json({
      success: true,
      message: `${refresh ? 'Odświeżono' : 'Przygotowano'} powitania dla ${processedCount} leadów.`,
      processedCount,
      errorCount,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error: any) {
    console.error("[PREPARE GREETINGS] Błąd podczas przygotowania powitań:", error);
    return NextResponse.json(
      { error: `Błąd podczas przygotowania powitań: ${error.message}` },
      { status: 500 }
    );
  }
}