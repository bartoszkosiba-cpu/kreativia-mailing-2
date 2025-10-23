"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

interface ProductGroup {
  id: number;
  name: string;
  description: string | null;
  iconEmoji: string | null;
  targetAudience: string | null;
  conversationHistory: ConversationMessage[];
}

interface SavedContent {
  id: number;
  name: string;
  subject: string;
  content: string;
  type: string;
  language: string;
  notes: string | null;
  tags: string | null;
  sourceType: string;
  isFavorite: boolean;
  usageCount: number;
  createdAt: string;
}

export default function ProductGroupChatPage() {
  const params = useParams();
  const router = useRouter();
  const groupId = Number(params.id);

  const [group, setGroup] = useState<ProductGroup | null>(null);
  const [savedContents, setSavedContents] = useState<SavedContent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [expandedContent, setExpandedContent] = useState<number | null>(null);
  const [editingContent, setEditingContent] = useState<number | null>(null);
  
  const [saveFormData, setSaveFormData] = useState({
    name: "",
    subject: "",
    content: "",
    type: "initial",
    notes: ""
  });

  const [editFormData, setEditFormData] = useState({
    name: "",
    subject: "",
    content: "",
    notes: ""
  });

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchData();
  }, [groupId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [group?.conversationHistory]);

  const fetchData = async () => {
    try {
      const [groupRes, contentsRes] = await Promise.all([
        fetch(`/api/content-planner/groups/${groupId}`),
        fetch(`/api/content-planner/groups/${groupId}/saved-contents`)
      ]);

      if (groupRes.ok) {
        const groupData = await groupRes.json();
        setGroup({
          ...groupData,
          conversationHistory: groupData.conversationHistory 
            ? JSON.parse(groupData.conversationHistory)
            : []
        });
      }

      if (contentsRes.ok) {
        const contentsData = await contentsRes.json();
        setSavedContents(contentsData.savedContents);
      }
    } catch (error) {
      console.error("Błąd pobierania danych:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!message.trim()) return;

    setIsSending(true);
    const userMessage = message;
    setMessage("");

    try {
      const res = await fetch(`/api/content-planner/groups/${groupId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage })
      });

      if (res.ok) {
        fetchData(); // Odśwież
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

  const handleSaveContent = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const res = await fetch(`/api/content-planner/groups/${groupId}/save-content`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(saveFormData)
      });

      if (res.ok) {
        alert("✅ Content zapisany!");
        setShowSaveForm(false);
        setSaveFormData({ name: "", subject: "", content: "", type: "initial", notes: "" });
        fetchData();
      } else {
        const data = await res.json();
        alert(`❌ Błąd: ${data.error}`);
      }
    } catch (error) {
      alert(`❌ Błąd: ${error}`);
    }
  };

  const handleUseInCampaign = (content: SavedContent) => {
    router.push(`/campaigns/new?savedContentId=${content.id}`);
  };

  const handleEditContent = (content: SavedContent) => {
    setEditingContent(content.id);
    setEditFormData({
      name: content.name,
      subject: content.subject,
      content: content.content,
      notes: content.notes || ""
    });
  };

  const handleSaveEdit = async (contentId: number) => {
    try {
      const res = await fetch(`/api/content-planner/saved-contents/${contentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editFormData)
      });

      if (res.ok) {
        alert("✅ Content zaktualizowany!");
        setEditingContent(null);
        fetchData();
      } else {
        alert("❌ Błąd zapisu");
      }
    } catch (error) {
      alert(`❌ Błąd: ${error}`);
    }
  };

  const handleCancelEdit = () => {
    setEditingContent(null);
    setEditFormData({ name: "", subject: "", content: "", notes: "" });
  };

  const handleDeleteContent = async (contentId: number) => {
    if (!confirm("Czy na pewno usunąć ten content?")) return;

    try {
      const res = await fetch(`/api/content-planner/saved-contents/${contentId}`, {
        method: "DELETE"
      });

      if (res.ok) {
        alert("✅ Content usunięty!");
        fetchData();
      }
    } catch (error) {
      alert(`❌ Błąd: ${error}`);
    }
  };

  if (isLoading) {
    return <main className="container" style={{ paddingTop: "var(--spacing-xl)" }}>Ładowanie...</main>;
  }

  if (!group) {
    return <main className="container" style={{ paddingTop: "var(--spacing-xl)" }}>Grupa nie istnieje</main>;
  }

  return (
    <main className="container" style={{ paddingTop: "var(--spacing-xl)", paddingBottom: "var(--spacing-2xl)" }}>
      <div style={{ marginBottom: 20 }}>
        <Link href="/content-planner">← Wróć do grup</Link>
      </div>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: "0 0 8px 0" }}>{group.name}</h1>
        {group.description && (
          <p style={{ 
            color: "#666", 
            margin: 0,
            fontSize: 14,
            lineHeight: 1.5,
            overflow: "hidden",
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical"
          }}>
            {group.description}
          </p>
        )}
      </div>

      {/* Layout: Chat (left) + Saved Contents (right) */}
      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 24 }}>
        
        {/* CHAT PANEL */}
        <div>
          <div className="card" style={{ padding: 0, height: "600px", display: "flex", flexDirection: "column" }}>
            {/* Header */}
            <div style={{ padding: "16px 20px", borderBottom: "2px solid #e5e7eb", backgroundColor: "#f9fafb" }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 16 }}>AI Content Partner</div>
                <div style={{ fontSize: 11, color: "#666" }}>GPT-4o • Pamięta całą rozmowę o produkcie</div>
              </div>
            </div>

            {/* Messages */}
            <div style={{ 
              flex: 1, 
              overflowY: "auto", 
              padding: 20,
              backgroundColor: "#fafafa"
            }}>
              {group.conversationHistory.length === 0 ? (
                <div style={{ textAlign: "center", padding: 40, color: "#999" }}>
                  <p style={{ fontSize: 16, marginBottom: 8 }}>Zacznij rozmowę o tym produkcie</p>
                  <p style={{ fontSize: 13 }}>
                    Przykład: "Napisz mail o szybkim montażu"
                  </p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {group.conversationHistory.map((msg, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: "flex",
                        justifyContent: msg.role === "user" ? "flex-end" : "flex-start"
                      }}
                    >
                      <div
                        style={{
                          maxWidth: "80%",
                          padding: 14,
                          borderRadius: 8,
                          backgroundColor: msg.role === "user" ? "var(--color-primary)" : "white",
                          color: msg.role === "user" ? "white" : "#111",
                          boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word",
                          lineHeight: 1.5
                        }}
                      >
                        {msg.role === "assistant" && (
                          <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 6 }}>
                            AI
                          </div>
                        )}
                        {msg.content}
                        <div style={{ fontSize: 10, opacity: 0.5, marginTop: 6, textAlign: "right" }}>
                          {new Date(msg.timestamp).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>
              )}
            </div>

            {/* Input */}
            <form 
              onSubmit={handleSendMessage}
              style={{ padding: 16, borderTop: "2px solid #e5e7eb", backgroundColor: "white" }}
            >
              <div style={{ display: "flex", gap: 12 }}>
                <input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Napisz wiadomość..."
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
                  {isSending ? "⏳" : "📤"}
                </button>
              </div>
            </form>
          </div>

          {/* Przycisk zapisu */}
          <button
            onClick={() => setShowSaveForm(!showSaveForm)}
            className="btn btn-success"
            style={{ width: "100%", marginTop: 16 }}
          >
            {showSaveForm ? "Anuluj" : "Zapisz content"}
          </button>

          {/* Formularz zapisu */}
          {showSaveForm && (
            <div className="card" style={{ padding: 20, marginTop: 16, backgroundColor: "#f9fafb" }}>
              <h3 style={{ marginBottom: 16 }}>Zapisz content</h3>
              <form onSubmit={handleSaveContent}>
                <div style={{ display: "grid", gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 13, fontWeight: 600 }}>Nazwa:</label>
                    <input
                      type="text"
                      value={saveFormData.name}
                      onChange={(e) => setSaveFormData({...saveFormData, name: e.target.value})}
                      required
                      placeholder="np. Szybki montaż v1"
                      style={{ width: "100%", padding: 8, marginTop: 4 }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: 13, fontWeight: 600 }}>Typ:</label>
                    <select
                      value={saveFormData.type}
                      onChange={(e) => setSaveFormData({...saveFormData, type: e.target.value})}
                      style={{ width: "100%", padding: 8, marginTop: 4 }}
                    >
                      <option value="initial">Mail początkowy</option>
                      <option value="followup_1">Follow-up 1</option>
                      <option value="followup_2">Follow-up 2</option>
                      <option value="followup_3">Follow-up 3</option>
                      <option value="followup_4">Follow-up 4</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: 13, fontWeight: 600 }}>Temat maila:</label>
                    <input
                      type="text"
                      value={saveFormData.subject}
                      onChange={(e) => setSaveFormData({...saveFormData, subject: e.target.value})}
                      required
                      placeholder="Skopiuj z rozmowy powyżej..."
                      style={{ width: "100%", padding: 8, marginTop: 4 }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: 13, fontWeight: 600 }}>Treść maila:</label>
                    <textarea
                      value={saveFormData.content}
                      onChange={(e) => setSaveFormData({...saveFormData, content: e.target.value})}
                      required
                      placeholder="Skopiuj z rozmowy powyżej lub wklej własną..."
                      rows={8}
                      style={{ width: "100%", padding: 8, marginTop: 4, fontSize: 13, lineHeight: 1.5 }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: 13, fontWeight: 600 }}>Notatki (opcjonalnie):</label>
                    <input
                      type="text"
                      value={saveFormData.notes}
                      onChange={(e) => setSaveFormData({...saveFormData, notes: e.target.value})}
                      placeholder="np. Wersja dla PL, testowa"
                      style={{ width: "100%", padding: 8, marginTop: 4 }}
                    />
                  </div>

                  <button type="submit" className="btn btn-success">
                    Zapisz content
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* SAVED CONTENTS PANEL */}
        <div>
          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ margin: "0 0 16px 0" }}>Zapisane treści ({savedContents.length})</h3>

            {savedContents.length === 0 ? (
              <div style={{ textAlign: "center", padding: 20, color: "#999", fontSize: 13 }}>
                Brak zapisanych treści
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {savedContents.map(content => (
                  <div
                    key={content.id}
                    className="card"
                    style={{
                      padding: 12,
                      backgroundColor: content.isFavorite ? "#fef3c7" : "white",
                      borderLeft: `3px solid ${editingContent === content.id ? "#10b981" : content.isFavorite ? "#f59e0b" : "#3b82f6"}`
                    }}
                  >
                    {editingContent === content.id ? (
                      /* TRYB EDYCJI */
                      <div>
                        <div style={{ marginBottom: 12 }}>
                          <label style={{ fontSize: 11, fontWeight: 600, color: "#666" }}>Nazwa:</label>
                          <input
                            type="text"
                            value={editFormData.name}
                            onChange={(e) => setEditFormData({...editFormData, name: e.target.value})}
                            style={{ width: "100%", padding: 6, marginTop: 4, fontSize: 13, border: "2px solid #10b981", borderRadius: 4 }}
                          />
                        </div>
                        <div style={{ marginBottom: 12 }}>
                          <label style={{ fontSize: 11, fontWeight: 600, color: "#666" }}>Temat:</label>
                          <input
                            type="text"
                            value={editFormData.subject}
                            onChange={(e) => setEditFormData({...editFormData, subject: e.target.value})}
                            style={{ width: "100%", padding: 6, marginTop: 4, fontSize: 12, border: "2px solid #10b981", borderRadius: 4 }}
                          />
                        </div>
                        <div style={{ marginBottom: 12 }}>
                          <label style={{ fontSize: 11, fontWeight: 600, color: "#666" }}>Treść:</label>
                          <textarea
                            value={editFormData.content}
                            onChange={(e) => setEditFormData({...editFormData, content: e.target.value})}
                            rows={8}
                            style={{ width: "100%", padding: 6, marginTop: 4, fontSize: 12, border: "2px solid #10b981", borderRadius: 4, lineHeight: 1.5 }}
                          />
                        </div>
                        <div style={{ marginBottom: 12 }}>
                          <label style={{ fontSize: 11, fontWeight: 600, color: "#666" }}>Notatki:</label>
                          <input
                            type="text"
                            value={editFormData.notes}
                            onChange={(e) => setEditFormData({...editFormData, notes: e.target.value})}
                            style={{ width: "100%", padding: 6, marginTop: 4, fontSize: 11, border: "2px solid #10b981", borderRadius: 4 }}
                          />
                        </div>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button
                            onClick={() => handleSaveEdit(content.id)}
                            className="btn btn-sm btn-success"
                            style={{ flex: 1, fontSize: 11 }}
                          >
                            Zapisz
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            className="btn btn-sm btn-secondary"
                            style={{ fontSize: 11 }}
                          >
                            Anuluj
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* TRYB WYŚWIETLANIA */
                      <div onClick={() => setExpandedContent(expandedContent === content.id ? null : content.id)} style={{ cursor: "pointer" }}>
                        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
                          {content.isFavorite && "★ "}
                          {content.name}
                        </div>
                        
                        <div style={{ fontSize: 11, color: "#666", marginBottom: 8 }}>
                          {content.type} • {content.language.toUpperCase()}
                          {content.usageCount > 0 && ` • ${content.usageCount}x`}
                        </div>

                        {expandedContent === content.id && (
                          <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #e5e7eb" }} onClick={(e) => e.stopPropagation()}>
                            <div style={{ fontSize: 12, marginBottom: 8 }}>
                              <strong>Temat:</strong> {content.subject}
                            </div>
                            <div style={{ fontSize: 12, marginBottom: 12, whiteSpace: "pre-wrap", lineHeight: 1.4, color: "#333", maxHeight: 150, overflow: "auto", padding: 8, backgroundColor: "#f9fafb", borderRadius: 4 }}>
                              {content.content}
                            </div>
                            {content.notes && (
                              <div style={{ fontSize: 11, color: "#888", marginBottom: 12, fontStyle: "italic" }}>
                                {content.notes}
                              </div>
                            )}
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditContent(content);
                                }}
                                className="btn btn-sm"
                                style={{ fontSize: 11, backgroundColor: "#6b7280", color: "white" }}
                              >
                                Edytuj
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleUseInCampaign(content);
                                }}
                                className="btn btn-sm btn-primary"
                                style={{ fontSize: 11 }}
                              >
                                Użyj
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteContent(content.id);
                                }}
                                className="btn btn-sm btn-danger"
                                style={{ fontSize: 11 }}
                              >
                                Usuń
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Info */}
          <div style={{ marginTop: 16, padding: 12, backgroundColor: "#e0f2fe", borderRadius: 6, fontSize: 11, lineHeight: 1.4 }}>
            <strong>Jak to działa:</strong><br />
            1. Rozmawiaj z AI o produkcie<br />
            2. Gdy podoba Ci się treść → kopiuj<br />
            3. Kliknij "Zapisz content"<br />
            4. Wklej, nazwij, zapisz<br />
            5. Użyj później w kampaniach!
          </div>
        </div>
      </div>
    </main>
  );
}

