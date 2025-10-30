"use client";

import React, { useState, useEffect, useCallback } from "react";

// Removed spinner CSS - keeping it simple
import Link from "next/link";
import StatusLegend from "@/components/StatusLegend";
// import { StatusBadge, PriorityBadge } from "@/components/StatusBadge";
// import { getStatusLabel, getSubStatusLabel } from "@/lib/statusHelpers";

interface Lead {
  id: number;
  firstName: string | null;
  lastName: string | null;
  title: string | null;
  company: string | null;
  email: string;
  industry: string | null;
  websiteUrl: string | null;
  linkedinUrl: string | null;
  companyCity: string | null;
  companyCountry: string | null;
  language: string | null;
  greetingForm: string | null;
  status: string;
  subStatus: string | null;
  blockedReason: string | null;
  isBlocked: boolean;
  LeadTag?: Array<{ tag: { id: number; name: string; color: string } }>;
}

// Funkcje pomocnicze do formatowania danych
const getIndustryName = (keywords: string | null): string => {
  if (!keywords) return "-";
  
  // Branża to teraz słowa kluczowe z CSV
  // Wyświetl pierwsze 50 znaków słów kluczowych
  if (keywords.length > 50) {
    return keywords.substring(0, 50) + "...";
  }
  
  return keywords;
};

const extractCityFromAddress = (companyCity: string | null): string => {
  // companyCity zawiera wartość z pola "State" z CSV
  // Wyświetl bezpośrednio (np. "Greater Poland Voivodeship", "Masovian Voivodeship")
  if (!companyCity) return "-";
  return companyCity;
};

