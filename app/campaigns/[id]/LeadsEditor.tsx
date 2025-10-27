"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface Lead {
  id: number;
  firstName: string | null;
  lastName: string | null;
  email: string;
  company: string | null;
  language: string | null;
  hasSentEmail: boolean;
}

interface Tag {
  id: number;
  name: string;
}

interface Props {
  campaignId: number;
  currentLeads: Lead[];
  campaignStatus: string;
}

export default function LeadsEditor({ campaignId, currentLeads, campaignStatus }: Props) {
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[]>(currentLeads);
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [availableLeads, setAvailableLeads] = useState<Lead[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTag, setSelectedTag] = useState<number | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<string | null>(null);
  const [selectedLeads, setSelectedLeads] = useState<number[]>([]);
  const [selectedCampaignLeads, setSelectedCampaignLeads] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const isEditable = campaignStatus !== "IN_PROGRESS" && campaignStatus !== "COMPLETED";

  // Synchronizuj stan leads z currentLeads
  useEffect(() => {
    setLeads(currentLeads);
  }, [currentLeads]);

  // Odśwież dane z serwera co 5 sekund
  useEffect(() => {
    const interval = setInterval(() => {
      router.refresh();
    }, 5000);

    return () => clearInterval(interval);
  }, [router]);

  useEffect(() => {
    if (showAddPanel) {
      fetchTags();
    }
  }, [showAddPanel]);

  const fetchTags = async () => {
    try {
      const res = await fetch("/api/tags");
      if (res.ok) {
        const data = await res.json();
        setTags(data);
      }
    } catch (error) {
      console.error("Błąd pobierania tagów:", error);
    }
  };

  const fetchLeadsByTag = async (tagId: number | null, language: string | null) => {
    try {
      setIsLoading(true);
      let url = "/api/leads";
      
      // Dodaj parametry do URL
      const params = new URLSearchParams();
      if (tagId) params.append("tagId", tagId.toString());
      if (language) params.append("language", language);
      
      if (params.toString()) {
        url += "?" + params.toString();
      }
      
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        const allLeads = data.leads || data; // Obsługa różnych formatów odpowiedzi
        
        // Pobierz leady kampanii z API
        const campaignRes = await fetch(`/api/campaigns/${campaignId}/leads`);
        let currentLeadIds: number[] = [];
        if (campaignRes.ok) {
          const campaignData = await campaignRes.json();
          currentLeadIds = campaignData.leads.map((l: any) => l.id);
        }
        
        // Filtruj leady, które już są w kampanii lub są zablokowane
        const available = allLeads
          .filter((l: any) => !currentLeadIds.includes(l.id) && l.status !== 'BLOCKED')
          .map((l: any) => ({
            id: l.id,
            firstName: l.firstName,
            lastName: l.lastName,
            email: l.email,
            company: l.company,
            language: l.language,
            hasSentEmail: false
          }));
        
        setAvailableLeads(available);
      }
    } catch (error) {
      console.error("Błąd pobierania leadów:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveLead = async (leadId: number) => {
    if (!confirm("Czy na pewno chcesz usunąć tego leada z kampanii?")) {
      return;
    }

    try {
      setIsLoading(true);
      const res = await fetch(`/api/campaigns/${campaignId}/leads`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadIds: [leadId] })
      });

      const data = await res.json();

      if (res.ok) {
        setLeads(leads.filter(l => l.id !== leadId));
        setMessage({ type: "success", text: data.message });
        setTimeout(() => setMessage(null), 3000);
      } else {
        setMessage({ type: "error", text: data.error });
        setTimeout(() => setMessage(null), 5000);
      }
    } catch (error: any) {
      setMessage({ type: "error", text: error.message });
      setTimeout(() => setMessage(null), 5000);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveSelectedLeads = async () => {
    if (selectedCampaignLeads.length === 0) {
      alert("Wybierz przynajmniej jednego leada");
      return;
    }

    const count = selectedCampaignLeads.length;
    if (!confirm(`Czy na pewno chcesz usunąć ${count} ${count === 1 ? 'leada' : 'leadów'} z kampanii?`)) {
      return;
    }

    try {
      setIsLoading(true);
      const res = await fetch(`/api/campaigns/${campaignId}/leads`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadIds: selectedCampaignLeads })
      });

      const data = await res.json();

      if (res.ok) {
        setLeads(leads.filter(l => !selectedCampaignLeads.includes(l.id)));
        setSelectedCampaignLeads([]);
        setMessage({ type: "success", text: data.message });
        setTimeout(() => setMessage(null), 3000);
      } else {
        setMessage({ type: "error", text: data.error });
        setTimeout(() => setMessage(null), 5000);
      }
    } catch (error: any) {
      setMessage({ type: "error", text: error.message });
      setTimeout(() => setMessage(null), 5000);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleCampaignLeadSelection = (leadId: number) => {
    // Nie pozwól zaznaczyć leadów którzy już dostali mail
    const lead = leads.find(l => l.id === leadId);
    if (lead?.hasSentEmail) return;

    setSelectedCampaignLeads(prev => 
      prev.includes(leadId) 
        ? prev.filter(id => id !== leadId)
        : [...prev, leadId]
    );
  };

  const selectAllCampaignLeads = () => {
    const selectableLeads = leads.filter(l => !l.hasSentEmail).map(l => l.id);
    setSelectedCampaignLeads(selectableLeads);
  };

  const deselectAllCampaignLeads = () => {
    setSelectedCampaignLeads([]);
  };

  const selectedCount = selectedCampaignLeads.length;
  const allSelected = selectedCount > 0 && selectedCount === leads.filter(l => !l.hasSentEmail).length;

  const handleAddLeads = async () => {
    if (selectedLeads.length === 0) {
      alert("Wybierz przynajmniej jednego leada");
      return;
    }

    try {
      setIsLoading(true);
      const res = await fetch(`/api/campaigns/${campaignId}/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadIds: selectedLeads })
      });

      const data = await res.json();

      if (res.ok) {
        // Odśwież listę leadów
        const addedLeads = availableLeads.filter(l => selectedLeads.includes(l.id));
        setLeads([...leads, ...addedLeads]);
        setSelectedLeads([]);
        setShowAddPanel(false);
        setMessage({ type: "success", text: data.message });
        setTimeout(() => setMessage(null), 3000);
      } else {
        setMessage({ type: "error", text: data.error });
        setTimeout(() => setMessage(null), 5000);
      }
    } catch (error: any) {
      setMessage({ type: "error", text: error.message });
      setTimeout(() => setMessage(null), 5000);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleLeadSelection = (leadId: number) => {
    setSelectedLeads(prev => 
      prev.includes(leadId) 
        ? prev.filter(id => id !== leadId)
        : [...prev, leadId]
    );
  };

  const sentCount = leads.filter(l => l.hasSentEmail).length;

  return (
    <div className="card" style={{ marginBottom: "var(--spacing-xl)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--spacing-lg)" }}>
        <h2>Leady w kampanii ({leads.length})</h2>
        <div style={{ display: "flex", gap: "var(--spacing-sm)" }}>
          {isEditable && selectedCount > 0 && (
            <button
              className="btn"
              onClick={handleRemoveSelectedLeads}
              disabled={isLoading}
              style={{
                backgroundColor: selectedCount > 0 ? "#dc3545" : "var(--gray-400)",
                color: "white",
                fontWeight: "600",
                padding: "8px 16px",
                borderRadius: "6px",
                border: "none",
                cursor: "pointer"
              }}
            >
              Usuń zaznaczone ({selectedCount})
            </button>
          )}
          {isEditable && (
            <button
              className="btn btn-primary"
              onClick={() => router.push(`/campaigns/${campaignId}/add-leads`)}
              disabled={isLoading}
            >
              Dodaj leady
            </button>
          )}
        </div>
      </div>

      {!isEditable && (
        <div className="alert alert-info" style={{ marginBottom: "var(--spacing-md)" }}>
          Edycja leadów jest zablokowana podczas wysyłki kampanii
        </div>
      )}

      <div style={{ 
        fontSize: "12px", 
        color: "var(--gray-600)", 
        marginBottom: "var(--spacing-md)",
        padding: "8px 12px",
        backgroundColor: "var(--gray-50)",
        borderRadius: "4px",
        border: "1px solid var(--gray-200)"
      }}>
        Lista odświeża się automatycznie co 5 sekund
      </div>

      {message && (
        <div className={message.type === "success" ? "alert alert-success" : "alert alert-error"} style={{ marginBottom: "var(--spacing-md)" }}>
          {message.text}
        </div>
      )}

      {sentCount > 0 && (
        <div className="alert alert-info" style={{ marginBottom: "var(--spacing-md)" }}>
          {sentCount} leadów już otrzymało mail - nie można ich usunąć
        </div>
      )}

      {/* Panel dodawania leadów */}
      {showAddPanel && (
        <div style={{ 
          padding: "var(--spacing-lg)", 
          backgroundColor: "var(--gray-100)", 
          borderRadius: "8px",
          marginBottom: "var(--spacing-lg)"
        }}>
          <h3 style={{ marginBottom: "var(--spacing-md)" }}>Dodaj leady do kampanii</h3>
          
          <div style={{ marginBottom: "var(--spacing-md)" }}>
            <div style={{ display: "flex", gap: "var(--spacing-md)", marginBottom: "var(--spacing-md)" }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: "block", marginBottom: "var(--spacing-sm)" }}>
                  Język:
                </label>
                <select
                  value={selectedLanguage || ""}
                  onChange={(e) => {
                    const lang = e.target.value || null;
                    setSelectedLanguage(lang);
                    fetchLeadsByTag(selectedTag, lang);
                  }}
                  style={{ 
                    padding: "var(--spacing-sm)", 
                    borderRadius: "4px", 
                    border: "1px solid var(--gray-300)",
                    width: "100%"
                  }}
                >
                  <option value="">Wszystkie</option>
                  <option value="pl">Polski (pl)</option>
                  <option value="en">Angielski (en)</option>
                  <option value="de">Niemiecki (de)</option>
                  <option value="fr">Francuski (fr)</option>
                </select>
              </div>
              
              <div style={{ flex: 1 }}>
                <label style={{ display: "block", marginBottom: "var(--spacing-sm)" }}>
                  Tag:
                </label>
                <select
                  value={selectedTag || ""}
                  onChange={(e) => {
                    const tagId = e.target.value ? Number(e.target.value) : null;
                    setSelectedTag(tagId);
                    fetchLeadsByTag(tagId, selectedLanguage);
                  }}
                  style={{ 
                    padding: "var(--spacing-sm)", 
                    borderRadius: "4px", 
                    border: "1px solid var(--gray-300)",
                    width: "100%"
                  }}
                >
                  <option value="">Wszystkie</option>
                  {tags.map(tag => (
                    <option key={tag.id} value={tag.id}>{tag.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <button
              className="btn btn-secondary"
              onClick={() => fetchLeadsByTag(selectedTag, selectedLanguage)}
              disabled={isLoading}
            >
              Szukaj
            </button>
          </div>

          {availableLeads.length > 0 ? (
            <>
              <div style={{ 
                maxHeight: "300px", 
                overflowY: "auto", 
                border: "1px solid var(--gray-300)",
                borderRadius: "4px",
                backgroundColor: "white",
                marginBottom: "var(--spacing-md)"
              }}>
                {availableLeads.map(lead => (
                  <div
                    key={lead.id}
                    style={{
                      padding: "var(--spacing-sm)",
                      borderBottom: "1px solid var(--gray-200)",
                      display: "flex",
                      alignItems: "center",
                      cursor: "pointer",
                      backgroundColor: selectedLeads.includes(lead.id) ? "var(--primary-light)" : "white"
                    }}
                    onClick={() => toggleLeadSelection(lead.id)}
                  >
                    <input
                      type="checkbox"
                      checked={selectedLeads.includes(lead.id)}
                      onChange={() => {}}
                      style={{ marginRight: "var(--spacing-sm)" }}
                    />
                    <div>
                      <strong>{lead.firstName} {lead.lastName}</strong> ({lead.email})
                      {lead.company && <span style={{ color: "var(--gray-600)", fontSize: "0.9rem" }}> - {lead.company}</span>}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: "var(--spacing-sm)" }}>
                <button
                  className="btn btn-success"
                  onClick={handleAddLeads}
                  disabled={selectedLeads.length === 0 || isLoading}
                >
                  Dodaj wybranych ({selectedLeads.length})
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    setSelectedLeads(availableLeads.map(l => l.id));
                  }}
                  disabled={isLoading}
                >
                  Zaznacz wszystkich
                </button>
              </div>
            </>
          ) : (
            <p style={{ color: "var(--gray-600)" }}>
              {isLoading ? "Ładowanie..." : "Brak dostępnych leadów (wszystkie są już w kampanii lub zablokowane)"}
            </p>
          )}
        </div>
      )}

      {/* Lista obecnych leadów */}
      <div style={{ maxHeight: "500px", overflowY: "auto" }}>
        <div style={{ marginBottom: "var(--spacing-sm)", display: "flex", gap: "8px", alignItems: "center" }}>
          {isEditable && leads.filter(l => !l.hasSentEmail).length > 0 && (
            <>
              <input
                type="checkbox"
                checked={allSelected}
                onChange={(e) => {
                  if (e.target.checked) {
                    selectAllCampaignLeads();
                  } else {
                    deselectAllCampaignLeads();
                  }
                }}
                style={{ cursor: "pointer" }}
              />
              <span style={{ fontSize: "0.9rem", color: "var(--gray-600)" }}>
                {allSelected ? "Odznacz wszystkich" : "Zaznacz wszystkich"}
              </span>
              {selectedCount > 0 && (
                <span style={{ fontSize: "0.9rem", color: "var(--primary)", fontWeight: "600" }}>
                  • {selectedCount} zaznaczonych
                </span>
              )}
            </>
          )}
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ backgroundColor: "var(--gray-100)" }}>
              {isEditable && (
                <th style={{ padding: "var(--spacing-sm)", textAlign: "center", borderBottom: "2px solid var(--gray-300)", width: "40px" }}></th>
              )}
              <th style={{ padding: "var(--spacing-sm)", textAlign: "left", borderBottom: "2px solid var(--gray-300)" }}>Imię i nazwisko</th>
              <th style={{ padding: "var(--spacing-sm)", textAlign: "left", borderBottom: "2px solid var(--gray-300)" }}>Email</th>
              <th style={{ padding: "var(--spacing-sm)", textAlign: "left", borderBottom: "2px solid var(--gray-300)" }}>Firma</th>
              <th style={{ padding: "var(--spacing-sm)", textAlign: "center", borderBottom: "2px solid var(--gray-300)" }}>Status</th>
              {isEditable && (
                <th style={{ padding: "var(--spacing-sm)", textAlign: "center", borderBottom: "2px solid var(--gray-300)" }}>Akcje</th>
              )}
            </tr>
          </thead>
          <tbody>
            {leads.map(lead => (
              <tr key={lead.id} style={{ borderBottom: "1px solid var(--gray-200)", backgroundColor: selectedCampaignLeads.includes(lead.id) ? "var(--primary-light)" : "transparent" }}>
                {isEditable && (
                  <td style={{ padding: "var(--spacing-sm)", textAlign: "center" }}>
                    {!lead.hasSentEmail ? (
                      <input
                        type="checkbox"
                        checked={selectedCampaignLeads.includes(lead.id)}
                        onChange={() => toggleCampaignLeadSelection(lead.id)}
                        style={{ cursor: "pointer" }}
                      />
                    ) : (
                      <span style={{ color: "var(--gray-400)" }}>—</span>
                    )}
                  </td>
                )}
                <td style={{ padding: "var(--spacing-sm)" }}>
                  {lead.firstName} {lead.lastName}
                </td>
                <td style={{ padding: "var(--spacing-sm)" }}>
                  {lead.email}
                </td>
                <td style={{ padding: "var(--spacing-sm)" }}>
                  {lead.company || "-"}
                </td>
                <td style={{ padding: "var(--spacing-sm)", textAlign: "center" }}>
                  {lead.hasSentEmail ? (
                    <span style={{ color: "var(--success)", fontSize: "0.9rem" }}>Wysłano</span>
                  ) : (
                    <span style={{ color: "var(--gray-500)", fontSize: "0.9rem" }}>Oczekuje</span>
                  )}
                </td>
                {isEditable && (
                  <td style={{ padding: "var(--spacing-sm)", textAlign: "center" }}>
                    {!lead.hasSentEmail ? (
                      <button
                        className="btn btn-sm"
                        style={{ 
                          backgroundColor: "var(--gray-500)", 
                          color: "white",
                          padding: "4px 8px",
                          fontSize: "0.85rem"
                        }}
                        onClick={() => handleRemoveLead(lead.id)}
                        disabled={isLoading}
                      >
                        Usuń
                      </button>
                    ) : (
                      <span style={{ color: "var(--gray-400)", fontSize: "0.85rem" }}>Zablokowany</span>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {leads.length === 0 && (
        <p style={{ textAlign: "center", color: "var(--gray-600)", padding: "var(--spacing-lg)" }}>
          Brak leadów w kampanii. Dodaj leadów używając przycisku powyżej.
        </p>
      )}
    </div>
  );
}

