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
  const [selectedLeadIds, setSelectedLeadIds] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    fetchLeads();
    fetchTags();
  }, []);

  const fetchLeads = async () => {
    try {
      const response = await fetch("/api/leads");
      if (response.ok) {
        const data = await response.json();
        setLeads(data);
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
    if (selectedTagIds.length === 0) return false; // WYMAGAJ wyboru tagu
    
    // Filtruj tylko aktywne leady (nie zablokowane)
    if (lead.status === 'BLOCKED') return false;
    
    return lead.LeadTag.some(leadTag => selectedTagIds.includes(leadTag.tag.id));
  });

  const handleTagChange = (tagId: number) => {
    setSelectedTagIds(prev => 
      prev.includes(tagId) 
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  };

  const handleLeadSelect = (leadId: number) => {
    setSelectedLeadIds(prev => 
      prev.includes(leadId)
        ? prev.filter(id => id !== leadId)
        : [...prev, leadId]
    );
  };

  const handleSelectAll = () => {
    if (selectedLeadIds.length === filteredLeads.length) {
      setSelectedLeadIds([]);
    } else {
      setSelectedLeadIds(filteredLeads.map(lead => lead.id));
    }
  };

  const handleAddLeads = async () => {
    if (selectedLeadIds.length === 0) {
      alert("Wybierz przynajmniej jednego leada");
      return;
    }

    setIsAdding(true);
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadIds: selectedLeadIds }),
      });

      if (response.ok) {
        alert(`Dodano ${selectedLeadIds.length} leadów do kampanii`);
        router.push(`/campaigns/${campaignId}`);
      } else {
        alert("Błąd dodawania leadów");
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

      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 20 }}>
        {/* Filtry */}
        <div style={{ backgroundColor: "#f8f9fa", padding: 20, borderRadius: 8 }}>
          <h3>Filtruj według tagów</h3>
          
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontWeight: "bold", marginBottom: 8 }}>
              Wybierz tagi:
            </label>
            {tags.map(tag => (
              <label key={tag.id} style={{ display: "block", marginBottom: 8 }}>
                <input
                  type="checkbox"
                  checked={selectedTagIds.includes(tag.id)}
                  onChange={() => handleTagChange(tag.id)}
                  style={{ marginRight: 8 }}
                />
                <span style={{ 
                  backgroundColor: tag.color, 
                  color: "white", 
                  padding: "2px 8px", 
                  borderRadius: 12, 
                  fontSize: 12 
                }}>
                  {tag.name}
                </span>
              </label>
            ))}
          </div>

          <div style={{ marginBottom: 16 }}>
            <button
              onClick={() => setSelectedTagIds([])}
              style={{
                padding: "8px 16px",
                backgroundColor: "#dc3545",
                color: "white",
                border: "none",
                borderRadius: 4,
                cursor: "pointer",
                fontSize: 14
              }}
            >
              Wyczyść filtry
            </button>
          </div>

          <div style={{ fontSize: 14, color: "#666" }}>
            <p>Znaleziono: {filteredLeads.length} leadów</p>
            <p>Wybrano: {selectedLeadIds.length} leadów</p>
            {selectedTagIds.length === 0 && (
              <p style={{ color: "#dc3545", fontWeight: "bold" }}>
                ⚠️ Wybierz tag aby zobaczyć leady
              </p>
            )}
          </div>
        </div>

        {/* Lista leadów */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h3>Leady ({filteredLeads.length})</h3>
            <div>
              <button
                onClick={handleSelectAll}
                style={{
                  padding: "8px 16px",
                  backgroundColor: "#17a2b8",
                  color: "white",
                  border: "none",
                  borderRadius: 4,
                  cursor: "pointer",
                  marginRight: 8
                }}
              >
                {selectedLeadIds.length === filteredLeads.length ? "Odznacz wszystkie" : "Zaznacz wszystkie"}
              </button>
              <button
                onClick={handleAddLeads}
                disabled={selectedLeadIds.length === 0 || isAdding}
                style={{
                  padding: "8px 16px",
                  backgroundColor: selectedLeadIds.length === 0 || isAdding ? "#ccc" : "#28a745",
                  color: "white",
                  border: "none",
                  borderRadius: 4,
                  cursor: selectedLeadIds.length === 0 || isAdding ? "not-allowed" : "pointer"
                }}
              >
                {isAdding ? "Dodawanie..." : `Dodaj ${selectedLeadIds.length} leadów`}
              </button>
            </div>
          </div>

          <div style={{ maxHeight: 600, overflowY: "auto", border: "1px solid #ddd", borderRadius: 4 }}>
            {filteredLeads.map(lead => (
              <div
                key={lead.id}
                style={{
                  padding: 12,
                  borderBottom: "1px solid #eee",
                  backgroundColor: selectedLeadIds.includes(lead.id) ? "#e8f4fd" : "white",
                  cursor: "pointer"
                }}
                onClick={() => handleLeadSelect(lead.id)}
              >
                <div style={{ display: "flex", alignItems: "center" }}>
                  <input
                    type="checkbox"
                    checked={selectedLeadIds.includes(lead.id)}
                    onChange={() => handleLeadSelect(lead.id)}
                    style={{ marginRight: 12 }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: "bold" }}>
                      {lead.firstName} {lead.lastName}
                    </div>
                    <div style={{ color: "#666", fontSize: 14 }}>
                      {lead.company} • {lead.email}
                    </div>
                    <div style={{ fontSize: 12, color: "#888" }}>
                      {lead.industry} • {lead.language?.toUpperCase()} • 
                      <span style={{ 
                        color: lead.status === 'ACTIVE' ? '#28a745' : 
                               lead.status === 'BLOCKED' ? '#dc3545' : 
                               lead.status === 'INACTIVE' ? '#ffc107' : '#17a2b8',
                        fontWeight: 'bold',
                        marginLeft: '4px'
                      }}>
                        {lead.status === 'ACTIVE' && '✓ Aktywny'}
                        {lead.status === 'BLOCKED' && '🚫 Zablokowany'}
                        {lead.status === 'INACTIVE' && '⏸️ Nieaktywny'}
                        {lead.status === 'TEST' && '🧪 Test'}
                      </span>
                    </div>
                    <div style={{ marginTop: 4 }}>
                      {lead.LeadTag.map(leadTag => (
                        <span
                          key={leadTag.tag.id}
                          style={{
                            backgroundColor: leadTag.tag.color,
                            color: "white",
                            padding: "2px 6px",
                            borderRadius: 10,
                            fontSize: 11,
                            marginRight: 4
                          }}
                        >
                          {leadTag.tag.name}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
