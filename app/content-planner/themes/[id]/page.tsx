"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface ConversationMessage {
  role: "system" | "user" | "assistant";
  content: string;
  timestamp: string;
}

interface CampaignTheme {
  id: number;
  name: string;
  description: string | null;
  status: string;
  briefingProgress: number;
  conversationHistory: ConversationMessage[];
  briefingData: any;
  productGroup: {
    id: number;
    name: string;
    iconEmoji: string | null;
  };
  versions: CampaignVersion[];
}

interface CampaignVersion {
  id: number;
  versionNumber: number;
  type: string;
  variantLetter: string | null;
  subject: string;
  content: string;
  aiRationale: string | null;
  status: string;
  approvedAt: string | null;
}

export default function CampaignThemeChatPage() {
  const params = useParams();
  const themeId = Number(params.id);

  const [theme, setTheme] = useState<CampaignTheme | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedType, setSelectedType] = useState<string>("initial");
  const [expandedVersion, setExpandedVersion] = useState<number | null>(null);
  const [editingVersion, setEditingVersion] = useState<number | null>(null);
  const [editSubject, setEditSubject] = useState("");
  const [editContent, setEditContent] = useState("");
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualSubject, setManualSubject] = useState("");
  const [manualContent, setManualContent] = useState("");
  const [manualType, setManualType] = useState("initial");
  
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchTheme();
  }, [themeId]);

  useEffect(() => {
    // Auto-scroll do dołu czatu
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [theme?.conversationHistory]);

  const fetchTheme = async () => {
    try {
      const res = await fetch(`/api/content-planner/themes/${themeId}`);
      if (res.ok) {
        const data = await res.json();
        setTheme(data);
      }
    } catch (error) {
      console.error("Błąd pobierania tematu:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!message.trim()) return;

    setIsSending(true);
    const userMessage = message;
    setMessage(""); // Wyczyść input od razu

    try {
      const res = await fetch(`/api/content-planner/themes/${themeId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage })
      });

      if (res.ok) {
        fetchTheme(); // Odśwież temat (zawiera nową historię)
      } else {
        const data = await res.json();
        alert(`❌ Błąd: ${data.error}`);
      }
    } catch (error) {
      alert(`❌ Błąd: ${error}`);
    } finally {
      setIsSending(false);
    }
  };

  const handleGenerate = async () => {
    if (!confirm(`Wygenerować 3 warianty (A, B, C) dla "${selectedType}"?\n\nUpewnij się że briefing jest kompletny!`)) {
      return;
    }

    setIsGenerating(true);

    try {
      const res = await fetch(`/api/content-planner/themes/${themeId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: selectedType })
      });

      if (res.ok) {
        alert("✅ Wygenerowano 3 warianty! Sprawdź panel podglądu poniżej.");
        fetchTheme();
      } else {
        const data = await res.json();
        alert(`❌ Błąd: ${data.error}`);
      }
    } catch (error) {
      alert(`❌ Błąd: ${error}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApprove = async (versionId: number) => {
    if (!confirm("Zatwierdzić tę wersję? Pozostałe warianty zostaną odrzucone.")) {
      return;
    }

    try {
      const res = await fetch(`/api/content-planner/versions/${versionId}/approve`, {
        method: "POST"
      });

      if (res.ok) {
        alert("✅ Wersja zatwierdzona!");
        fetchTheme();
      } else {
        alert("❌ Błąd zatwierdzania");
      }
    } catch (error) {
      alert(`❌ Błąd: ${error}`);
    }
  };

  const handleExportToCampaign = async (versionId: number) => {
    const campaignName = prompt("Podaj nazwę nowej kampanii:");
    if (!campaignName) return;

    // TODO: Wybór handlowca (na razie null)
    const virtualSalespersonId = null;

    try {
      const res = await fetch(`/api/content-planner/versions/${versionId}/export-to-campaign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignName, virtualSalespersonId })
      });

      if (res.ok) {
        const data = await res.json();
        if (confirm(`✅ Kampania "${campaignName}" utworzona!\n\nCzy chcesz przejść do kampanii?`)) {
          window.location.href = `/campaigns/${data.campaign.id}`;
        }
      } else {
        const data = await res.json();
        alert(`❌ Błąd: ${data.error}`);
      }
    } catch (error) {
      alert(`❌ Błąd: ${error}`);
    }
  };

  const handleEdit = (version: CampaignVersion) => {
    setEditingVersion(version.id);
    setEditSubject(version.subject);
    setEditContent(version.content);
  };

  const handleSaveEdit = async (versionId: number) => {
    try {
      const res = await fetch(`/api/content-planner/versions/${versionId}/update`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: editSubject,
          content: editContent,
          userFeedback: "Ręcznie edytowane przez użytkownika"
        })
      });

      if (res.ok) {
        alert("✅ Treść zapisana!");
        setEditingVersion(null);
        fetchTheme();
      } else {
        alert("❌ Błąd zapisu");
      }
    } catch (error) {
      alert(`❌ Błąd: ${error}`);
    }
  };

  const handleCancelEdit = () => {
    setEditingVersion(null);
    setEditSubject("");
    setEditContent("");
  };

  const handleCreateManual = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const res = await fetch(`/api/content-planner/themes/${themeId}/manual-version`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: manualType,
          subject: manualSubject,
          content: manualContent
        })
      });

      if (res.ok) {
        alert("✅ Wersja zapisana!");
        setShowManualForm(false);
        setManualSubject("");
        setManualContent("");
        fetchTheme();
      } else {
        const data = await res.json();
        alert(`❌ Błąd: ${data.error}`);
      }
    } catch (error) {
      alert(`❌ Błąd: ${error}`);
    }
  };

  if (isLoading) {
    return <main className="container" style={{ paddingTop: "var(--spacing-xl)" }}>Ładowanie...</main>;
  }

  if (!theme) {
    return <main className="container" style={{ paddingTop: "var(--spacing-xl)" }}>Temat nie istnieje</main>;
  }

  // Grupuj wersje po typie
  const versionsByType = theme.versions.reduce((acc, v) => {
    if (!acc[v.type]) acc[v.type] = [];
    acc[v.type].push(v);
    return acc;
  }, {} as Record<string, CampaignVersion[]>);

  return (
    <main className="container" style={{ paddingTop: "var(--spacing-xl)", paddingBottom: "var(--spacing-2xl)" }}>
      <div style={{ marginBottom: 20 }}>
        <Link href={`/content-planner/groups/${theme.productGroup.id}`}>
          ← Wróć do grupy: {theme.productGroup.name}
        </Link>
      </div>

      {/* Nagłówek */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <div style={{ fontSize: 32 }}>{theme.productGroup.iconEmoji}</div>
          <div>
            <h1 style={{ margin: 0, fontSize: 24 }}>{theme.name}</h1>
            <div style={{ fontSize: 14, color: "#666" }}>
              {theme.productGroup.name}
              {theme.description && ` • ${theme.description}`}
            </div>
          </div>
        </div>

        {/* Progress */}
        <div style={{ marginTop: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#666", marginBottom: 4 }}>
            <span>Postęp briefingu:</span>
            <span>{theme.briefingProgress}%</span>
          </div>
          <div style={{ backgroundColor: "#e5e7eb", borderRadius: 4, height: 8, overflow: "hidden" }}>
            <div style={{
              width: `${theme.briefingProgress}%`,
              height: "100%",
              backgroundColor: theme.briefingProgress === 100 ? "#10b981" : "#f59e0b",
              transition: "width 0.3s"
            }}/>
          </div>
        </div>
      </div>

      {/* Layout: Chat (left) + Briefing (right sidebar) */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 24, marginBottom: 32 }}>
        
        {/* CHAT PANEL */}
        <div className="card" style={{ padding: 0, height: "600px", display: "flex", flexDirection: "column" }}>
          {/* Chat header */}
          <div style={{ padding: "16px 20px", borderBottom: "2px solid #e5e7eb", backgroundColor: "#f9fafb" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ fontSize: 24 }}>🤖</div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 16 }}>AI Content Assistant</div>
                <div style={{ fontSize: 12, color: "#666" }}>Powered by GPT-4o</div>
              </div>
            </div>
          </div>

          {/* Chat messages */}
          <div style={{ 
            flex: 1, 
            overflowY: "auto", 
            padding: 20,
            backgroundColor: "#fafafa"
          }}>
            {theme.conversationHistory.length === 0 ? (
              <div style={{ textAlign: "center", padding: 40, color: "#999" }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>💬</div>
                <p>Brak historii rozmowy</p>
                <p style={{ fontSize: 14 }}>Napisz pierwszą wiadomość aby rozpocząć briefing</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {theme.conversationHistory.map((msg, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      justifyContent: msg.role === "user" ? "flex-end" : "flex-start"
                    }}
                  >
                    <div
                      style={{
                        maxWidth: "70%",
                        padding: 12,
                        borderRadius: 8,
                        backgroundColor: msg.role === "user" ? "var(--color-primary)" : "white",
                        color: msg.role === "user" ? "white" : "#111",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word"
                      }}
                    >
                      {msg.role === "assistant" && (
                        <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 6 }}>
                          🤖 AI Content Assistant
                        </div>
                      )}
                      {msg.content}
                      <div style={{ 
                        fontSize: 10, 
                        opacity: 0.5, 
                        marginTop: 6,
                        textAlign: "right"
                      }}>
                        {new Date(msg.timestamp).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
            )}
          </div>

          {/* Chat input */}
          <form 
            onSubmit={handleSendMessage}
            style={{ 
              padding: 16, 
              borderTop: "2px solid #e5e7eb",
              backgroundColor: "white"
            }}
          >
            <div style={{ display: "flex", gap: 12 }}>
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Wpisz wiadomość do AI..."
                disabled={isSending}
                style={{
                  flex: 1,
                  padding: "10px 16px",
                  border: "2px solid #e5e7eb",
                  borderRadius: 8,
                  fontSize: 14
                }}
              />
              <button
                type="submit"
                disabled={isSending || !message.trim()}
                className="btn btn-primary"
                style={{ minWidth: 100 }}
              >
                {isSending ? "⏳" : "📤 Wyślij"}
              </button>
            </div>
          </form>
        </div>

        {/* BRIEFING SIDEBAR */}
        <div>
          <div className="card" style={{ padding: 20, marginBottom: 16 }}>
            <h3 style={{ margin: "0 0 16px 0", fontSize: 16 }}>📋 Zebrane dane</h3>
            
            {Object.keys(theme.briefingData || {}).length === 0 ? (
              <div style={{ padding: 20, textAlign: "center", color: "#999", fontSize: 13 }}>
                Briefing jeszcze nie rozpoczęty
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12, fontSize: 13 }}>
                {Object.entries(theme.briefingData).map(([key, value]) => (
                  <div key={key}>
                    <div style={{ fontWeight: 600, color: "#666", fontSize: 11, textTransform: "uppercase", marginBottom: 4 }}>
                      {key}
                    </div>
                    <div style={{ color: "#111" }}>{value as string}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Przycisk generowania */}
          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ margin: "0 0 12px 0", fontSize: 16 }}>⚡ Generuj treść</h3>
            
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#666" }}>Typ maila:</label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                style={{ width: "100%", padding: 8, marginTop: 4 }}
              >
                <option value="initial">📧 Mail początkowy</option>
                <option value="followup_1">📨 Follow-up 1</option>
                <option value="followup_2">📨 Follow-up 2</option>
                <option value="followup_3">📨 Follow-up 3</option>
                <option value="followup_4">📨 Follow-up 4</option>
              </select>
            </div>

            <button
              onClick={handleGenerate}
              disabled={isGenerating || theme.briefingProgress < 50}
              className="btn btn-success"
              style={{ width: "100%", marginBottom: 8 }}
            >
              {isGenerating ? "⏳ Generu ję..." : "✨ Wygeneruj 3 warianty"}
            </button>

            {theme.briefingProgress < 50 && (
              <div style={{ fontSize: 11, color: "#dc2626", marginTop: 8 }}>
                ⚠️ Uzupełnij briefing (min. 50%)
              </div>
            )}

            <div style={{ fontSize: 11, color: "#666", marginTop: 12, lineHeight: 1.4 }}>
              💡 AI wygeneruje 3 warianty (A, B, C) tego samego maila z różnymi podejściami
            </div>
          </div>
        </div>
      </div>

      {/* RĘCZNE DODAWANIE WERSJI */}
      <div style={{ marginBottom: 32 }}>
        <button
          onClick={() => setShowManualForm(!showManualForm)}
          className="btn btn-secondary"
        >
          {showManualForm ? "❌ Anuluj" : "✏️ Dodaj własną wersję (bez AI)"}
        </button>

        {showManualForm && (
          <div className="card" style={{ padding: 24, marginTop: 16, backgroundColor: "#f9fafb" }}>
            <h3 style={{ marginBottom: 16 }}>✏️ Twoja własna wersja</h3>
            <p style={{ fontSize: 13, color: "#666", marginBottom: 16 }}>
              Wklej lub napisz własną treść maila. Możesz ją potem edytować i zapisać jako Campaign.
            </p>

            <form onSubmit={handleCreateManual}>
              <div style={{ display: "grid", gap: 16 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: "#666" }}>Typ maila:</label>
                  <select
                    value={manualType}
                    onChange={(e) => setManualType(e.target.value)}
                    style={{ width: "100%", padding: 8, marginTop: 4 }}
                  >
                    <option value="initial">📧 Mail początkowy</option>
                    <option value="followup_1">📨 Follow-up 1</option>
                    <option value="followup_2">📨 Follow-up 2</option>
                    <option value="followup_3">📨 Follow-up 3</option>
                    <option value="followup_4">📨 Follow-up 4</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: "#666" }}>Temat maila:</label>
                  <input
                    type="text"
                    value={manualSubject}
                    onChange={(e) => setManualSubject(e.target.value)}
                    required
                    placeholder="np. Szybki montaż podwieszeń - 15 minut zamiast 2 godzin"
                    style={{ width: "100%", padding: 10, marginTop: 4, fontSize: 14 }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: "#666" }}>Treść maila:</label>
                  <textarea
                    value={manualContent}
                    onChange={(e) => setManualContent(e.target.value)}
                    required
                    placeholder="Dzień dobry,&#10;&#10;Jako producent systemów wystawienniczych realizujemy podwieszenia targowe w 15 minut zamiast standardowych 2 godzin.&#10;&#10;Chętnie pokażę realizacje.&#10;&#10;Pozdrawiam"
                    rows={10}
                    style={{ width: "100%", padding: 10, marginTop: 4, fontSize: 13, lineHeight: 1.5, fontFamily: "inherit" }}
                  />
                  <small style={{ color: "#666", fontSize: 11 }}>
                    💡 Możesz wkleić gotową treść lub napisać od zera. Zawsze możesz to potem edytować.
                  </small>
                </div>

                <div style={{ display: "flex", gap: 12 }}>
                  <button type="submit" className="btn btn-success">
                    💾 Zapisz wersję
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setShowManualForm(false)}
                    className="btn btn-secondary"
                  >
                    ❌ Anuluj
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* WYGENEROWANE WERSJE */}
      {Object.keys(versionsByType).length > 0 && (
        <div>
          <h2 style={{ marginBottom: 20 }}>📝 Zapisane wersje</h2>

          {Object.entries(versionsByType).map(([type, versions]) => {
            const typeLabels: Record<string, string> = {
              "initial": "📧 Mail początkowy",
              "followup_1": "📨 Follow-up 1",
              "followup_2": "📨 Follow-up 2",
              "followup_3": "📨 Follow-up 3",
              "followup_4": "📨 Follow-up 4"
            };

            // Grupuj po versionNumber (każdy numer = 3 warianty A,B,C)
            const byVersionNumber = versions.reduce((acc, v) => {
              if (!acc[v.versionNumber]) acc[v.versionNumber] = [];
              acc[v.versionNumber].push(v);
              return acc;
            }, {} as Record<number, CampaignVersion[]>);

            return (
              <div key={type} style={{ marginBottom: 32 }}>
                <h3 style={{ marginBottom: 16, fontSize: 18 }}>
                  {typeLabels[type] || type}
                </h3>

                {Object.entries(byVersionNumber)
                  .sort(([a], [b]) => Number(b) - Number(a)) // Najnowsze pierwsze
                  .map(([vNum, variants]) => (
                    <div key={vNum} style={{ marginBottom: 24 }}>
                      <div style={{ fontSize: 13, color: "#666", marginBottom: 12, fontWeight: 600 }}>
                        Wersja {vNum} {Number(vNum) > 1 && "(iteracja)"}
                      </div>

                      {/* 3 warianty obok siebie */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
                        {variants
                          .sort((a, b) => (a.variantLetter || "").localeCompare(b.variantLetter || ""))
                          .map((version) => (
                            <div
                              key={version.id}
                              className="card"
                              style={{
                                padding: 16,
                                borderLeft: `4px solid ${version.status === "approved" ? "#10b981" : version.status === "rejected" ? "#dc2626" : "#3b82f6"}`,
                                opacity: version.status === "rejected" ? 0.6 : 1
                              }}
                            >
                              {/* Header wariantu */}
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                                <div style={{ 
                                  fontWeight: 700, 
                                  fontSize: 16,
                                  color: version.status === "approved" ? "#10b981" : "#3b82f6"
                                }}>
                                  Wariant {version.variantLetter}
                                  {version.status === "approved" && " ✅"}
                                </div>
                                {/* Status badge */}
                                {version.status === "approved" && (
                                  <span style={{
                                    fontSize: 11,
                                    padding: "4px 8px",
                                    backgroundColor: "#10b981",
                                    color: "white",
                                    borderRadius: 4,
                                    fontWeight: 600
                                  }}>
                                    ✓ Zatwierdzony
                                  </span>
                                )}
                              </div>

                              {/* Temat - edytowalny */}
                              <div style={{ marginBottom: 12 }}>
                                <div style={{ fontSize: 11, color: "#666", marginBottom: 4, fontWeight: 600 }}>
                                  TEMAT:
                                </div>
                                {editingVersion === version.id ? (
                                  <input
                                    type="text"
                                    value={editSubject}
                                    onChange={(e) => setEditSubject(e.target.value)}
                                    style={{
                                      width: "100%",
                                      padding: 8,
                                      fontSize: 13,
                                      fontWeight: 600,
                                      border: "2px solid var(--color-primary)",
                                      borderRadius: 4
                                    }}
                                  />
                                ) : (
                                  <div style={{ fontSize: 13, fontWeight: 600, color: "#111", lineHeight: 1.3 }}>
                                    {version.subject}
                                  </div>
                                )}
                              </div>

                              {/* Treść - edytowalna */}
                              <div style={{ marginBottom: 12 }}>
                                <div style={{ fontSize: 11, color: "#666", marginBottom: 4, fontWeight: 600 }}>
                                  TREŚĆ:
                                </div>
                                {editingVersion === version.id ? (
                                  <textarea
                                    value={editContent}
                                    onChange={(e) => setEditContent(e.target.value)}
                                    rows={12}
                                    style={{
                                      width: "100%",
                                      padding: 8,
                                      fontSize: 12,
                                      lineHeight: 1.5,
                                      border: "2px solid var(--color-primary)",
                                      borderRadius: 4,
                                      fontFamily: "inherit"
                                    }}
                                  />
                                ) : (
                                  <>
                                    <div style={{
                                      fontSize: 12,
                                      color: "#333",
                                      lineHeight: 1.5,
                                      maxHeight: expandedVersion === version.id ? "none" : 150,
                                      overflow: "hidden",
                                      position: "relative",
                                      whiteSpace: "pre-wrap"
                                    }}>
                                      {version.content}
                                      {expandedVersion !== version.id && version.content.length > 200 && (
                                        <div style={{
                                          position: "absolute",
                                          bottom: 0,
                                          left: 0,
                                          right: 0,
                                          height: 40,
                                          background: "linear-gradient(transparent, white)"
                                        }}/>
                                      )}
                                    </div>
                                    {version.content.length > 200 && (
                                      <button
                                        onClick={() => setExpandedVersion(expandedVersion === version.id ? null : version.id)}
                                        style={{
                                          marginTop: 8,
                                          fontSize: 11,
                                          color: "var(--color-primary)",
                                          background: "none",
                                          border: "none",
                                          cursor: "pointer",
                                          fontWeight: 600
                                        }}
                                      >
                                        {expandedVersion === version.id ? "🔼 Zwiń" : "🔽 Pokaż więcej"}
                                      </button>
                                    )}
                                  </>
                                )}
                              </div>

                              {/* Przyciski akcji */}
                              {editingVersion === version.id ? (
                                <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                                  <button
                                    onClick={() => handleSaveEdit(version.id)}
                                    className="btn btn-sm btn-success"
                                    style={{ flex: 1, fontSize: 11, padding: "6px 8px" }}
                                  >
                                    💾 Zapisz zmiany
                                  </button>
                                  <button
                                    onClick={handleCancelEdit}
                                    className="btn btn-sm btn-secondary"
                                    style={{ fontSize: 11, padding: "6px 8px" }}
                                  >
                                    ❌
                                  </button>
                                </div>
                              ) : (
                                <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                                  <button
                                    onClick={() => handleEdit(version)}
                                    className="btn btn-sm"
                                    style={{ flex: 1, fontSize: 11, padding: "6px 8px", backgroundColor: "#6b7280", color: "white" }}
                                  >
                                    ✏️ Edytuj
                                  </button>
                                  <button
                                    onClick={() => handleExportToCampaign(version.id)}
                                    className="btn btn-sm btn-primary"
                                    style={{ flex: 1, fontSize: 11, padding: "6px 8px" }}
                                  >
                                    💾 Zapisz jako Campaign
                                  </button>
                                </div>
                              )}

                              {/* Rationale */}
                              {version.aiRationale && (
                                <div style={{ 
                                  padding: 10, 
                                  backgroundColor: "#f0f9ff", 
                                  borderRadius: 6,
                                  fontSize: 11,
                                  color: "#0369a1",
                                  lineHeight: 1.4
                                }}>
                                  💡 {version.aiRationale}
                                </div>
                              )}
                            </div>
                          ))}
                      </div>
                    </div>
                  ))}
              </div>
            );
          })}
        </div>
      )}

      {/* Quick actions */}
      {theme.briefingProgress === 100 && Object.keys(versionsByType).length === 0 && (
        <div className="alert alert-success" style={{ marginTop: 24 }}>
          🎉 <strong>Briefing kompletny!</strong> Możesz teraz wygenerować treści kampanii. Zacznij od "Mail początkowy".
        </div>
      )}
    </main>
  );
}

