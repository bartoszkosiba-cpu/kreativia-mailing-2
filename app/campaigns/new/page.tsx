"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface ContentVersion {
  id: number;
  label: string;
  subject: string;
  content: string;
  type: string;
  status: string;
  productGroup: string;
  theme: string;
}

export default function NewCampaignPage() {
  const [isCreating, setIsCreating] = useState(false);
  const [contentVersions, setContentVersions] = useState<ContentVersion[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    subject: "",
    text: "",
    jobDescription: "",
    postscript: "",
    linkText: "www.kreativia.eu",
    linkUrl: "",
    dailyLimit: 200,
    contentVersionId: null as number | null, // DEPRECATED
    savedContentId: null as number | null // NOWE
  });
  const router = useRouter();

  useEffect(() => {
    fetchSavedContents();
    
    // Auto-load z URL param
    const params = new URLSearchParams(window.location.search);
    const savedContentId = params.get('savedContentId');
    if (savedContentId) {
      loadFromSavedContent(Number(savedContentId));
    }
  }, []);

  const fetchSavedContents = async () => {
    try {
      // Pobierz wszystkie SavedContent (ze wszystkich grup)
      const res = await fetch("/api/content-planner/saved-contents/all");
      if (res.ok) {
        const data = await res.json();
        setContentVersions(data.contents); // Recycle state
      }
    } catch (error) {
      console.error("Błąd pobierania:", error);
    }
  };

  const loadFromSavedContent = async (contentId: number) => {
    try {
      const res = await fetch(`/api/content-planner/saved-contents/${contentId}`);
      if (res.ok) {
        const data = await res.json();
        const content = data.content;
        
        setSelectedVersionId(contentId);
        setFormData({
          ...formData,
          name: content.name,
          subject: content.subject,
          text: content.content,
          contentVersionId: null, // DEPRECATED
          savedContentId: contentId // NOWE
        });
      }
    } catch (error) {
      console.error("Błąd ładowania content:", error);
    }
  };

  const handleSelectVersion = (versionId: number) => {
    const version = contentVersions.find(v => v.id === versionId);
    if (version) {
      setSelectedVersionId(versionId);
      setFormData({
        ...formData,
        subject: version.subject,
        text: version.content,
        contentVersionId: versionId,
        name: formData.name || `${version.productGroup} - ${version.theme}`
      });
    }
  };

  const handleClearVersion = () => {
    setSelectedVersionId(null);
    setFormData({
      ...formData,
      subject: "",
      text: "",
      contentVersionId: null
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert("Nazwa kampanii jest wymagana!");
      return;
    }

    setIsCreating(true);
    try {
      const response = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Błąd tworzenia kampanii");
      }

      const result = await response.json();
      alert(`✅ Kampania "${formData.name}" została utworzona!`);
      router.push(`/campaigns/${result.id}`);
    } catch (error: any) {
      alert(`❌ Błąd: ${error.message}`);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <main className="container" style={{ paddingTop: "var(--spacing-xl)", paddingBottom: "var(--spacing-2xl)" }}>
      <div style={{ marginBottom: "24px" }}>
        <Link 
          href="/campaigns" 
          style={{ 
            color: "var(--primary)", 
            textDecoration: "none",
            fontSize: "14px",
            fontWeight: "500"
          }}
        >
          ← Powrót do kampanii
        </Link>
        <h1 style={{ margin: "16px 0" }}>Nowa kampania</h1>
      </div>

      <form onSubmit={handleSubmit} style={{ maxWidth: "800px" }}>
        <div style={{ display: "grid", gap: "24px" }}>
          {/* Podstawowe informacje */}
          <div style={{ 
            padding: "24px", 
            border: "1px solid var(--gray-200)", 
            borderRadius: "8px",
            backgroundColor: "white"
          }}>
            <h2 style={{ margin: "0 0 16px 0", fontSize: "18px" }}>Podstawowe informacje</h2>
            
            <div style={{ display: "grid", gap: "16px" }}>
              <div>
                <label style={{ display: "block", marginBottom: "8px", fontWeight: "600" }}>
                  Nazwa kampanii *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  placeholder="np. Kampania jesień 2025"
                  style={{
                    width: "100%",
                    padding: "12px",
                    border: "1px solid var(--gray-300)",
                    borderRadius: "6px",
                    fontSize: "16px"
                  }}
                  required
                />
              </div>

              <div>
                <label style={{ display: "block", marginBottom: "8px", fontWeight: "600" }}>
                  Opis kampanii
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  placeholder="Krótki opis kampanii..."
                  rows={3}
                  style={{
                    width: "100%",
                    padding: "12px",
                    border: "1px solid var(--gray-300)",
                    borderRadius: "6px",
                    fontSize: "16px",
                    resize: "vertical"
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", marginBottom: "8px", fontWeight: "600" }}>
                  Limit maili dziennie
                </label>
                <input
                  type="number"
                  value={formData.dailyLimit}
                  onChange={(e) => setFormData({...formData, dailyLimit: parseInt(e.target.value) || 200})}
                  min="1"
                  max="1000"
                  style={{
                    width: "100%",
                    padding: "12px",
                    border: "1px solid var(--gray-300)",
                    borderRadius: "6px",
                    fontSize: "16px"
                  }}
                />
              </div>
            </div>
          </div>

          {/* Treść emaila */}
          <div style={{ 
            padding: "24px", 
            border: "1px solid var(--gray-200)", 
            borderRadius: "8px",
            backgroundColor: "white"
          }}>
            <h2 style={{ margin: "0 0 16px 0", fontSize: "18px" }}>Treść emaila</h2>
            
            {/* SELEKTOR TREŚCI Z CONTENT PLANNER */}
            <div style={{ 
              padding: 16, 
              backgroundColor: "#f0f9ff", 
              borderRadius: 8, 
              marginBottom: 20,
              border: "2px solid #bae6fd"
            }}>
              <div style={{ fontWeight: 600, marginBottom: 12, color: "#0369a1", fontSize: 14 }}>
                🎨 Użyj treści z Content Planner
              </div>
              
              {contentVersions.length === 0 ? (
                <div style={{ fontSize: 13, color: "#666" }}>
                  Brak zapisanych wersji. <Link href="/content-planner" style={{ color: "var(--color-primary)" }}>Utwórz w Planerze →</Link>
                </div>
              ) : (
                <div>
                  <select
                    value={selectedVersionId || ""}
                    onChange={(e) => handleSelectVersion(Number(e.target.value))}
                    style={{ 
                      width: "100%", 
                      padding: 10, 
                      fontSize: 13,
                      marginBottom: 8,
                      border: "2px solid #bae6fd",
                      borderRadius: 6
                    }}
                  >
                    <option value="">-- Wybierz zapisaną treść --</option>
                    {contentVersions.map(v => (
                      <option key={v.id} value={v.id}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                  
                  {selectedVersionId && (
                    <div style={{ fontSize: 12, color: "#0369a1" }}>
                      ✅ Wybrano treść z Content Planner • 
                      <button
                        type="button"
                        onClick={handleClearVersion}
                        style={{
                          marginLeft: 8,
                          background: "none",
                          border: "none",
                          color: "#dc2626",
                          cursor: "pointer",
                          textDecoration: "underline",
                          fontSize: 12
                        }}
                      >
                        Wyczyść i wpisz ręcznie
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div style={{ display: "grid", gap: "16px" }}>
              <div>
                <label style={{ display: "block", marginBottom: "8px", fontWeight: "600" }}>
                  Temat emaila
                  {selectedVersionId && (
                    <span style={{ marginLeft: 8, fontSize: 12, color: "#10b981", fontWeight: 400 }}>
                      (z Content Planner)
                    </span>
                  )}
                </label>
                <input
                  type="text"
                  value={formData.subject}
                  onChange={(e) => setFormData({...formData, subject: e.target.value})}
                  placeholder="np. Oferta materiałów VM i POS"
                  style={{
                    width: "100%",
                    padding: "12px",
                    border: "1px solid var(--gray-300)",
                    borderRadius: "6px",
                    fontSize: "16px"
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", marginBottom: "8px", fontWeight: "600" }}>
                  Opis stanowiska (pod imieniem handlowca)
                </label>
                <input
                  type="text"
                  value={formData.jobDescription}
                  onChange={(e) => setFormData({...formData, jobDescription: e.target.value})}
                  placeholder="np. Wspieram sieci retail w sprawnej produkcji materiałów VM i POS"
                  style={{
                    width: "100%",
                    padding: "12px",
                    border: "1px solid var(--gray-300)",
                    borderRadius: "6px",
                    fontSize: "16px"
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", marginBottom: "8px", fontWeight: "600" }}>
                  Treść emaila
                  {selectedVersionId && (
                    <span style={{ marginLeft: 8, fontSize: 12, color: "#10b981", fontWeight: 400 }}>
                      (z Content Planner - możesz edytować)
                    </span>
                  )}
                </label>
                <textarea
                  value={formData.text}
                  onChange={(e) => setFormData({...formData, text: e.target.value})}
                  placeholder="Główna treść wiadomości..."
                  rows={12}
                  style={{
                    width: "100%",
                    padding: "12px",
                    border: "1px solid var(--gray-300)",
                    borderRadius: "6px",
                    fontSize: "16px",
                    resize: "vertical"
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", marginBottom: "8px", fontWeight: "600" }}>
                  PS (Postscriptum)
                </label>
                <textarea
                  value={formData.postscript}
                  onChange={(e) => setFormData({...formData, postscript: e.target.value})}
                  placeholder="Dodatkowe informacje na końcu..."
                  rows={3}
                  style={{
                    width: "100%",
                    padding: "12px",
                    border: "1px solid var(--gray-300)",
                    borderRadius: "6px",
                    fontSize: "16px",
                    resize: "vertical"
                  }}
                />
              </div>
            </div>
          </div>

          {/* Link */}
          <div style={{ 
            padding: "24px", 
            border: "1px solid var(--gray-200)", 
            borderRadius: "8px",
            backgroundColor: "white"
          }}>
            <h2 style={{ margin: "0 0 16px 0", fontSize: "18px" }}>Link w stopce</h2>
            
            <div style={{ display: "grid", gap: "16px" }}>
              <div>
                <label style={{ display: "block", marginBottom: "8px", fontWeight: "600" }}>
                  Tekst wyświetlany
                </label>
                <input
                  type="text"
                  value={formData.linkText}
                  onChange={(e) => setFormData({...formData, linkText: e.target.value})}
                  placeholder="www.kreativia.eu"
                  style={{
                    width: "100%",
                    padding: "12px",
                    border: "1px solid var(--gray-300)",
                    borderRadius: "6px",
                    fontSize: "16px"
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", marginBottom: "8px", fontWeight: "600" }}>
                  URL docelowy (opcjonalny)
                </label>
                <input
                  type="url"
                  value={formData.linkUrl}
                  onChange={(e) => setFormData({...formData, linkUrl: e.target.value})}
                  placeholder="https://kreativia.eu/..."
                  style={{
                    width: "100%",
                    padding: "12px",
                    border: "1px solid var(--gray-300)",
                    borderRadius: "6px",
                    fontSize: "16px"
                  }}
                />
                <p style={{ fontSize: "14px", color: "#666", marginTop: "8px" }}>
                  Jeśli pozostawisz puste, użyje się tekstu wyświetlanego jako URL
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Przyciski */}
        <div style={{ 
          display: "flex", 
          gap: "16px", 
          justifyContent: "flex-end",
          marginTop: "32px",
          paddingTop: "24px",
          borderTop: "1px solid var(--gray-200)"
        }}>
          <Link 
            href="/campaigns"
            style={{
              padding: "12px 24px",
              backgroundColor: "var(--gray-300)",
              color: "var(--gray-800)",
              textDecoration: "none",
              borderRadius: "6px",
              fontWeight: "600"
            }}
          >
            Anuluj
          </Link>
          <button
            type="submit"
            disabled={isCreating}
            style={{
              padding: "12px 24px",
              backgroundColor: isCreating ? "var(--gray-400)" : "var(--primary)",
              color: "white",
              border: "none",
              borderRadius: "6px",
              fontWeight: "600",
              cursor: isCreating ? "not-allowed" : "pointer",
              fontSize: "16px"
            }}
          >
            {isCreating ? "Tworzenie..." : "✅ Utwórz kampanię"}
          </button>
        </div>
      </form>
    </main>
  );
}