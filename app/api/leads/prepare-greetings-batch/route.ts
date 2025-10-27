import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { chatgptService } from "@/services/chatgptService";
// Removed SSE import - using simple polling instead

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

// Funkcja do przetwarzania pojedynczego setu z retry mechanism
async function processBatch(leadIds: number[], batchNumber: number, totalBatches: number, progressId: string, maxRetries: number = 3): Promise<{ success: number; errors: string[] }> {
  let lastError: any = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[GREETING BATCH] Przetwarzanie setu ${batchNumber}/${totalBatches} (${leadIds.length} leadów) - próba ${attempt}/${maxRetries}`);
      
      // Pobierz leady z bazy - przetwarzaj WSZYSTKIE leady z podanych ID
      const leads = await db.lead.findMany({
        where: { 
          id: { in: leadIds }
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          language: true,
          greetingForm: true,
          status: true
        }
      });

      if (leads.length === 0) {
        console.log(`[GREETING BATCH] Brak leadów do przetworzenia w secie ${batchNumber}`);
        return { success: 0, errors: [] };
      }

      // Filtruj leady które NIE mają powitań lub mają puste powitania
      const leadsToProcess = leads.filter(lead => 
        !lead.greetingForm || 
        lead.greetingForm.trim() === '' ||
        lead.greetingForm === 'Dzień dobry' ||
        lead.greetingForm === 'Hello' ||
        lead.greetingForm === 'Guten Tag' ||
        lead.greetingForm === 'Bonjour' ||
        lead.status === 'NO_GREETING'
      );

      if (leadsToProcess.length === 0) {
        console.log(`[GREETING BATCH] Wszystkie leady w secie ${batchNumber} już mają powitania`);
        return { success: 0, errors: [] };
      }

      console.log(`[GREETING BATCH] Przetwarzam ${leadsToProcess.length} z ${leads.length} leadów w secie ${batchNumber}`);

      // Przygotuj dane dla ChatGPT - NIE FILTRUJ, zachowaj kolejność!
      const firstNames = leadsToProcess.map(lead => lead.firstName || '');
      const lastNames = leadsToProcess.map(lead => lead.lastName || '');
      const languages = leadsToProcess.map(lead => lead.language || 'pl');

      console.log(`[GREETING BATCH] Dane dla ChatGPT (${firstNames.length} leadów):`);
      leadsToProcess.forEach((lead, i) => {
        console.log(`  ${i}: ${lead.firstName} ${lead.lastName || ''} (${lead.language || 'pl'})`);
      });

      if (firstNames.length === 0) {
        console.log(`[GREETING BATCH] Brak imion w secie ${batchNumber}`);
        return { success: 0, errors: [`Set ${batchNumber}: Brak imion do przetworzenia`] };
      }

      // Wywołaj ChatGPT API z timeout
      const chatgptResults = await Promise.race([
        chatgptService.batchProcessNames(firstNames, lastNames, languages),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('ChatGPT API timeout (30s)')), 30000)
        )
      ]) as any;
      
      if (!chatgptResults || !Array.isArray(chatgptResults)) {
        throw new Error('Nieprawidłowa odpowiedź z ChatGPT API');
      }

      // WERYFIKACJA: Sprawdź czy liczba wyników odpowiada liczbie leadów
      if (chatgptResults.length !== leadsToProcess.length) {
        console.error(`[GREETING BATCH] ❌ BŁĄD: Otrzymano ${chatgptResults.length} wyników, oczekiwano ${leadsToProcess.length} leadów`);
        console.error(`[GREETING BATCH] Leady:`, leadsToProcess.map(l => `${l.firstName} ${l.lastName || ''}`).join(', '));
        console.error(`[GREETING BATCH] Wyniki:`, chatgptResults.map(r => r.greetingForm).join(', '));
        throw new Error(`Nieprawidłowa liczba wyników: ${chatgptResults.length} vs ${leadsToProcess.length}`);
      }

      console.log(`[GREETING BATCH] ✅ Otrzymano ${chatgptResults.length} wyników dla ${leadsToProcess.length} leadów`);

      // Zaktualizuj leady w bazie
      let successCount = 0;
      const errors: string[] = [];

      for (let i = 0; i < leadsToProcess.length; i++) {
        try {
          const lead = leadsToProcess[i];
          const chatgptResult = chatgptResults[i];

          if (chatgptResult && chatgptResult.greetingForm) {
            await db.lead.update({
              where: { id: lead.id },
              data: {
                greetingForm: chatgptResult.greetingForm,
                status: 'AKTYWNY' // Używaj polskiego statusu
              }
            });
            successCount++;
            console.log(`[GREETING BATCH] Zaktualizowano lead ${lead.id} (${lead.firstName}): "${chatgptResult.greetingForm}"`);
          } else {
            errors.push(`Lead ${lead.id}: Brak powitania z ChatGPT`);
          }
        } catch (error: any) {
          errors.push(`Lead ${leadsToProcess[i].id}: ${error.message}`);
        }
      }

      console.log(`[GREETING BATCH] Set ${batchNumber} ukończony: ${successCount}/${leads.length} leadów`);
      return { success: successCount, errors };

    } catch (error: any) {
      lastError = error;
      console.error(`[GREETING BATCH] Błąd w secie ${batchNumber} (próba ${attempt}/${maxRetries}):`, error);
      
      // Jeśli to nie ostatnia próba, czekaj przed ponowną próbą
      if (attempt < maxRetries) {
        const delayMs = attempt * 2000; // Zwiększające opóźnienie: 2s, 4s, 6s
        console.log(`[GREETING BATCH] Czekam ${delayMs}ms przed ponowną próbą...`);
        await delay(delayMs);
      }
    }
  }

  // Jeśli wszystkie próby się nie powiodły
  console.error(`[GREETING BATCH] Wszystkie próby nieudane dla setu ${batchNumber}`);
  return { 
    success: 0, 
    errors: [`Set ${batchNumber}: Błąd po ${maxRetries} próbach - ${lastError?.message || 'Nieznany błąd'}`] 
  };
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
  
  const status: 'processing' | 'completed' = currentBatch === totalBatches ? 'completed' : 'processing';
  
  const progressData = {
    currentBatch,
    totalBatches,
    percentage,
    status,
    processedLeads,
    totalLeads,
    estimatedTime,
    startTime,
    errors: [...(greetingProgress.get(progressId)?.errors || []), ...errors]
  };

  greetingProgress.set(progressId, progressData);

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

      // Przetwórz set z retry mechanism
      const result = await processBatch(batches[i], batchNumber, totalBatches, progressId, 3);
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
    const checkActive = searchParams.get('checkActive');

    // Sprawdź czy są aktywne procesy
    if (checkActive === 'true') {
      const activeProcesses = Array.from(greetingProgress.values()).filter(p => p.status === 'processing');
      if (activeProcesses.length > 0) {
        const activeProcess = activeProcesses[0]; // Weź pierwszy aktywny
        return NextResponse.json({
          isActive: true,
          processedLeads: activeProcess.processedLeads,
          totalLeads: activeProcess.totalLeads,
          percentage: activeProcess.percentage,
          estimatedTime: activeProcess.estimatedTime
        });
      } else {
        return NextResponse.json({ isActive: false });
      }
    }

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
