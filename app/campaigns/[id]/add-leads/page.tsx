"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

interface Lead {
  id: number;
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  email: string;
  industry: string | null;
  language: string | null;
  status: string;
  LeadTag: Array<{
    tag: {
      id: number;
      name: string;
      color: string;
    };
  }>;
}

interface Tag {
  id: number;
  name: string;
  color: string;
}

export default function AddLeadsPage() {
  const params = useParams();
  const router = useRouter();
  const campaignId = Number(params.id);

  const [leads, setLeads] = useState<Lead[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    fetchLeads();
    fetchTags();
  }, []);

  const fetchLeads = async () => {
    try {
      // ✅ Pobierz WSZYSTKIE leady bez limitu - obsłuży kampanie 3000+ leadów
      const response = await fetch(`/api/leads?campaignId=${campaignId}&page=1&limit=100000`);
      if (response.ok) {
        const data = await response.json();
        console.log('[DEBUG] Pobrano leadów:', data.leads?.length || 0);
        setLeads(data.leads || []); // ✅ Poprawka: ustaw leady, nie cały obiekt
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

  const filteredLeads = leads.filter(lead => {
    // Filtruj tylko aktywne leady (nie zablokowane)
    if (lead.status === 'BLOCKED' || lead.status === 'BLOKADA') return false;
    
    // Filtr po tagach - muszą mieć WSZYSTKIE wybrane tagi
    if (selectedTagIds.length > 0) {
      const leadTags = lead.LeadTag.map(lt => lt.tag.id);
      const hasAllTags = selectedTagIds.every(tagId => leadTags.includes(tagId));
      if (!hasAllTags) return false;
    }
    
    // Filtr po językach
    if (selectedLanguages.length > 0) {
      return selectedLanguages.includes(lead.language || '');
    }
    
    return true;
  });
  
  console.log('[DEBUG] Total leads:', leads.length, 'Filtered:', filteredLeads.length);

  const handleTagChange = (tagId: number) => {
    setSelectedTagIds(prev => 
      prev.includes(tagId) 
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  };

  const handleLanguageChange = (language: string) => {
    setSelectedLanguages(prev => 
      prev.includes(language)
        ? prev.filter(lang => lang !== language)
        : [...prev, language]
    );
  };

  const handleAddAllLeads = async () => {
    if (filteredLeads.length === 0) {
      alert("Brak leadów do dodania - zmień filtry");
      return;
    }

    const allLeadIds = filteredLeads.map(lead => lead.id);

    setIsAdding(true);
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadIds: allLeadIds }),
      });

      if (response.ok) {
        alert(`Dodano ${allLeadIds.length} leadów do kampanii`);
        router.push(`/campaigns/${campaignId}`);
      } else {
        const errorData = await response.json();
        alert(`Błąd: ${errorData.error || 'Nie udało się dodać leadów'}`);
      }
    } catch (error) {
      alert("Błąd dodawania leadów");
    } finally {
      setIsAdding(false);
    }
  };

  if (isLoading) {
    return <main>Ładowanie...</main>;
  }

  return (
    <main className="container" style={{ paddingTop: "var(--spacing-xl)", paddingBottom: "var(--spacing-2xl)" }}>
      <h1>Dodaj leady do kampanii</h1>
      
      <div style={{ marginBottom: 20 }}>
        <button 
          onClick={() => router.push(`/campaigns/${campaignId}`)}
          style={{ 
            padding: 8, 
            backgroundColor: "#6c757d", 
            color: "white", 
            border: "none", 
            borderRadius: 4,
            cursor: "pointer"
          }}
        >
          ← Wróć do kampanii
        </button>
      </div>

      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        {/* Filtry */}
        <div style={{ backgroundColor: "#f8f9fa", padding: 24, borderRadius: 8, marginBottom: 24 }}>
          <h3 style={{ marginTop: 0 }}>Filtruj leady</h3>
          
          {/* Wybór tagów */}
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: "block", fontWeight: "bold", marginBottom: 12, fontSize: 16 }}>
              Wybierz tagi (możesz wybrać wiele):
            </label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {tags.map(tag => (
                <label key={tag.id} style={{ 
                  display: "inline-flex", 
                  alignItems: "center",
                  padding: "8px 12px",
                  border: `2px solid ${selectedTagIds.includes(tag.id) ? tag.color : '#ddd'}`,
                  borderRadius: 6,
                  cursor: "pointer",
                  backgroundColor: selectedTagIds.includes(tag.id) ? tag.color : 'white',
                  color: selectedTagIds.includes(tag.id) ? 'white' : '#333'
                }}>
                  <input
                    type="checkbox"
                    checked={selectedTagIds.includes(tag.id)}
                    onChange={() => handleTagChange(tag.id)}
                    style={{ marginRight: 8 }}
                  />
                  {tag.name}
                </label>
              ))}
            </div>
          </div>

          {/* Wybór języków */}
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: "block", fontWeight: "bold", marginBottom: 12, fontSize: 16 }}>
              Wybierz języki (możesz wybrać wiele):
            </label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {['pl', 'en', 'de', 'fr'].map(lang => (
                <label key={lang} style={{ 
                  display: "inline-flex", 
                  alignItems: "center",
                  padding: "8px 12px",
                  border: `2px solid ${selectedLanguages.includes(lang) ? '#d81e42' : '#ddd'}`,
                  borderRadius: 6,
                  cursor: "pointer",
                  backgroundColor: selectedLanguages.includes(lang) ? '#d81e42' : 'white',
                  color: selectedLanguages.includes(lang) ? 'white' : '#333'
                }}>
                  <input
                    type="checkbox"
                    checked={selectedLanguages.includes(lang)}
                    onChange={() => handleLanguageChange(lang)}
                    style={{ marginRight: 8 }}
                  />
                  {lang.toUpperCase()}
                </label>
              ))}
            </div>
          </div>

          {/* Statystyki */}
          <div style={{ 
            backgroundColor: filteredLeads.length > 0 ? "#d4edda" : "#f8d7da",
            border: `1px solid ${filteredLeads.length > 0 ? "#c3e6cb" : "#f5c6cb"}`,
            color: filteredLeads.length > 0 ? "#155724" : "#721c24",
            padding: 16,
            borderRadius: 6,
            marginBottom: 16
          }}>
            <strong>Znaleziono: {filteredLeads.length} leadów</strong>
            {filteredLeads.length === 0 && (
              <div style={{ marginTop: 8 }}>
                Brak leadów pasujących do wybranych filtrów. Zmień tagi lub języki.
              </div>
            )}
          </div>

          <button
            onClick={() => {
              setSelectedTagIds([]);
              setSelectedLanguages([]);
            }}
            style={{
              padding: "8px 16px",
              backgroundColor: "#dc3545",
              color: "white",
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
              fontSize: 14,
              marginRight: 12
            }}
          >
            Wyczyść wszystkie filtry
          </button>

          <button
            onClick={handleAddAllLeads}
            disabled={filteredLeads.length === 0 || isAdding}
            style={{
              padding: "12px 24px",
              backgroundColor: filteredLeads.length === 0 || isAdding ? "#ccc" : "#28a745",
              color: "white",
              border: "none",
              borderRadius: 4,
              cursor: filteredLeads.length === 0 || isAdding ? "not-allowed" : "pointer",
              fontSize: 16,
              fontWeight: "bold"
            }}
          >
            {isAdding ? "Dodawanie..." : `Dodaj wszystkie znalezione leady (${filteredLeads.length})`}
          </button>
        </div>
      </div>
    </main>
  );
}
