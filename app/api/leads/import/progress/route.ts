import { NextRequest, NextResponse } from 'next/server';

// Globalny store dla postępu importu (w prawdziwej aplikacji użyj Redis lub innej bazy)
const importProgress = new Map<string, {
  total: number;
  processed: number;
  currentStep: string;
  startTime: number;
  estimatedEndTime?: number;
  errors: string[];
}>();

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const importId = searchParams.get('importId');
  
  if (!importId) {
    return NextResponse.json({ error: 'Brak importId' }, { status: 400 });
  }
  
  const progress = importProgress.get(importId);
  
  if (!progress) {
    return NextResponse.json({ error: 'Import nie znaleziony' }, { status: 404 });
  }
  
  const now = Date.now();
  const elapsed = now - progress.startTime;
  const percentage = Math.round((progress.processed / progress.total) * 100);
  
  // Oblicz szacowany czas zakończenia
  let estimatedEndTime = progress.estimatedEndTime;
  if (progress.processed > 0 && !estimatedEndTime) {
    const avgTimePerItem = elapsed / progress.processed;
    estimatedEndTime = now + (avgTimePerItem * (progress.total - progress.processed));
    progress.estimatedEndTime = estimatedEndTime;
  }
  
  const remainingTime = estimatedEndTime ? Math.max(0, estimatedEndTime - now) : null;
  
  return NextResponse.json({
    importId,
    total: progress.total,
    processed: progress.processed,
    percentage,
    currentStep: progress.currentStep,
    elapsed: Math.round(elapsed / 1000), // w sekundach
    remainingTime: remainingTime ? Math.round(remainingTime / 1000) : null,
    errors: progress.errors,
    isComplete: progress.processed >= progress.total
  });
}

export async function POST(request: NextRequest) {
  try {
    const { importId, total, processed, currentStep, error } = await request.json();
    
    if (!importProgress.has(importId)) {
      importProgress.set(importId, {
        total,
        processed: 0,
        currentStep: 'Inicjalizacja...',
        startTime: Date.now(),
        errors: []
      });
    }
    
    const progress = importProgress.get(importId)!;
    
    if (total !== undefined) progress.total = total;
    if (processed !== undefined) progress.processed = processed;
    if (currentStep !== undefined) progress.currentStep = currentStep;
    if (error) progress.errors.push(error);
    
    // Usuń stare importy (starsze niż 2 godziny) - daj więcej czasu na zakończenie
    const twoHoursAgo = Date.now() - (2 * 60 * 60 * 1000);
    for (const [id, p] of importProgress.entries()) {
      if (p.startTime < twoHoursAgo) {
        importProgress.delete(id);
      }
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Błąd aktualizacji postępu' }, { status: 500 });
  }
}
