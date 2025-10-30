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
  initialAbTestEnabled?: boolean;
  initialAbTestMode?: string;
  initialSubjectB?: string;
  initialTextB?: string;
  initialJobDescriptionB?: string;
  initialPostscriptB?: string;
  initialLinkTextB?: string;
  initialLinkUrlB?: string;
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
  initialAbTestEnabled = false,
  initialAbTestMode = "hash",
  initialSubjectB = "",
  initialTextB = "",
  initialJobDescriptionB = "",
  initialPostscriptB = "",
  initialLinkTextB = "",
  initialLinkUrlB = "",
  leads = [] 
}: CampaignTextEditorProps) {
  const [subject, setSubject] = useState(initialSubject || "");
  const [text, setText] = useState(initialText || "");
  const [jobDescription, setJobDescription] = useState(initialJobDescription || "");
  const [postscript, setPostscript] = useState(initialPostscript || "");
  const [linkText, setLinkText] = useState(initialLinkText || "");
  const [linkUrl, setLinkUrl] = useState(initialLinkUrl || "");
  
  // A/B Testing state
  const [abTestEnabled, setAbTestEnabled] = useState(initialAbTestEnabled);
  const [abTestMode, setAbTestMode] = useState(initialAbTestMode);
  const [subjectB, setSubjectB] = useState(initialSubjectB || "");
  const [textB, setTextB] = useState(initialTextB || "");
  const [jobDescriptionB, setJobDescriptionB] = useState(initialJobDescriptionB || "");
  const [postscriptB, setPostscriptB] = useState(initialPostscriptB || "");
  const [linkTextB, setLinkTextB] = useState(initialLinkTextB || "");
  const [linkUrlB, setLinkUrlB] = useState(initialLinkUrlB || "");
  
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState<number | null>(null);
  const [previewText, setPreviewText] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveErrorDetails, setSaveErrorDetails] = useState<string | null>(null);
  const router = useRouter();

  const handleSave = async () => {
    setIsSaving(true);
    setSaveError(null);
    setSaveErrorDetails(null);
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
          linkUrl,
          abTestEnabled,
          abTestMode,
          subjectB,
          textB,
          jobDescriptionB,
          postscriptB,
          linkTextB,
          linkUrlB
        })
      });

      if (response.ok) {
        setIsEditing(false);
        alert("Kampania zapisana!");
        router.refresh();
      } else {
        let msg = "Błąd zapisywania kampanii";
        let details: string | null = null;
        try {
          const data = await response.json();
          if (data?.error) msg = `Błąd zapisywania kampanii: ${data.error}`;
          if (data?.details) details = typeof data.details === "string" ? data.details : JSON.stringify(data.details, null, 2);
        } catch {}
        setSaveError(msg);
        setSaveErrorDetails(details);
      }
    } catch (error: any) {
      setSaveError("Błąd zapisywania kampanii (wyjątek w przeglądarce)");
      setSaveErrorDetails(String(error?.message || error));
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
    const hasB = !!(subjectB || textB || jobDescriptionB || postscriptB || linkTextB);
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
        
        {/* Siatka wierszy: każdy wiersz to to samo pole A i B, co gwarantuje równą wysokość i wyrównanie linii */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {/* Temat */}
          <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 8, padding: 16 }}>
            <h4 style={{ marginTop: 0 }}>Wariant A — Temat</h4>
            <div style={{ padding: 8, backgroundColor: "#fff", border: "1px solid #ddd", borderRadius: 4, fontWeight: 600 }}>
              {subject || "brak"}
            </div>
          </div>
          <div style={{ background: "white", border: "1px solid #fde68a", borderRadius: 8, padding: 16 }}>
            <h4 style={{ marginTop: 0, color: "#92400e" }}>Wariant B — Temat</h4>
            <div style={{ padding: 8, backgroundColor: "#fff", border: "1px solid #fcd34d", borderRadius: 6, fontWeight: 600 }}>
              {subjectB || "brak"}
            </div>
          </div>

          {/* Treść */}
          <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 8, padding: 16 }}>
            <h4 style={{ marginTop: 0 }}>Wariant A — Treść</h4>
            <div style={{ whiteSpace: "pre-wrap", padding: 12, backgroundColor: "#fff", border: "1px solid #bde0fe", borderRadius: 6, fontFamily: "monospace", fontSize: 14 }}>
              {text || "brak"}
            </div>
          </div>
          <div style={{ background: "white", border: "1px solid #fde68a", borderRadius: 8, padding: 16 }}>
            <h4 style={{ marginTop: 0, color: "#92400e" }}>Wariant B — Treść</h4>
            <div style={{ whiteSpace: "pre-wrap", padding: 12, backgroundColor: "#fff", border: "1px solid #fcd34d", borderRadius: 6, fontFamily: "monospace", fontSize: 14 }}>
              {textB || "brak"}
            </div>
          </div>

          {/* Opis stanowiska */}
          <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 8, padding: 16 }}>
            <h4 style={{ marginTop: 0 }}>Wariant A — Opis stanowiska</h4>
            <div style={{ padding: 8, backgroundColor: "#fff", border: "1px solid #ddd", borderRadius: 4 }}>
              {jobDescription || "brak"}
            </div>
          </div>
          <div style={{ background: "white", border: "1px solid #fde68a", borderRadius: 8, padding: 16 }}>
            <h4 style={{ marginTop: 0, color: "#92400e" }}>Wariant B — Opis stanowiska</h4>
            <div style={{ padding: 8, backgroundColor: "#fff", border: "1px solid #fcd34d", borderRadius: 6 }}>
              {jobDescriptionB || "brak"}
            </div>
          </div>

          {/* PS */}
          <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 8, padding: 16 }}>
            <h4 style={{ marginTop: 0 }}>Wariant A — PS</h4>
            <div style={{ whiteSpace: "pre-wrap", padding: 8, backgroundColor: "#fff", border: "1px solid #ddd", borderRadius: 4 }}>
              {postscript || "brak"}
            </div>
          </div>
          <div style={{ background: "white", border: "1px solid #fde68a", borderRadius: 8, padding: 16 }}>
            <h4 style={{ marginTop: 0, color: "#92400e" }}>Wariant B — PS</h4>
            <div style={{ whiteSpace: "pre-wrap", padding: 8, backgroundColor: "#fff", border: "1px solid #fcd34d", borderRadius: 6 }}>
              {postscriptB || "brak"}
            </div>
          </div>

          {/* Link */}
          <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 8, padding: 16 }}>
            <h4 style={{ marginTop: 0 }}>Wariant A — Link</h4>
            <div style={{ padding: 8, backgroundColor: "#fff", border: "1px solid #ddd", borderRadius: 4 }}>
              {linkText ? (linkUrl ? (<a href={linkUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#0066cc" }}>{linkText}</a>) : (<a href={linkText} target="_blank" rel="noopener noreferrer" style={{ color: "#0066cc" }}>{linkText}</a>)) : "brak"}
            </div>
            <div style={{ marginTop: 8, fontSize: 12, color: "#666" }}>
              URL docelowy (opcjonalny): {linkUrl || "brak"}
            </div>
          </div>
          <div style={{ background: "white", border: "1px solid #fde68a", borderRadius: 8, padding: 16 }}>
            <h4 style={{ marginTop: 0, color: "#92400e" }}>Wariant B — Link</h4>
            <div style={{ padding: 8, backgroundColor: "#fff", border: "1px solid #fcd34d", borderRadius: 6 }}>
              {linkTextB ? (linkUrlB ? (<a href={linkUrlB} target="_blank" rel="noopener noreferrer" style={{ color: "#0066cc" }}>{linkTextB}</a>) : (<a href={linkTextB} target="_blank" rel="noopener noreferrer" style={{ color: "#0066cc" }}>{linkTextB}</a>)) : "brak"}
            </div>
            <div style={{ marginTop: 8, fontSize: 12, color: "#666" }}>
              URL docelowy (opcjonalny): {linkUrlB || "brak"}
            </div>
          </div>
        </div>

        {/* Podsumowanie A/B */}
        <div style={{ marginTop: 16, padding: 12, border: "1px solid #e5e7eb", borderRadius: 6, background: "#fafafa" }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Test A/B</div>
          <div style={{ fontSize: 14, color: "#444" }}>
            Status: <strong>{abTestEnabled ? "włączony" : "wyłączony"}</strong>
            {abTestEnabled && (
              <span style={{ marginLeft: 8 }}>Tryb: <strong>{abTestMode}</strong></span>
            )}
          </div>
        </div>
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
              Podgląd personalizacji
            </button>
          )}
        </div>
      </div>

      {saveError && (
        <div style={{
          marginBottom: 16,
          padding: 12,
          border: "1px solid #dc3545",
          backgroundColor: "#fdecea",
          color: "#842029",
          borderRadius: 4
        }}>
          <div style={{ fontWeight: "bold", marginBottom: 8 }}>{saveError}</div>
          {saveErrorDetails && (
            <pre style={{
              whiteSpace: "pre-wrap",
              overflowX: "auto",
              margin: 0,
              fontFamily: "monospace",
              fontSize: 12
            }}>{saveErrorDetails}</pre>
          )}
        </div>
      )}
      {!abTestEnabled && (
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
            Wklej tutaj gotowy temat i tekst kampanii z ChatGPT. Później AI będzie personalizować tylko kilka zdań na podstawie danych leada.
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
      )}

      {/* A/B Testing Section */}
      <div style={{ marginTop: 30, padding: 20, backgroundColor: "#fff3e0", border: "2px solid #ff9800", borderRadius: 8 }}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "flex", alignItems: "center", cursor: "pointer", fontWeight: "bold", fontSize: "16px" }}>
              <input
                type="checkbox"
                checked={abTestEnabled}
                onChange={(e) => setAbTestEnabled(e.target.checked)}
                style={{ marginRight: 8, width: 18, height: 18, cursor: "pointer" }}
              />
              Włącz test A/B
            </label>
            <p style={{ fontSize: "12px", color: "#666", marginTop: 8, marginLeft: 26 }}>
              Testuj dwa warianty treści kampanii i porównaj ich skuteczność
            </p>
          </div>

          {abTestEnabled && (
            <>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontWeight: "bold", marginBottom: 8 }}>
                  Metoda rozdziału wariantów:
                </label>
                <select
                  value={abTestMode}
                  onChange={(e) => setAbTestMode(e.target.value)}
                  style={{
                    width: "100%",
                    padding: 8,
                    border: "1px solid #ccc",
                    borderRadius: 4,
                    fontSize: "14px"
                  }}
                >
                  <option value="hash">Hash-based (zalecane)</option>
                  <option value="alternating">Alternating (A-B-A-B...)</option>
                  <option value="random">Random (losowy)</option>
                </select>
                <p style={{ fontSize: "11px", color: "#666", marginTop: 4 }}>
                  Hash-based: Lead zawsze dostanie ten sam wariant. Alternating: po kolei A-B-A-B. Random: losowy wybór.
                </p>
              </div>

              {/* Edycja A i B obok siebie */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
                <div>
                  <h4 style={{ margin: 0 }}>Wariant A</h4>
                  <label style={{ display: "block", fontWeight: "bold", margin: "12px 0 8px" }}>Temat</label>
                  <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} style={{ width: "100%", padding: 12, border: "1px solid #ccc", borderRadius: 4, fontSize: 16, marginBottom: 12 }} />
                  <label style={{ display: "block", fontWeight: "bold", marginBottom: 8 }}>Treść</label>
                  <textarea value={text} onChange={(e) => setText(e.target.value)} rows={8} style={{ width: "100%", padding: 12, border: "1px solid #ccc", borderRadius: 4, fontSize: 14, fontFamily: "monospace" }} />
                  <label style={{ display: "block", fontWeight: "bold", margin: "12px 0 8px" }}>Opis stanowiska</label>
                  <input type="text" value={jobDescription} onChange={(e) => setJobDescription(e.target.value)} style={{ width: "100%", padding: 8, border: "1px solid #ccc", borderRadius: 4, fontSize: 14, marginBottom: 8 }} />
                  <label style={{ display: "block", fontWeight: "bold", marginBottom: 8 }}>PS</label>
                  <textarea value={postscript} onChange={(e) => setPostscript(e.target.value)} rows={3} style={{ width: "100%", padding: 8, border: "1px solid #ccc", borderRadius: 4, fontSize: 14, marginBottom: 8 }} />
                  <label style={{ display: "block", fontWeight: "bold", marginBottom: 8 }}>Tekst linku</label>
                  <input type="text" value={linkText} onChange={(e) => setLinkText(e.target.value)} style={{ width: "100%", padding: 8, border: "1px solid #ccc", borderRadius: 4, fontSize: 14, marginBottom: 8 }} />
                  <label style={{ display: "block", fontWeight: "bold", marginBottom: 8 }}>URL docelowy</label>
                  <input type="url" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} style={{ width: "100%", padding: 8, border: "1px solid #ccc", borderRadius: 4, fontSize: 14 }} />
                </div>
                <div>
                  <h4 style={{ margin: 0, color: "#92400e" }}>Wariant B</h4>
                  <label style={{ display: "block", fontWeight: "bold", margin: "12px 0 8px" }}>Temat</label>
                  <input type="text" value={subjectB} onChange={(e) => setSubjectB(e.target.value)} style={{ width: "100%", padding: 12, border: "1px solid #ccc", borderRadius: 4, fontSize: 16, marginBottom: 12 }} />
                  <label style={{ display: "block", fontWeight: "bold", marginBottom: 8 }}>Treść</label>
                  <textarea value={textB} onChange={(e) => setTextB(e.target.value)} rows={8} style={{ width: "100%", padding: 12, border: "1px solid #ccc", borderRadius: 4, fontSize: 14, fontFamily: "monospace" }} />
                  <label style={{ display: "block", fontWeight: "bold", margin: "12px 0 8px" }}>Opis stanowiska</label>
                  <input type="text" value={jobDescriptionB} onChange={(e) => setJobDescriptionB(e.target.value)} style={{ width: "100%", padding: 8, border: "1px solid #ccc", borderRadius: 4, fontSize: 14, marginBottom: 8 }} />
                  <label style={{ display: "block", fontWeight: "bold", marginBottom: 8 }}>PS</label>
                  <textarea value={postscriptB} onChange={(e) => setPostscriptB(e.target.value)} rows={3} style={{ width: "100%", padding: 8, border: "1px solid #ccc", borderRadius: 4, fontSize: 14, marginBottom: 8 }} />
                  <label style={{ display: "block", fontWeight: "bold", marginBottom: 8 }}>Tekst linku</label>
                  <input type="text" value={linkTextB} onChange={(e) => setLinkTextB(e.target.value)} style={{ width: "100%", padding: 8, border: "1px solid #ccc", borderRadius: 4, fontSize: 14, marginBottom: 8 }} />
                  <label style={{ display: "block", fontWeight: "bold", marginBottom: 8 }}>URL docelowy</label>
                  <input type="url" value={linkUrlB} onChange={(e) => setLinkUrlB(e.target.value)} style={{ width: "100%", padding: 8, border: "1px solid #ccc", borderRadius: 4, fontSize: 14 }} />
                </div>
              </div>
            </>
          )}
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
              <h3>Podgląd personalizacji</h3>
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
                Zamknij
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
                Wygeneruj personalizację
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