const extractCountryFromAddress = (companyCountry: string | null): string => {
  // companyCountry zawiera wartość z pola "Company Address" z CSV
  // Wyciągnij tylko kraj z pełnego adresu
  if (!companyCountry) return "-";
  
  // Szukaj kraju w adresie (najczęściej na końcu)
  const countryPatterns = [
    /,\s*(Poland|Germany|France|United Kingdom|UK|USA|United States|Italy|Spain|Netherlands|Holland|Belgium|Austria|Switzerland|Czech Republic|Slovakia|Hungary|Romania|Bulgaria|Croatia|Slovenia|Serbia|Ukraine|Lithuania|Latvia|Estonia|Denmark|Sweden|Norway|Finland|Ireland|Portugal|Greece)$/i,
    /\b(Poland|Germany|France|United Kingdom|UK|USA|United States|Italy|Spain|Netherlands|Holland|Belgium|Austria|Switzerland|Czech Republic|Slovakia|Hungary|Romania|Bulgaria|Croatia|Slovenia|Serbia|Ukraine|Lithuania|Latvia|Estonia|Denmark|Sweden|Norway|Finland|Ireland|Portugal|Greece)\b/i
  ];
  
  for (const pattern of countryPatterns) {
    const match = companyCountry.match(pattern);
    if (match) {
      return match[1];
    }
  }
  
  // Jeśli nie znaleziono kraju, wyświetl pierwsze 40 znaków
  if (companyCountry.length > 40) {
    return companyCountry.substring(0, 40) + "...";
  }
  
  return companyCountry;
};

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showDeleteOptions, setShowDeleteOptions] = useState(false);
  const [selectedLeadIds, setSelectedLeadIds] = useState<number[]>([]);
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [showTagManager, setShowTagManager] = useState(false);
  const [greetingProgress, setGreetingProgress] = useState<{
    isActive: boolean;
    progressId: string | null;
    currentBatch: number;
    totalBatches: number;
    percentage: number;
    processedLeads: number;
    totalLeads: number;
    estimatedTime: string;
    status: 'processing' | 'completed' | 'error';
  } | null>(null);
  const [tags, setTags] = useState<Array<{ id: number; name: string; color: string }>>([]);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    title: "",
    company: "",
    email: "",
    industry: "",
    websiteUrl: "",
    linkedinUrl: "",
    companyCity: "",
    companyCountry: "",
    language: "pl"
  });
  const [greetingPreview, setGreetingPreview] = useState("");

  // Paginacja
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [totalLeads, setTotalLeads] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // Filtry
  const [search, setSearch] = useState("");
  const [selectedLanguage, setSelectedLanguage] = useState("");
  const [selectedCountry, setSelectedCountry] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [selectedTag, setSelectedTag] = useState("");
  const [selectedIndustry, setSelectedIndustry] = useState("");

  // Statystyki
  const [stats, setStats] = useState({
    total: 0,
    countries: [] as Array<{ country: string; count: number }>,
    languages: [] as Array<{ language: string; count: number }>,
    statuses: [] as Array<{ status: string; count: number }>,
    industries: [] as Array<{ industry: string; count: number }>,
    greetings: { with: 0, without: 0 }
  });

  const fetchLeads = async (page = currentPage, limit = itemsPerPage) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.append("page", page.toString());
      params.append("limit", limit.toString());
      
      if (search) params.append("search", search);
      if (selectedLanguage) params.append("language", selectedLanguage);
      if (selectedCountry) params.append("country", selectedCountry);
      if (selectedStatus) params.append("status", selectedStatus);
      if (selectedTag && selectedTag !== "") {
        params.append("tagId", selectedTag.toString());
      }
      if (selectedIndustry) params.append("industry", selectedIndustry);

      const response = await fetch(`/api/leads?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setLeads(data.leads || []);
        setTotalLeads(data.pagination?.total || 0);
        setTotalPages(data.pagination?.totalPages || 0);
        setStats(data.stats || {});
      } else {
        console.error("Response not ok:", response.status);
      }
    } catch (error) {
      console.error("Błąd pobierania leadów:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTags = async () => {
    try {
      const response = await fetch("/api/tags");
      if (response.ok) {
        const data = await response.json();
        setTags(data);
      }
    } catch (error) {
      console.error("Błąd pobierania tagów:", error);
    }
  };

  // Początkowe ładowanie
  useEffect(() => {
    const loadData = async () => {
      await fetchLeads(1, 50);
      await fetchTags();
    };
    
    loadData().catch(console.error);
  }, []);

  // Re-fetch przy zmianie filtrów/paginacji (tylko po pierwszym ładowaniu)
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  
  useEffect(() => {
    if (isInitialLoad) {
      setIsInitialLoad(false);
      return;
    }
    fetchLeads(currentPage, itemsPerPage);
  }, [currentPage, itemsPerPage, search, selectedLanguage, selectedCountry, selectedStatus, selectedTag, selectedIndustry]);

  // Sprawdź odmianę imienia przy zmianie
  useEffect(() => {
    const checkGreeting = async () => {
      if (formData.firstName && formData.firstName.trim()) {
        try {
          const response = await fetch("http://localhost:8001/vocative", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              firstName: formData.firstName,
              language: formData.language
            })
          });
          
          if (response.ok) {
            const data = await response.json();
            setGreetingPreview(data.greeting);
          } else {
            setGreetingPreview("Dzień dobry");
          }
        } catch (error) {
          setGreetingPreview("Dzień dobry");
        }
      } else {
        setGreetingPreview("");
      }
    };

    // Debounce - sprawdź po 500ms od ostatniej zmiany
    const timeoutId = setTimeout(checkGreeting, 500);
    return () => clearTimeout(timeoutId);
  }, [formData.firstName, formData.language]);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        alert("✅ Lead dodany!");
        setShowForm(false);
        setFormData({
          firstName: "",
          lastName: "",
          title: "",
          company: "",
          email: "",
          industry: "",
          websiteUrl: "",
          linkedinUrl: "",
          companyCity: "",
          companyCountry: "",
          language: "pl"
        });
        fetchLeads();
      } else {
        const error = await response.json();
        alert(`❌ Błąd: ${error.error}`);
      }
    } catch (error) {
      alert("❌ Błąd dodawania leada");
    }
  };

  const handleDelete = async (type: "all" | "tag", tagId?: number) => {
    const confirmMessage = type === "all" 
      ? `Czy na pewno chcesz usunąć WSZYSTKICH leadów? (${leads.length} rekordów)\n\nTa operacja jest nieodwracalna!`
      : `Czy na pewno chcesz usunąć wszystkich leadów z tym tagiem?\n\nTa operacja jest nieodwracalna!`;

    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      const url = type === "all" 
        ? "/api/leads/delete?type=all"
        : `/api/leads/delete?type=tag&tagId=${tagId}`;

      const response = await fetch(url, { method: "DELETE" });
      
      if (response.ok) {
        const result = await response.json();
        alert(`✅ ${result.message}`);
        setShowDeleteOptions(false);
        fetchLeads();
      } else {
        const error = await response.json();
        alert(`❌ Błąd: ${error.error}`);
      }
    } catch (error) {
      console.error("Błąd usuwania leadów:", error);
      alert("❌ Wystąpił błąd podczas usuwania leadów");
    }
  };

  const handleDeleteSingle = async (leadId: number, leadName: string) => {
    if (!confirm(`Czy na pewno chcesz usunąć leada "${leadName}"?\n\nTa operacja jest nieodwracalna!`)) {
      return;
    }

    try {
      const response = await fetch(`/api/leads/delete?type=single&leadId=${leadId}`, { 
        method: "DELETE" 
      });
      
      if (response.ok) {
        alert("✅ Lead został usunięty");
        fetchLeads();
      } else {
        const error = await response.json();
        alert(`❌ Błąd: ${error.error}`);
      }
    } catch (error) {
      console.error("Błąd usuwania leada:", error);
      alert("❌ Wystąpił błąd podczas usuwania leada");
    }
  };

  // Funkcje do obsługi zaznaczania leadów
  const handleLeadSelect = (leadId: number) => {
    setSelectedLeadIds(prev => 
      prev.includes(leadId) 
        ? prev.filter(id => id !== leadId)
        : [...prev, leadId]
    );
  };

  const handleSelectAll = () => {
    if (selectedLeadIds.length === leads.length) {
      setSelectedLeadIds([]);
    } else {
      setSelectedLeadIds(leads.map(lead => lead.id));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedLeadIds.length === 0) {
      alert("Nie wybrano żadnych leadów do usunięcia");
      return;
    }

    const confirmMessage = `Czy na pewno chcesz usunąć ${selectedLeadIds.length} zaznaczonych leadów?\n\nTa operacja jest nieodwracalna!`;
    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      const response = await fetch("/api/leads/bulk-delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadIds: selectedLeadIds })
      });

      if (response.ok) {
        alert(`✅ Usunięto ${selectedLeadIds.length} leadów`);
        setSelectedLeadIds([]);
        fetchLeads();
      } else {
        const error = await response.json();
        alert(`❌ Błąd: ${error.error}`);
      }
    } catch (error) {
      console.error("Błąd usuwania leadów:", error);
      alert("❌ Wystąpił błąd podczas usuwania leadów");
    }
  };

  // Funkcja do sprawdzania postępu generowania powitań
  const checkGreetingProgress = async (progressId: string) => {
    try {
      const response = await fetch(`/api/leads/prepare-greetings-batch?progressId=${progressId}`);
      if (response.ok) {
        const progress = await response.json();
        setGreetingProgress({
          isActive: progress.status === 'processing',
          progressId,
          currentBatch: progress.currentBatch,
          totalBatches: progress.totalBatches,
          percentage: progress.percentage,
          processedLeads: progress.processedLeads,
          totalLeads: progress.totalLeads,
          estimatedTime: progress.estimatedTime,
          status: progress.status
        });

        // Jeśli proces się zakończył, odśwież dane i wyczyść interval
        if (progress.status === 'completed') {
          if ((window as any).greetingProgressInterval) {
            clearInterval((window as any).greetingProgressInterval);
            delete (window as any).greetingProgressInterval;
          }
          fetchLeads();
          setTimeout(() => setGreetingProgress(null), 3000); // Ukryj modal po 3 sekundach
        }
      }
    } catch (error) {
      console.error("Błąd sprawdzania postępu:", error);
    }
  };

  // Funkcja do wysyłania powiadomień dla leadów bez powitań (tylko wyfiltrowane)
  const handleSendNotifications = async () => {
    if (stats.greetings.without === 0) {
      alert("Wszystkie wyfiltrowane leady już mają powitania!");
      return;
    }

    // Skonstruuj parametry URL z aktualnymi filtrami
    const params = new URLSearchParams();
    params.append("withoutGreetings", "true");
    params.append("limit", "1000"); // Duży limit żeby pobrać wszystkie wyfiltrowane
    
    if (search) params.append("search", search);
    if (selectedLanguage) params.append("language", selectedLanguage);
    if (selectedCountry) params.append("country", selectedCountry);
    if (selectedStatus) params.append("status", selectedStatus);
    if (selectedTag && selectedTag !== "") params.append("tagId", selectedTag.toString());
    if (selectedIndustry) params.append("industry", selectedIndustry);

    // Najpierw sprawdź ile jest leadów bez powitań spełniających filtry
    const checkResponse = await fetch(`/api/leads?${params.toString()}`);
    if (!checkResponse.ok) {
      alert("Błąd podczas sprawdzania leadów");
      return;
    }
    
    const checkData = await checkResponse.json();
    const leadsWithoutGreetings = checkData.leads || [];
    
    if (leadsWithoutGreetings.length === 0) {
      alert("Brak leadów bez powitań spełniających aktualne filtry!");
      return;
    }

    const filterInfo = [];
    if (search) filterInfo.push(`wyszukiwanie: "${search}"`);
    if (selectedLanguage) filterInfo.push(`język: ${selectedLanguage}`);
    if (selectedCountry) filterInfo.push(`kraj: ${selectedCountry}`);
    if (selectedStatus) filterInfo.push(`status: ${selectedStatus}`);
    if (selectedTag && selectedTag !== "") {
      const tagName = tags.find(t => String(t.id) === selectedTag)?.name || `ID: ${selectedTag}`;
      filterInfo.push(`tag: ${tagName}`);
    }
    if (selectedIndustry) filterInfo.push(`branża: ${selectedIndustry}`);
    
    const filterText = filterInfo.length > 0 ? ` (filtry: ${filterInfo.join(", ")})` : "";
    
    if (!confirm(`Wygeneruj powitania dla ${leadsWithoutGreetings.length} wyfiltrowanych leadów bez powitań${filterText}?`)) {
      return;
    }

    // Pokaż modal z postępem od razu
    const totalBatches = Math.ceil(leadsWithoutGreetings.length / 25);
    setGreetingProgress({
      isActive: true,
      progressId: null, // Tymczasowo null, zaktualizujemy gdy otrzymamy z API
      currentBatch: 0,
      totalBatches: totalBatches,
      percentage: 0,
      processedLeads: 0,
      totalLeads: leadsWithoutGreetings.length,
      estimatedTime: "Rozpoczynam...",
      status: 'processing'
    });

    try {
      const response = await fetch("/api/leads/prepare-greetings-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadIds: leadsWithoutGreetings.map((lead: any) => lead.id),
          batchSize: 25,
          delayMs: 2000
        })
      });

      if (response.ok) {
        const result = await response.json();
        
        // Zaktualizuj modal z prawdziwym progressId i rozpocznij polling
        if (result.progressId) {
          setGreetingProgress(prev => prev ? {
            ...prev,
            progressId: result.progressId,
            estimatedTime: "Obliczanie..."
          } : null);

          // Rozpocznij polling co 2 sekundy
          const intervalId = setInterval(() => {
            checkGreetingProgress(result.progressId);
          }, 2000);

          // Zapisz interval ID do późniejszego wyczyszczenia
          (window as any).greetingProgressInterval = intervalId;

          // Zatrzymaj polling po 10 minutach (bezpieczeństwo)
          setTimeout(() => {
            if ((window as any).greetingProgressInterval) {
              clearInterval((window as any).greetingProgressInterval);
              delete (window as any).greetingProgressInterval;
            }
            setGreetingProgress(prev => prev ? { ...prev, isActive: false } : null);
          }, 600000);
        } else {
          // Jeśli nie ma progressId, zakończ proces
          setGreetingProgress({
            isActive: false,
            progressId: null,
            currentBatch: totalBatches,
            totalBatches: totalBatches,
            percentage: 100,
            processedLeads: leadsWithoutGreetings.length,
            totalLeads: leadsWithoutGreetings.length,
            estimatedTime: "Zakończono",
            status: 'completed'
          });
          setTimeout(() => {
            setGreetingProgress(null);
            fetchLeads();
          }, 2000);
        }
      } else {
        const error = await response.json();
        setGreetingProgress(null);
        alert(`Błąd: ${error.error}`);
      }
    } catch (error) {
      console.error("Błąd generowania powitań:", error);
      setGreetingProgress(null);
      alert("Błąd podczas generowania powitań");
    }
  };

  // Funkcja do generowania powitań dla zaznaczonych leadów
  const handleGenerateGreetingsForSelected = async () => {
    if (selectedLeadIds.length === 0) {
      alert("Nie wybrano żadnych leadów");
      return;
    }

    const selectedLeads = leads.filter(lead => selectedLeadIds.includes(lead.id));
    const leadsWithoutGreeting = selectedLeads.filter(lead => 
      lead.status === "NO_GREETING" || !lead.greetingForm
    );

    if (leadsWithoutGreeting.length === 0) {
      alert("Wszystkie wybrane leady już mają przygotowane powitania!");
      return;
    }

    if (!confirm(`Przygotować powitania dla ${leadsWithoutGreeting.length} z ${selectedLeadIds.length} wybranych leadów?`)) {
      return;
    }

    try {
      const response = await fetch("/api/leads/prepare-greetings-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          leadIds: selectedLeadIds, 
          batchSize: 25,
          delayMs: 2000
        })
      });

      if (response.ok) {
        const result = await response.json();
        console.log("Batch processing started:", result);
        
        // Zamknij panel i odśwież dane
        setSelectedLeadIds([]);
        setShowBulkActions(false);
        fetchLeads(); // Odśwież dane żeby zobaczyć nowe powitania
      } else {
        const error = await response.json();
        alert(`❌ Błąd: ${error.error}`);
      }
    } catch (error) {
      console.error("Błąd generowania powitań:", error);
      alert("Błąd podczas generowania powitań");
    }
  };

  // Removed handleStopGreetingGeneration - starting fresh

  // Removed handleGenerateAllGreetings - starting fresh

  // Removed polling - keeping it simple

  // Funkcje paginacji
  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    fetchLeads();
  };

  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1);
    fetchLeads();
  };

  // Funkcje filtrowania
  const clearFilters = () => {
    setSearch("");
    setSelectedLanguage("");
    setSelectedCountry("");
    setSelectedStatus("");
    setSelectedTag("");
    setSelectedIndustry("");
    setCurrentPage(1);
    fetchLeads();
  };


  // Usunięto stare funkcje - używamy nowych z statusHelpers

  if (isLoading && leads.length === 0) {
    return (
      <main className="container" style={{ paddingTop: "var(--spacing-xl)" }}>
        <h1>Ładowanie leadów...</h1>
      </main>
    );
  }

  return (
    <main className="container" style={{ paddingTop: "var(--spacing-xl)", paddingBottom: "var(--spacing-2xl)" }}>
      <div className="flex-between" style={{ marginBottom: "var(--spacing-lg)" }}>
        <div>
          <h1>Baza kontaktów</h1>
          <p style={{ color: "var(--gray-600)" }}>
            Wszystkie leady ({totalLeads} rekordów)
            {selectedLeadIds.length > 0 && (
              <span style={{ color: "var(--primary)", fontWeight: "bold" }}>
                {" "}• Zaznaczono: {selectedLeadIds.length}
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Panel akcji zbiorczych */}
      {showBulkActions && (
        <div className="card" style={{ marginBottom: "var(--spacing-lg)", border: "2px solid var(--warning)" }}>
          <h3 style={{ color: "var(--warning)", marginBottom: "var(--spacing-md)" }}>
            🔧 Zarządzanie zaznaczonymi leadami ({selectedLeadIds.length})
          </h3>
          <div className="flex gap-md">
            <button 
              onClick={() => handleGenerateGreetingsForSelected()}
              className="btn btn-success"
              disabled={isLoading}
            >
              Generuj powitania
            </button>
            <button 
              onClick={() => setShowTagManager(true)}
              className="btn btn-primary"
            >
              🏷️ Zarządzaj tagami
            </button>
            <button 
              onClick={handleBulkDelete}
              className="btn btn-danger"
            >
              Usuń zaznaczone
            </button>
            <button 
              onClick={() => {
                setShowBulkActions(false);
                setSelectedLeadIds([]);
              }}
              className="btn btn-secondary"
            >
              ❌ Anuluj
            </button>
          </div>
        </div>
      )}

      {/* Removed progress banner - keeping it simple */}

      {/* Statystyki */}
      <div className="grid grid-4" style={{ marginBottom: "var(--spacing-2xl)" }}>
        <div className="card" style={{ textAlign: "center" }}>
          <h3 style={{ color: "var(--gray-900)", marginBottom: "var(--spacing-xs)" }}>Wszystkie leady</h3>
          <div style={{ fontSize: "1.5rem", fontWeight: "bold", color: "var(--primary)" }}>
            {stats.total}
          </div>
        </div>
        <div className="card" style={{ textAlign: "center" }}>
          <h3 style={{ color: "var(--gray-900)", marginBottom: "var(--spacing-xs)" }}>Z powitaniami</h3>
          <div style={{ fontSize: "1.5rem", fontWeight: "bold", color: "var(--success)" }}>
            {stats.greetings.with}
          </div>
          {/* Removed progress info - keeping it simple */}
        </div>
        <div className="card" style={{ textAlign: "center" }}>
          <h3 style={{ color: "var(--gray-900)", marginBottom: "var(--spacing-xs)" }}>Bez powitań</h3>
          <div style={{ fontSize: "1.5rem", fontWeight: "bold", color: "var(--warning)" }}>
            {stats.greetings.without}
          </div>
        </div>
        <div className="card" style={{ textAlign: "center" }}>
          <h3 style={{ color: "var(--gray-900)", marginBottom: "var(--spacing-xs)" }}>Kraje</h3>
          <div style={{ fontSize: "1.5rem", fontWeight: "bold", color: "var(--info)" }}>
            {stats.countries.length}
          </div>
        </div>
      </div>

      {/* Filtry */}
      <div className="card" style={{ marginBottom: "var(--spacing-2xl)" }}>
        <h2 style={{ marginBottom: "var(--spacing-lg)" }}>Filtry i wyszukiwanie</h2>
        
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "var(--spacing-md)" }}>
          <div>
            <label style={{ display: "block", marginBottom: "var(--spacing-xs)", fontWeight: "600" }}>
              Wyszukiwanie
            </label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Szukaj w imieniu, nazwisku, emailu, firmie..."
              style={{ width: "100%", padding: "var(--spacing-sm)", border: "1px solid var(--gray-300)", borderRadius: "var(--radius)" }}
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "var(--spacing-xs)", fontWeight: "600" }}>
              Język
            </label>
            <select
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              style={{ width: "100%", padding: "var(--spacing-sm)", border: "1px solid var(--gray-300)", borderRadius: "var(--radius)" }}
            >
              <option value="">Wszystkie</option>
              <option value="pl">Polski</option>
              <option value="en">Angielski</option>
              <option value="de">Niemiecki</option>
              <option value="fr">Francuski</option>
            </select>
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "var(--spacing-xs)", fontWeight: "600" }}>
              Kraj
            </label>
            <select
              value={selectedCountry}
              onChange={(e) => setSelectedCountry(e.target.value)}
              style={{ width: "100%", padding: "var(--spacing-sm)", border: "1px solid var(--gray-300)", borderRadius: "var(--radius)" }}
            >
              <option value="">Wszystkie</option>
              {stats.countries.map((country) => (
                <option key={country.country} value={country.country}>
                  {country.country} ({country.count})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "var(--spacing-xs)", fontWeight: "600" }}>
              Status
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              style={{ width: "100%", padding: "var(--spacing-sm)", border: "1px solid var(--gray-300)", borderRadius: "var(--radius)" }}
            >
              <option value="">Wszystkie</option>
              {stats.statuses.map((status) => (
                <option key={status.status} value={status.status}>
                  {status.status} ({status.count})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "var(--spacing-xs)", fontWeight: "600" }}>
              Tag
            </label>
            <select
              value={selectedTag}
              onChange={(e) => {
                setSelectedTag(e.target.value);
                setCurrentPage(1); // Resetuj stronę przy zmianie filtra
              }}
              style={{ width: "100%", padding: "var(--spacing-sm)", border: "1px solid var(--gray-300)", borderRadius: "var(--radius)" }}
            >
              <option value="">Wszystkie</option>
              {tags.map((tag) => (
                <option key={tag.id} value={String(tag.id)}>
                  {tag.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "var(--spacing-xs)", fontWeight: "600" }}>
              Branża
            </label>
            <select
              value={selectedIndustry}
              onChange={(e) => setSelectedIndustry(e.target.value)}
              style={{ width: "100%", padding: "var(--spacing-sm)", border: "1px solid var(--gray-300)", borderRadius: "var(--radius)" }}
            >
              <option value="">Wszystkie</option>
              {stats.industries.map((industry) => (
                <option key={industry.industry} value={industry.industry}>
                  {industry.industry} ({industry.count})
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", alignItems: "end" }}>
            <button
              onClick={clearFilters}
              style={{
                padding: "var(--spacing-sm) var(--spacing-lg)",
                backgroundColor: "var(--gray-500)",
                color: "white",
                border: "none",
                borderRadius: "var(--radius)",
                cursor: "pointer",
                fontWeight: "600"
              }}
            >
              Wyczyść filtry
            </button>
          </div>
        </div>
      </div>

      {/* Legenda statusów */}
      <StatusLegend />

      {/* Panel zarządzania tagami */}
      {showTagManager && (
        <div className="card" style={{ marginBottom: "var(--spacing-lg)", border: "2px solid var(--primary)" }}>
          <h3 style={{ color: "var(--primary)", marginBottom: "var(--spacing-md)" }}>
            🏷️ Zarządzanie tagami dla {selectedLeadIds.length} leadów
          </h3>
          <TagManager 
            selectedLeadIds={selectedLeadIds}
            tags={tags}
            onClose={() => setShowTagManager(false)}
            onSuccess={() => {
              setShowTagManager(false);
              setSelectedLeadIds([]);
              fetchLeads();
            }}
          />
        </div>
      )}

      {/* Panel usuwania */}
      {showDeleteOptions && (
        <div className="card" style={{ marginBottom: "var(--spacing-lg)", border: "2px solid var(--danger)" }}>
          <h3 style={{ color: "var(--danger)", marginBottom: "var(--spacing-md)" }}>Opcje usuwania leadów</h3>
          <div className="flex gap-md">
            <button 
              onClick={() => handleDelete("all")}
              className="btn btn-danger"
            >
              🚨 Usuń WSZYSTKICH leadów ({leads.length})
            </button>
            <button 
              onClick={() => setShowDeleteOptions(false)}
              className="btn btn-secondary"
            >
              ❌ Anuluj
            </button>
          </div>
          <p style={{ color: "var(--gray-600)", marginTop: "var(--spacing-sm)", fontSize: "0.9em" }}>
            ⚠️ Uwaga: Ta operacja jest nieodwracalna!
          </p>
        </div>
      )}

      {/* Formularz dodawania */}
      {showForm && (
        <div className="card" style={{ marginBottom: "var(--spacing-lg)" }}>
          <h2>➕ Nowy lead</h2>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-2" style={{ marginBottom: "var(--spacing-md)" }}>
              <div>
                <label>Imię *</label>
                <input
                  type="text"
                  required
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                />
              </div>
              <div>
                <label>Nazwisko *</label>
                <input
                  type="text"
                  required
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-2" style={{ marginBottom: "var(--spacing-md)" }}>
              <div>
                <label>Email *</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div>
                <label>Stanowisko</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-2" style={{ marginBottom: "var(--spacing-md)" }}>
              <div>
                <label>Firma</label>
                <input
                  type="text"
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                />
              </div>
              <div>
                <label>Branża</label>
                <input
                  type="text"
                  value={formData.industry}
                  onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-2" style={{ marginBottom: "var(--spacing-md)" }}>
              <div>
                <label>Website</label>
                <input
                  type="text"
                  placeholder="www.firma.pl"
                  value={formData.websiteUrl}
                  onChange={(e) => setFormData({ ...formData, websiteUrl: e.target.value })}
                />
              </div>
              <div>
                <label>LinkedIn</label>
                <input
                  type="text"
                  placeholder="linkedin.com/in/..."
                  value={formData.linkedinUrl}
                  onChange={(e) => setFormData({ ...formData, linkedinUrl: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-3" style={{ marginBottom: "var(--spacing-md)" }}>
              <div>
                <label>Miasto</label>
                <input
                  type="text"
                  value={formData.companyCity}
                  onChange={(e) => setFormData({ ...formData, companyCity: e.target.value })}
                />
              </div>
              <div>
                <label>Kraj</label>
                <input
                  type="text"
                  value={formData.companyCountry}
                  onChange={(e) => setFormData({ ...formData, companyCountry: e.target.value })}
                />
              </div>
              <div>
                <label>Język</label>
                <select
                  value={formData.language}
                  onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                >
                  <option value="pl">Polski</option>
                  <option value="en">Angielski</option>
                  <option value="de">Niemiecki</option>
                  <option value="fr">Francuski</option>
                </select>
              </div>
            </div>

            {/* Preview powitania */}
            {greetingPreview && (
              <div style={{ 
                padding: "var(--spacing-md)", 
                backgroundColor: "var(--gray-50)", 
                borderRadius: "var(--radius)",
                marginBottom: "var(--spacing-md)",
                border: "1px solid var(--gray-200)"
              }}>
                <label style={{ fontSize: "12px", color: "var(--gray-600)", marginBottom: "var(--spacing-xs)" }}>
                  Podgląd powitania:
                </label>
                <div style={{ 
                  fontStyle: "italic", 
                  color: "var(--primary)",
                  fontWeight: "500"
                }}>
                  "{greetingPreview}"
                </div>
              </div>
            )}

            <div className="flex gap-sm">
              <button type="submit" className="btn btn-success">
                💾 Zapisz
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="btn btn-secondary">
                Anuluj
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Przyciski akcji - przeniesione nad tabelę */}
      <div style={{ marginBottom: "var(--spacing-lg)" }}>
        <div className="flex gap-sm" style={{ justifyContent: "flex-start", flexWrap: "wrap" }}>
          <Link href="/import">
            <button className="btn btn-primary">
              Import CSV
            </button>
          </Link>
          <button 
            onClick={() => setShowForm(!showForm)}
            className="btn btn-success"
          >
            {showForm ? "❌ Anuluj" : "➕ Dodaj leada"}
          </button>
          {selectedLeadIds.length > 0 && (
            <button
              onClick={() => setShowBulkActions(!showBulkActions)}
              className="btn btn-warning"
            >
              🔧 Zarządzaj zaznaczonymi ({selectedLeadIds.length})
            </button>
          )}
          <button
            onClick={handleSendNotifications}
            className="btn btn-primary"
            disabled={stats.greetings.without === 0}
          >
            Wygeneruj powitania ({stats.greetings.without})
          </button>
          <button 
            onClick={() => setShowDeleteOptions(!showDeleteOptions)}
            className="btn btn-danger"
            disabled={leads.length === 0}
          >
            Usuń leady
          </button>
        </div>
      </div>

      {/* Tabela leadów */}
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--spacing-lg)" }}>
          <h2>Lista Leadów</h2>
          
          {/* Kontrolki paginacji */}
          <div style={{ display: "flex", alignItems: "center", gap: "var(--spacing-md)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--spacing-sm)" }}>
              <label style={{ fontSize: "14px", fontWeight: "600" }}>Wierszy na stronę:</label>
              <select
                value={itemsPerPage}
                onChange={(e) => handleItemsPerPageChange(parseInt(e.target.value))}
                style={{ padding: "4px 8px", border: "1px solid var(--gray-300)", borderRadius: "var(--radius)" }}
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={200}>200</option>
              </select>
            </div>
            
            <div style={{ fontSize: "14px", color: "var(--gray-600)" }}>
              {totalLeads > 0 ? (
                <>Strona {currentPage} z {totalPages} ({totalLeads} leadów)</>
              ) : (
                "Brak leadów"
              )}
            </div>
          </div>
        </div>
        
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    checked={selectedLeadIds.length === leads.length && leads.length > 0}
                    onChange={handleSelectAll}
                    style={{ marginRight: 8 }}
                  />
                  #
                </th>
                <th>Imię</th>
                <th>Nazwisko</th>
                <th>Odmiana imienia</th>
                <th>Stanowisko</th>
                <th>Firma</th>
                <th>Email</th>
                <th>Branża</th>
                <th>Miasto</th>
                <th>Kraj</th>
                <th className="sticky-column sticky-column-right-4">Język</th>
                <th className="sticky-column sticky-column-right-3">Tagi</th>
                <th className="sticky-column sticky-column-right-2">Status</th>
                <th className="sticky-column sticky-column-right-1">Akcje</th>
              </tr>
            </thead>
          <tbody>
            {leads.map((lead) => {
              const www = lead.websiteUrl ? (lead.websiteUrl.startsWith("http") ? lead.websiteUrl : `https://${lead.websiteUrl}`) : null;
              const li = lead.linkedinUrl ? (lead.linkedinUrl.startsWith("http") ? lead.linkedinUrl : `https://${lead.linkedinUrl}`) : null;
              
              return (
                <tr key={lead.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedLeadIds.includes(lead.id)}
                      onChange={() => handleLeadSelect(lead.id)}
                      style={{ marginRight: 8 }}
                    />
                    {lead.id}
                  </td>
                  <td>{lead.firstName || "-"}</td>
                  <td>{lead.lastName || "-"}</td>
                  <td style={{ fontSize: "12px", color: "var(--color-primary)", fontStyle: "italic" }}>
                    {lead.greetingForm ? (
                      <span style={{ color: "#4caf50", fontWeight: "bold" }}>
                        ✅ {lead.greetingForm}
                      </span>
                    ) : (
                      <span style={{ color: "#ff9800" }}>
                        ⏳ Brak odmiany
                      </span>
                    )}
                  </td>
                  <td>{lead.title || "-"}</td>
                  <td>
                    {www ? (
                      <a 
                        href={www} 
                        target="_blank" 
                        rel="noreferrer" 
                        style={{ 
                          color: "#2563eb", 
                          textDecoration: "none",
                          fontWeight: "500"
                        }}
                        onMouseOver={(e) => e.currentTarget.style.textDecoration = "underline"}
                        onMouseOut={(e) => e.currentTarget.style.textDecoration = "none"}
                      >
                        {lead.company || "-"}
                      </a>
                    ) : (
                      lead.company || "-"
                    )}
                  </td>
                  <td>
                    <a href={`mailto:${lead.email}`}>{lead.email}</a>
                  </td>
                  <td>{getIndustryName(lead.industry)}</td>
                  <td>{extractCityFromAddress(lead.companyCity)}</td>
                  <td>{extractCountryFromAddress(lead.companyCountry)}</td>
                  <td className="sticky-column sticky-column-right-4">
                    <span className="badge badge-gray">
                      {(lead.language || "pl").toUpperCase()}
                    </span>
                  </td>
                  <td className="sticky-column sticky-column-right-3">
                    {lead.LeadTag && lead.LeadTag.length > 0 ? (
                      <div style={{ display: "flex", gap: "2px", flexWrap: "wrap", maxWidth: "120px" }}>
                        {lead.LeadTag?.map((lt) => (
                          <span
                            key={lt.tag.id}
                            className="badge"
                            style={{
                              backgroundColor: lt.tag.color + "30",
                              color: lt.tag.color,
                              border: `1px solid ${lt.tag.color}`,
                              fontSize: "10px",
                              padding: "2px 6px",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              maxWidth: "60px"
                            }}
                            title={lt.tag.name}
                          >
                            {lt.tag.name.length > 8 ? lt.tag.name.substring(0, 8) + "..." : lt.tag.name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="sticky-column sticky-column-right-2">
                    <div style={{ display: "flex", alignItems: "center", gap: "4px", flexWrap: "wrap" }}>
                      <span style={{ 
                        padding: "2px 6px", 
                        borderRadius: "4px", 
                        fontSize: "12px", 
                        backgroundColor: "#e0e0e0", 
                        color: "#666" 
                      }}>
                        {lead.status}
                      </span>
                      {lead.subStatus && (
                        <span style={{ 
                          padding: "2px 6px", 
                          borderRadius: "4px", 
                          fontSize: "12px", 
                          backgroundColor: "#f0f0f0", 
                          color: "#888" 
                        }}>
                          {lead.subStatus}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="sticky-column sticky-column-right-1">
                    <div className="flex" style={{ maxWidth: "120px", flexWrap: "wrap", gap: "10px" }}>
                      <Link href={`/leads/${lead.id}`}>
                        <button className="btn btn-primary" style={{ fontSize: "10px", padding: "4px 8px", minWidth: "60px" }}>
                          Szczegóły
                        </button>
                      </Link>
                      <button 
                        onClick={() => handleDeleteSingle(lead.id, `${lead.firstName} ${lead.lastName} (${lead.email})`)}
                        style={{ 
                          fontSize: "10px", 
                          padding: "4px 8px", 
                          minWidth: "50px",
                          backgroundColor: "#9ca3af",
                          color: "white",
                          border: "none",
                          borderRadius: "4px",
                          cursor: "pointer",
                          transition: "background-color 0.2s"
                        }}
                        onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#6b7280"}
                        onMouseOut={(e) => e.currentTarget.style.backgroundColor = "#9ca3af"}
                        title="Usuń leada"
                      >
                        Usuń
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
          </table>

          {leads.length === 0 && (
            <div style={{ padding: "var(--spacing-xl)", textAlign: "center", color: "var(--gray-500)" }}>
              Brak leadów w bazie. Dodaj pierwszego lub zaimportuj z CSV.
            </div>
          )}
        </div>

        {/* Paginacja */}
        {totalPages > 1 && (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "var(--spacing-sm)", marginTop: "var(--spacing-lg)", paddingTop: "var(--spacing-lg)", borderTop: "1px solid var(--gray-200)" }}>
            <button
              onClick={() => handlePageChange(1)}
              disabled={currentPage === 1}
              style={{
                padding: "8px 12px",
                border: "1px solid var(--gray-300)",
                backgroundColor: currentPage === 1 ? "var(--gray-100)" : "white",
                borderRadius: "var(--radius)",
                cursor: currentPage === 1 ? "not-allowed" : "pointer",
                fontSize: "14px"
              }}
            >
              Pierwsza
            </button>
            
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              style={{
                padding: "8px 12px",
                border: "1px solid var(--gray-300)",
                backgroundColor: currentPage === 1 ? "var(--gray-100)" : "white",
                borderRadius: "var(--radius)",
                cursor: currentPage === 1 ? "not-allowed" : "pointer",
                fontSize: "14px"
              }}
            >
              Poprzednia
            </button>
            
            <div style={{ padding: "8px 16px", fontSize: "14px", fontWeight: "600" }}>
              {currentPage} / {totalPages}
            </div>
            
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage >= totalPages}
              style={{
                padding: "8px 12px",
                border: "1px solid var(--gray-300)",
                backgroundColor: currentPage >= totalPages ? "var(--gray-100)" : "white",
                borderRadius: "var(--radius)",
                cursor: currentPage >= totalPages ? "not-allowed" : "pointer",
                fontSize: "14px"
              }}
            >
              Następna
            </button>
            
            <button
              onClick={() => handlePageChange(totalPages)}
              disabled={currentPage >= totalPages}
              style={{
                padding: "8px 12px",
                border: "1px solid var(--gray-300)",
                backgroundColor: currentPage >= totalPages ? "var(--gray-100)" : "white",
                borderRadius: "var(--radius)",
                cursor: currentPage >= totalPages ? "not-allowed" : "pointer",
                fontSize: "14px"
              }}
            >
              Ostatnia
            </button>
          </div>
        )}
      </div>

      {/* Modal z postępem generowania powitań */}
      {greetingProgress && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '2rem',
            borderRadius: '8px',
            maxWidth: '500px',
            width: '90%',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)'
          }}>
            <h3 style={{ marginTop: 0, marginBottom: '1rem', color: '#0066cc' }}>
              {greetingProgress.status === 'completed' ? 'Zakończono!' : greetingProgress.progressId ? 'Generowanie powitań...' : 'Rozpoczynam generowanie powitań...'}
            </h3>
            
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span>Postęp:</span>
                <span>{greetingProgress.progressId ? `${greetingProgress.percentage}%` : '0%'}</span>
              </div>
              <div style={{
                width: '100%',
                height: '20px',
                backgroundColor: '#e0e0e0',
                borderRadius: '10px',
                overflow: 'hidden'
              }}>
                <div style={{
                  width: `${greetingProgress.percentage}%`,
                  height: '100%',
                  backgroundColor: greetingProgress.status === 'completed' ? '#28a745' : '#007bff',
                  transition: 'width 0.3s ease'
                }} />
              </div>
            </div>

            <div style={{ marginBottom: '1rem', fontSize: '14px', color: '#666' }}>
              {greetingProgress.progressId ? (
                <>
                  <div>Batch: {greetingProgress.currentBatch} / {greetingProgress.totalBatches}</div>
                  <div>Leady: {greetingProgress.processedLeads} / {greetingProgress.totalLeads}</div>
                  {greetingProgress.estimatedTime && (
                    <div>Szacowany czas: {greetingProgress.estimatedTime}</div>
                  )}
                </>
              ) : (
                <>
                  <div>Przygotowuję generowanie dla {greetingProgress.totalLeads} leadów...</div>
                  <div>Batch: {greetingProgress.currentBatch} / {greetingProgress.totalBatches}</div>
                  <div style={{ marginTop: '0.5rem', fontStyle: 'italic', color: '#888' }}>
                    Proszę czekać, proces właśnie się rozpoczyna...
                  </div>
                </>
              )}
            </div>

            {greetingProgress.status === 'completed' && (
              <button
                onClick={() => setGreetingProgress(null)}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Zamknij
              </button>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

// Komponent do zarządzania tagami
function TagManager({ 
  selectedLeadIds, 
  tags, 
  onClose, 
  onSuccess 
}: { 
  selectedLeadIds: number[];
  tags: Array<{ id: number; name: string; color: string }>;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [selectedTags, setSelectedTags] = useState<number[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleTagToggle = (tagId: number) => {
    setSelectedTags(prev => 
      prev.includes(tagId) 
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  };

  const handleApplyTags = async () => {
    if (selectedTags.length === 0) {
      alert("Wybierz co najmniej jeden tag");
      return;
    }

    setIsProcessing(true);
    try {
      const response = await fetch("/api/leads/bulk-tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          leadIds: selectedLeadIds,
          tagIds: selectedTags
        })
      });

      if (response.ok) {
        alert(`✅ Zaktualizowano tagi dla ${selectedLeadIds.length} leadów`);
        onSuccess();
      } else {
        const error = await response.json();
        alert(`❌ Błąd: ${error.error}`);
      }
    } catch (error) {
      console.error("Błąd aktualizacji tagów:", error);
      alert("❌ Wystąpił błąd podczas aktualizacji tagów");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div>
      <p style={{ marginBottom: "var(--spacing-md)", color: "var(--gray-600)" }}>
        Wybierz tagi do przypisania zaznaczonym leadom:
      </p>
      
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "var(--spacing-sm)", marginBottom: "var(--spacing-md)" }}>
        {tags.map(tag => (
          <label key={tag.id} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px", border: "1px solid var(--gray-200)", borderRadius: "4px", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={selectedTags.includes(tag.id)}
              onChange={() => handleTagToggle(tag.id)}
            />
            <span
              style={{
                backgroundColor: tag.color + "30",
                color: tag.color,
                padding: "2px 8px",
                borderRadius: "12px",
                fontSize: "12px",
                border: `1px solid ${tag.color}`
              }}
            >
              {tag.name}
            </span>
          </label>
        ))}
      </div>

      <div className="flex gap-sm">
        <button 
          onClick={handleApplyTags}
          disabled={isProcessing || selectedTags.length === 0}
          className="btn btn-primary"
        >
          {isProcessing ? "⏳ Zapisywanie..." : "✅ Zastosuj tagi"}
        </button>
        <button 
          onClick={onClose}
          className="btn btn-secondary"
          disabled={isProcessing}
        >
          ❌ Anuluj
        </button>
      </div>
    </div>
  );
}
