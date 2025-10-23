'use client';

import { useState, useEffect } from 'react';

interface ImportProgressProps {
  importId: string | null;
  onComplete?: (result: any) => void;
  onError?: (error: string) => void;
}

interface ProgressData {
  importId: string;
  total: number;
  processed: number;
  percentage: number;
  currentStep: string;
  elapsed: number;
  remainingTime: number | null;
  errors: string[];
  isComplete: boolean;
}

export default function ImportProgress({ importId, onComplete, onError }: ImportProgressProps) {
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!importId) {
      setIsVisible(false);
      setProgress(null);
      return;
    }

    console.log('[ImportProgress] Rozpoczynam śledzenie importu:', importId);
    setIsVisible(true);
    
    const pollProgress = async () => {
      try {
        console.log(`[ImportProgress] Pobieram postęp dla importId: ${importId}`);
        const response = await fetch(`/api/leads/import/progress?importId=${importId}`);
        console.log(`[ImportProgress] Odpowiedź: ${response.status}`);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('[ImportProgress] Błąd pobierania postępu:', response.status, errorText);
          
          // Jeśli 404 - import jeszcze nie rozpoczęty, nie pokazuj błędu
          if (response.status === 404) {
            console.log('[ImportProgress] Import jeszcze nie rozpoczęty, czekam...');
            return;
          }
          
          throw new Error('Błąd pobierania postępu');
        }
        
        const data = await response.json();
        console.log('[ImportProgress] Postęp:', data.percentage + '%', data.currentStep);
        setProgress(data);
        
        if (data.isComplete) {
          console.log('[ImportProgress] Import zakończony!');
          if (data.errors.length > 0) {
            onError?.(data.errors.join(', '));
          } else {
            onComplete?.(data);
          }
          // Ukryj wskaźnik po 5 sekundach (zwiększone z 3s)
          setTimeout(() => {
            console.log('[ImportProgress] Ukrywam wskaźnik');
            setIsVisible(false);
          }, 5000);
        }
      } catch (error) {
        console.error('Błąd śledzenia postępu:', error);
        onError?.(error instanceof Error ? error.message : 'Nieznany błąd');
      }
    };

    // Sprawdź postęp co 1 sekundę
    const interval = setInterval(pollProgress, 1000);
    
    // Pierwsze sprawdzenie natychmiast
    pollProgress();

    return () => clearInterval(interval);
  }, [importId, onComplete, onError]);

  if (!isVisible) {
    console.log('[ImportProgress] Nie widoczny - isVisible:', isVisible, 'importId:', importId);
    return null;
  }

  // Jeśli nie mamy jeszcze danych o postępie, pokaż spinner
  if (!progress) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Import leadów</h3>
          <div className="flex flex-col items-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mb-4"></div>
            <p className="text-gray-600">Inicjalizacja importu...</p>
          </div>
        </div>
      </div>
    );
  }

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Import leadów</h3>
          <div className="text-sm text-gray-500">
            {progress.processed}/{progress.total}
          </div>
        </div>

        {/* Pasek postępu */}
        <div className="mb-4">
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div 
              className="bg-red-600 h-3 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progress.percentage}%` }}
            />
          </div>
          <div className="text-center text-sm text-gray-600 mt-1">
            {progress.percentage}%
          </div>
        </div>

        {/* Aktualny krok */}
        <div className="mb-4">
          <div className="text-sm text-gray-700 font-medium">
            {progress.currentStep}
          </div>
        </div>

        {/* Czas */}
        <div className="flex justify-between text-xs text-gray-500 mb-4">
          <span>Uplynęło: {formatTime(progress.elapsed)}</span>
          {progress.remainingTime && (
            <span>Pozostało: {formatTime(progress.remainingTime)}</span>
          )}
        </div>

        {/* Błędy */}
        {progress.errors.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded p-3">
            <div className="text-sm text-red-800 font-medium mb-1">Błędy:</div>
            <div className="text-xs text-red-700">
              {progress.errors.map((error, index) => (
                <div key={index}>• {error}</div>
              ))}
            </div>
          </div>
        )}

        {/* Animacja ładowania */}
        {!progress.isComplete && (
          <div className="flex justify-center mt-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-red-600"></div>
          </div>
        )}

        {/* Status zakończenia */}
        {progress.isComplete && (
          <div className="text-center">
            <div className="text-green-600 font-medium">
              ✅ Import zakończony!
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
