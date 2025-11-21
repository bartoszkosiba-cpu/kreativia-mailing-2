import { useState, useEffect } from "react";
import { CompanyStats } from "@/types/company-selection";

interface UseCompanyStatsReturn {
  stats: CompanyStats;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Custom hook do zarządzania statystykami firm
 * 
 * @returns Obiekt z statystykami, stanem ładowania, błędem i funkcją do odświeżania
 * 
 * @example
 * const { stats, loading, error, refetch } = useCompanyStats();
 */
export function useCompanyStats(): UseCompanyStatsReturn {
  const [stats, setStats] = useState<CompanyStats>({
    pending: 0,
    qualified: 0,
    rejected: 0,
    needsReview: 0,
    total: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStats = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch("/api/company-selection/stats");
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Nie udało się pobrać statystyk`);
      }
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || "Nie udało się pobrać statystyk");
      }
      
      setStats({
        pending: data.pending || 0,
        qualified: data.qualified || 0,
        rejected: data.rejected || 0,
        needsReview: data.needsReview || 0,
        total: data.total || 0,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Nieznany błąd podczas ładowania statystyk";
      setError(errorMessage);
      console.error("Błąd ładowania statystyk:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  return { stats, loading, error, refetch: loadStats };
}

