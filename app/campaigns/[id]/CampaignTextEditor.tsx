"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface CampaignTextEditorProps {
  campaignId: number;
  initialSubject: string;
  initialText: string;
  initialJobDescription?: string;
  initialPostscript?: string;
  initialLinkText?: string;
  initialLinkUrl?: string;
  leads?: Array<{
    id: number;
    firstName: string | null;
    lastName: string | null;
    company: string | null;
    email: string;
  }>;
}

export default function CampaignTextEditor({ 
  campaignId, 
  initialSubject, 
  initialText, 
  initialJobDescription = "",
  initialPostscript = "",
  initialLinkText = "",
  initialLinkUrl = "",
  leads = [] 
}: CampaignTextEditorProps) {
  const [subject, setSubject] = useState(initialSubject || "");
  const [text, setText] = useState(initialText || "");
  const [jobDescription, setJobDescription] = useState(initialJobDescription || "");
  const [postscript, setPostscript] = useState(initialPostscript || "");
  const [linkText, setLinkText] = useState(initialLinkText || "");
  const [linkUrl, setLinkUrl] = useState(initialLinkUrl || "");
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState<number | null>(null);
  const [previewText, setPreviewText] = useState("");
  const router = useRouter();

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/content`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          subject, 
          text, 
          jobDescription, 
          postscript, 
          linkText, 
          linkUrl 
        })
      });

      if (response.ok) {
        setIsEditing(false);
        alert("Kampania zapisana!");
        router.refresh(); // Odśwież stronę, aby pokazać zaktualizowaną zawartość
      } else {
        alert("Błąd zapisywania kampanii");
      }
    } catch (error) {
      alert("Błąd zapisywania kampanii");
    } finally {
      setIsSaving(false);
    }
  };

  const handlePreview = async () => {
    if (!selectedLeadId || !text) return;
    
    try {
      const response = await fetch(`/api/leads/${selectedLeadId}/personalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignText: text })
      });

      if (response.ok) {
        const data = await response.json();
        setPreviewText(data.personalizedText);
        setShowPreview(true);
      } else {
        alert("Błąd generowania personalizacji");
      }
    } catch (error) {
      alert("Błąd generowania personalizacji");
    }
  };

  if (!isEditing) {
    return (
      <div style={{ marginBottom: 30, padding: 20, backgroundColor: "#f8f9fa", borderRadius: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3>Kampania</h3>
          <button
            onClick={() => setIsEditing(true)}
            style={{
              padding: 8,
              backgroundColor: "#0066cc",
              color: "white",
              border: "none",
              borderRadius: 4,
              cursor: "pointer"
            }}
          >
            {subject || text ? "Edytuj kampanię" : "Dodaj kampanię"}
          </button>
        </div>
        
        {subject && (
          <div style={{ marginBottom: 16 }}>
            <h4 style={{ margin: "0 0 8px 0", fontSize: "16px" }}>Temat maila:</h4>
            <div style={{
              padding: 12,
              backgroundColor: "white",
              border: "1px solid #ddd",
              borderRadius: 4,
              fontWeight: "bold"
            }}>
              {subject}
            </div>
          </div>
        )}

        {text ? (
          <div>
            <h4 style={{ margin: "0 0 8px 0", fontSize: "16px" }}>Treść maila:</h4>
            <div style={{
              whiteSpace: "pre-wrap",
              padding: 16,
              backgroundColor: "white",
              border: "1px solid #ddd",
              borderRadius: 4,
              fontFamily: "monospace",
              fontSize: "14px"
            }}>
              {text}
            </div>
          </div>
        ) : (
          <p style={{ color: "#666", fontStyle: "italic" }}>
            Brak treści kampanii. Kliknij "Dodaj kampanię" aby wkleić temat i tekst z ChatGPT.
          </p>
        )}

        {(jobDescription || postscript || linkText) && (
          <div style={{ marginTop: 20, paddingTop: 20, borderTop: "1px solid #ddd" }}>
            <h4 style={{ margin: "0 0 16px 0", fontSize: "16px" }}>Podpis kampanii:</h4>
            
            {jobDescription && (
              <div style={{ marginBottom: 12 }}>
                <strong>Opis stanowiska:</strong>
                <div style={{
                  padding: 8,
                  backgroundColor: "white",
                  border: "1px solid #ddd",
                  borderRadius: 4,
                  marginTop: 4,
                  fontSize: "14px"
                }}>
                  {jobDescription}
                </div>
              </div>
            )}

            {postscript && (
              <div style={{ marginBottom: 12 }}>
                <strong>PS.:</strong>
                <div style={{
                  whiteSpace: "pre-wrap",
                  padding: 8,
                  backgroundColor: "white",
                  border: "1px solid #ddd",
                  borderRadius: 4,
                  marginTop: 4,
                  fontSize: "14px"
                }}>
                  {postscript}
                </div>
              </div>
            )}

            {linkText && (
              <div style={{ marginBottom: 12 }}>
                <strong>Link:</strong>
                <div style={{
                  padding: 8,
                  backgroundColor: "white",
                  border: "1px solid #ddd",
                  borderRadius: 4,
                  marginTop: 4,
                  fontSize: "14px"
                }}>
                  {linkUrl ? (
                    <a href={linkUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#0066cc" }}>
                      {linkText}
                    </a>
                  ) : (
                    <a href={linkText} target="_blank" rel="noopener noreferrer" style={{ color: "#0066cc" }}>
                      {linkText}
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 30, padding: 20, backgroundColor: "#f8f9fa", borderRadius: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h3>Edytuj kampanię</h3>
        <div>
          <button 
            onClick={() => setIsEditing(false)}
            style={{ 
              padding: 8, 
              marginRight: 8,
              backgroundColor: "#6c757d", 
              color: "white", 
              border: "none", 
              borderRadius: 4,
              cursor: "pointer"
            }}
          >
            Anuluj
          </button>
          <button 
            onClick={handleSave}
            disabled={isSaving}
            style={{ 
              padding: 8, 
              marginRight: 8,
              backgroundColor: isSaving ? "#ccc" : "#28a745", 
              color: "white", 
              border: "none", 
              borderRadius: 4,
              cursor: isSaving ? "not-allowed" : "pointer"
            }}
          >
            {isSaving ? "Zapisuję..." : "Zapisz"}
          </button>
          {text && leads.length > 0 && (
            <button 
              onClick={() => setShowPreview(true)}
              style={{ 
                padding: 8, 
                backgroundColor: "#17a2b8", 
                color: "white", 
                border: "none", 
                borderRadius: 4,
                cursor: "pointer"
              }}
            >
              🎯 Podgląd personalizacji
            </button>
          )}
        </div>
      </div>
      <div>
        <label style={{ display: "block", fontWeight: "bold", marginBottom: 8 }}>
          Temat maila:
        </label>
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          style={{
            width: "100%",
            padding: 12,
            border: "1px solid #ccc",
            borderRadius: 4,
            fontSize: "16px",
            marginBottom: 16
          }}
          placeholder="np. Współpraca z Kreativia - propozycja"
        />

        <label style={{ display: "block", fontWeight: "bold", marginBottom: 8 }}>
          Treść maila:
        </label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={15}
          style={{
            width: "100%",
            padding: 12,
            border: "1px solid #ccc",
            borderRadius: 4,
            fontFamily: "monospace",
            fontSize: "14px",
            lineHeight: "1.5"
          }}
          placeholder="Wklej tutaj gotowy tekst kampanii z ChatGPT..."
        />
        <p style={{ fontSize: "12px", color: "#666", marginTop: 8 }}>
          💡 Wklej tutaj gotowy temat i tekst kampanii z ChatGPT. Później AI będzie personalizować tylko kilka zdań na podstawie danych leada.
          <br />
          <strong>Pogrubienie:</strong> Użyj <code>**tekst**</code> aby pogrubić tekst w mailu (np. **Kreativia**)
        </p>

        <div style={{ marginTop: 24, paddingTop: 24, borderTop: "1px solid #ddd" }}>
          <h4 style={{ margin: "0 0 16px 0", fontSize: "16px" }}>Podpis kampanii</h4>
          
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontWeight: "bold", marginBottom: 8 }}>
              Opis stanowiska (pod imieniem handlowca):
            </label>
            <input
              type="text"
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              style={{
                width: "100%",
                padding: 8,
                border: "1px solid #ccc",
                borderRadius: 4,
                fontSize: "14px"
              }}
              placeholder="np. Wspieram sieci retail w sprawnej produkcji materiałów VM i POS"
            />
            <p style={{ fontSize: "11px", color: "#666", marginTop: 4 }}>
              To będzie wyświetlane pod imieniem i nazwiskiem handlowca. Możesz użyć **tekst** aby pogrubić.
            </p>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontWeight: "bold", marginBottom: 8 }}>
              PS. (postscript):
            </label>
            <textarea
              value={postscript}
              onChange={(e) => setPostscript(e.target.value)}
              rows={3}
              style={{
                width: "100%",
                padding: 8,
                border: "1px solid #ccc",
                borderRadius: 4,
                fontSize: "14px"
              }}
              placeholder="np. Działamy bezpośrednio dla marek retail w Europie – grafiki są zawsze dopasowane do systemu..."
            />
            <p style={{ fontSize: "11px", color: "#666", marginTop: 4 }}>
              Dodatkowe informacje na końcu maila. Możesz użyć **tekst** aby pogrubić.
            </p>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontWeight: "bold", marginBottom: 8 }}>
              Tekst linku:
            </label>
            <input
              type="text"
              value={linkText}
              onChange={(e) => setLinkText(e.target.value)}
              style={{
                width: "100%",
                padding: 8,
                border: "1px solid #ccc",
                borderRadius: 4,
                fontSize: "14px",
                marginBottom: 8
              }}
              placeholder="np. Visit our site: www.kreativia.eu"
            />
            <label style={{ display: "block", fontWeight: "bold", marginBottom: 8 }}>
              URL docelowy (opcjonalny):
            </label>
            <input
              type="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              style={{
                width: "100%",
                padding: 8,
                border: "1px solid #ccc",
                borderRadius: 4,
                fontSize: "14px"
              }}
              placeholder="np. https://www.kreativia.eu/ramy"
            />
            <p style={{ fontSize: "11px", color: "#666", marginTop: 4 }}>
              Jeśli URL jest pusty, link będzie kierował do tekstu wyświetlanego
            </p>
          </div>
        </div>
      </div>

      {/* Okno podglądu personalizacji */}
      {showPreview && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0,0,0,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: "white",
            padding: 24,
            borderRadius: 8,
            maxWidth: "80%",
            maxHeight: "80%",
            overflow: "auto"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3>🎯 Podgląd personalizacji</h3>
              <button 
                onClick={() => setShowPreview(false)}
                style={{ 
                  padding: 8, 
                  backgroundColor: "#dc3545", 
                  color: "white", 
                  border: "none", 
                  borderRadius: 4,
                  cursor: "pointer"
                }}
              >
                ✕ Zamknij
              </button>
            </div>
            
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontWeight: "bold", marginBottom: 8 }}>
                Wybierz leada do podglądu:
              </label>
              <select 
                value={selectedLeadId || ""} 
                onChange={(e) => setSelectedLeadId(Number(e.target.value))}
                style={{ 
                  width: "100%", 
                  padding: 8, 
                  border: "1px solid #ccc", 
                  borderRadius: 4,
                  marginBottom: 12
                }}
              >
                <option value="">-- Wybierz leada --</option>
                {leads.map(lead => (
                  <option key={lead.id} value={lead.id}>
                    {lead.firstName} {lead.lastName} ({lead.company}) - {lead.email}
                  </option>
                ))}
              </select>
              <button 
                onClick={handlePreview}
                disabled={!selectedLeadId}
                style={{ 
                  padding: 8, 
                  backgroundColor: !selectedLeadId ? "#ccc" : "#007bff", 
                  color: "white", 
                  border: "none", 
                  borderRadius: 4,
                  cursor: !selectedLeadId ? "not-allowed" : "pointer"
                }}
              >
                🤖 Wygeneruj personalizację
              </button>
            </div>

            {previewText && (
              <div>
                <h4 style={{ marginBottom: 12 }}>Spersonalizowany tekst:</h4>
                <div style={{ 
                  whiteSpace: "pre-wrap", 
                  padding: 16, 
                  backgroundColor: "#f8f9fa", 
                  border: "1px solid #ddd", 
                  borderRadius: 4,
                  fontFamily: "monospace",
                  fontSize: "14px",
                  lineHeight: "1.5"
                }}>
                  {previewText}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

