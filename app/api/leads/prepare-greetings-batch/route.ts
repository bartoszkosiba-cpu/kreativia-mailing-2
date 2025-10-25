import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { chatgptService } from "@/services/chatgptService";

// Globalny stan postępu (w produkcji użyj Redis)
const greetingProgress = new Map<string, {
  currentBatch: number;
  totalBatches: number;
  percentage: number;
  status: 'processing' | 'completed' | 'error' | 'stopped';
  processedLeads: number;
  totalLeads: number;
  estimatedTime: string;
  startTime: number;
  errors: string[];
}>();

// Funkcja do dzielenia tablicy na mniejsze części
function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

// Funkcja do obliczania szacowanego czasu
function calculateEstimatedTime(currentBatch: number, totalBatches: number, startTime: number): string {
  if (currentBatch === 0) return "Obliczanie...";
  
  const elapsed = Date.now() - startTime;
  const avgTimePerBatch = elapsed / currentBatch;
  const remainingBatches = totalBatches - currentBatch;
  const estimatedRemaining = avgTimePerBatch * remainingBatches;
  
  const minutes = Math.round(estimatedRemaining / 60000);
  if (minutes < 1) return "< 1 min";
  if (minutes < 60) return `${minutes} min`;
  
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}min`;
}

// Funkcja do opóźnienia
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Funkcja do przetwarzania pojedynczego setu
async function processBatch(leadIds: number[], batchNumber: number, totalBatches: number, progressId: string): Promise<{ success: number; errors: string[] }> {
  try {
    console.log(`[GREETING BATCH] Przetwarzanie setu ${batchNumber}/${totalBatches} (${leadIds.length} leadów)`);
    
    // Pobierz leady z bazy
    const leads = await db.lead.findMany({
      where: { 
        id: { in: leadIds },
        OR: [
          { greetingForm: null },
          { status: 'NO_GREETING' }
        ]
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        language: true
      }
    });

    if (leads.length === 0) {
      console.log(`[GREETING BATCH] Brak leadów do przetworzenia w secie ${batchNumber}`);
      return { success: 0, errors: [] };
    }

    // Przygotuj dane dla ChatGPT
    const firstNames = leads.map(lead => lead.firstName || '').filter(name => name.trim());
    const lastNames = leads.map(lead => lead.lastName || '').filter(name => name.trim());
    const languages = leads.map(lead => lead.language || 'pl');

    if (firstNames.length === 0) {
      console.log(`[GREETING BATCH] Brak imion w secie ${batchNumber}`);
      return { success: 0, errors: [`Set ${batchNumber}: Brak imion do przetworzenia`] };
    }

    // Wywołaj ChatGPT API
    const chatgptResults = await chatgptService.batchProcessNames(firstNames, lastNames, languages);
    
    if (!chatgptResults || !Array.isArray(chatgptResults)) {
      throw new Error('Nieprawidłowa odpowiedź z ChatGPT API');
    }

    // Zaktualizuj leady w bazie
    let successCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < leads.length; i++) {
      try {
        const lead = leads[i];
        const greetingForm = chatgptResults[i] || null;

        if (greetingForm) {
          // ChatGPT zwraca obiekt NameDeclensionResult, ale w bazie greetingForm to String
          const greetingText = typeof greetingForm === 'string' 
            ? greetingForm 
            : greetingForm.greetingForm;
          
          await db.lead.update({
            where: { id: lead.id },
            data: {
              greetingForm: greetingText,
              status: 'AKTYWNY' // Używaj polskiego statusu
            }
          });
          successCount++;
        } else {
          errors.push(`Lead ${lead.id}: Brak powitania z ChatGPT`);
        }
      } catch (error: any) {
        errors.push(`Lead ${leads[i].id}: ${error.message}`);
      }
    }

    console.log(`[GREETING BATCH] Set ${batchNumber} ukończony: ${successCount}/${leads.length} leadów`);
    return { success: successCount, errors };

  } catch (error: any) {
    console.error(`[GREETING BATCH] Błąd w secie ${batchNumber}:`, error);
    return { 
      success: 0, 
      errors: [`Set ${batchNumber}: ${error.message}`] 
    };
  }
}

// Funkcja do aktualizacji postępu
async function updateProgress(
  progressId: string, 
  currentBatch: number, 
  totalBatches: number, 
  processedLeads: number, 
  totalLeads: number,
  startTime: number,
  errors: string[] = []
) {
  const percentage = Math.round((currentBatch / totalBatches) * 100);
  const estimatedTime = calculateEstimatedTime(currentBatch, totalBatches, startTime);
  
  const status = currentBatch === totalBatches ? 'completed' : 'processing';
  
  greetingProgress.set(progressId, {
    currentBatch,
    totalBatches,
    percentage,
    status,
    processedLeads,
    totalLeads,
    estimatedTime,
    startTime,
    errors: [...(greetingProgress.get(progressId)?.errors || []), ...errors]
  });

  console.log(`[GREETING PROGRESS] ${currentBatch}/${totalBatches} (${percentage}%) - ${processedLeads}/${totalLeads} leadów`);
}

export async function POST(req: NextRequest) {
  try {
    const { leadIds, batchSize = 50, delayMs = 2000 } = await req.json();

    if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
      return NextResponse.json({ error: "Nieprawidłowa lista ID leadów" }, { status: 400 });
    }

    // Sprawdź czy leady istnieją
    const existingLeads = await db.lead.findMany({
      where: { id: { in: leadIds } },
      select: { id: true }
    });

    if (existingLeads.length === 0) {
      return NextResponse.json({ error: "Nie znaleziono leadów do przetworzenia" }, { status: 404 });
    }

    // Podziel leady na sety
    const batches = chunkArray(leadIds, batchSize);
    const totalBatches = batches.length;
    const totalLeads = leadIds.length;
    const progressId = `greeting_${Date.now()}`;
    const startTime = Date.now();

    console.log(`[GREETING BATCH] Rozpoczynam generowanie powitań: ${totalLeads} leadów w ${totalBatches} setach po ${batchSize}`);

    // Inicjalizuj progress
    await updateProgress(progressId, 0, totalBatches, 0, totalLeads, startTime);

    // Przetwarzaj setami
    let totalProcessed = 0;
    let allErrors: string[] = [];

    for (let i = 0; i < batches.length; i++) {
      const batchNumber = i + 1;
      
      // Sprawdź czy proces nie został zatrzymany
      const currentProgress = greetingProgress.get(progressId);
      if (currentProgress?.status === 'stopped') {
        console.log(`[GREETING BATCH] Proces zatrzymany przez użytkownika`);
        break;
      }

      // Przetwórz set
      const result = await processBatch(batches[i], batchNumber, totalBatches, progressId);
      totalProcessed += result.success;
      allErrors.push(...result.errors);

      // Zaktualizuj progress
      await updateProgress(progressId, batchNumber, totalBatches, totalProcessed, totalLeads, startTime, result.errors);

      // Opóźnienie między setami (oprócz ostatniego)
      if (i < batches.length - 1) {
        await delay(delayMs);
      }
    }

    // Finalizuj progress
    const finalStatus = greetingProgress.get(progressId)?.status === 'stopped' ? 'stopped' : 'completed';
    greetingProgress.set(progressId, {
      ...greetingProgress.get(progressId)!,
      status: finalStatus
    });

    console.log(`[GREETING BATCH] Zakończono: ${totalProcessed}/${totalLeads} leadów przetworzonych`);

    return NextResponse.json({
      success: true,
      message: `Przetworzono ${totalProcessed} z ${totalLeads} leadów`,
      progressId,
      processedLeads: totalProcessed,
      totalLeads,
      errors: allErrors.length > 0 ? allErrors : undefined
    });

  } catch (error: any) {
    console.error("Błąd generowania powitań:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Endpoint do pobierania postępu
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const progressId = searchParams.get('progressId');

    if (!progressId) {
      return NextResponse.json({ error: "Brak ID postępu" }, { status: 400 });
    }

    const progress = greetingProgress.get(progressId);
    if (!progress) {
      return NextResponse.json({ error: "Nie znaleziono postępu" }, { status: 404 });
    }

    return NextResponse.json(progress);
  } catch (error: any) {
    console.error("Błąd pobierania postępu:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Endpoint do zatrzymania procesu
export async function DELETE(req: NextRequest) {
  try {
    const { progressId } = await req.json();

    if (!progressId) {
      return NextResponse.json({ error: "Brak ID postępu" }, { status: 400 });
    }

    const progress = greetingProgress.get(progressId);
    if (progress) {
      progress.status = 'stopped';
      greetingProgress.set(progressId, progress);
    }

    return NextResponse.json({ success: true, message: "Proces zatrzymany" });
  } catch (error: any) {
    console.error("Błąd zatrzymywania procesu:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
