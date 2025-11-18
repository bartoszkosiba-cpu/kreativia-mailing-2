"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

interface Criteria {
  id: number;
  name: string;
  description: string | null;
  criteriaText: string;
  qualifiedKeywords: string | null;
  rejectedKeywords: string | null;
  qualifiedThreshold: number;
  rejectedThreshold: number;
  chatHistory: string | null;
  lastUserMessage: string | null;
  lastAIResponse: string | null;
  isActive: boolean;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
  selection?: {
    id: number;
    name: string;
  } | null;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export default function CriteriaDetailPage() {
  const params = useParams();
  const router = useRouter();
  const criteriaId = params?.id ? Number(params.id) : null;

  const [criteria, setCriteria] = useState<Criteria | null>(null);
  const [loading, setLoading] = useState(true);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [messageInput, setMessageInput] = useState("");
  const [sending, setSending] = useState(false);
  const [activeTab, setActiveTab] = useState<"chat" | "edit" | "view">("view");
  const [editingCriteria, setEditingCriteria] = useState({
    name: "",
    description: "",
    criteriaText: "",
    qualifiedThreshold: 0.8,
    rejectedThreshold: 0.3,
  });
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [shouldGenerateCriteria, setShouldGenerateCriteria] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (criteriaId) {
      loadCriteria();
    }
  }, [criteriaId]);

  useEffect(() => {
    if (criteria?.chatHistory) {
      try {
        const history = JSON.parse(criteria.chatHistory);
        setChatMessages(history);
      } catch (e) {
        setChatMessages([]);
      }
    }
  }, [criteria]);

  // Auto-scroll do dołu gdy pojawiają się nowe wiadomości
  useEffect(() => {
    if (chatContainerRef.current) {
      setTimeout(() => {
        if (chatContainerRef.current) {
          chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
      }, 100);
    }
  }, [chatMessages, sending]);

  const loadCriteria = async () => {
    if (!criteriaId) return;
    try {
      setLoading(true);
      const response = await fetch(`/api/company-selection/criteria?id=${criteriaId}`);
      const data = await response.json();
      if (data.success && data.criteria) {
        setCriteria(data.criteria);
        setEditingCriteria({
          name: data.criteria.name,
          description: data.criteria.description || "",
          criteriaText: data.criteria.criteriaText,
          qualifiedThreshold: data.criteria.qualifiedThreshold,
          rejectedThreshold: data.criteria.rejectedThreshold,
        });
      } else {
        alert("Nie znaleziono kryteriów");
        router.push("/company-selection/criteria");
      }
    } catch (error) {
      console.error("Błąd ładowania kryteriów:", error);
      alert("Błąd ładowania kryteriów");
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!messageInput.trim() || sending || !criteriaId) return;

    const userMessage = messageInput.trim();
    setMessageInput("");
    setSending(true);

    const newUserMessage: ChatMessage = { role: "user", content: userMessage };
    setChatMessages((prev) => [...prev, newUserMessage]);

    setTimeout(() => {
      if (chatContainerRef.current) {
        chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
      }
    }, 50);

    try {
      const response = await fetch("/api/company-selection/criteria/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          criteriaId: criteriaId,
        }),
      });

      const data = await response.json();
      if (data.success) {
        const aiMessage: ChatMessage = { role: "assistant", content: data.response };
        setChatMessages((prev) => [...prev, aiMessage]);

        if (data.shouldGenerateCriteria) {
          setShouldGenerateCriteria(true);
        }

        if (data.criteriaId) {
          await loadCriteria();
        }

        setTimeout(() => {
          if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
          }
        }, 200);
      } else {
        alert("Błąd: " + (data.error || "Nie udało się wysłać wiadomości"));
        setChatMessages((prev) => prev.slice(0, -1));
      }
    } catch (error) {
      console.error("Błąd wysyłania wiadomości:", error);
      alert("Błąd połączenia z serwerem");
      setChatMessages((prev) => prev.slice(0, -1));
    } finally {
      setSending(false);
    }
  };

  const generateFinalCriteria = async () => {
    if (!criteriaId) {
      alert("Brak ID kryteriów");
      return;
    }

    if (!confirm("Wygenerować finalne kryteria na podstawie rozmowy? To nadpisze obecne kryteria.")) {
      return;
    }

    setGenerating(true);
    try {
      const response = await fetch("/api/company-selection/criteria/chat", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ criteriaId }),
      });

      const data = await response.json();
      if (data.success) {
        await loadCriteria();
        setActiveTab("view");
        setShouldGenerateCriteria(false);
        alert("Kryteria zostały wygenerowane pomyślnie!");
      } else {
        console.error("Błąd generowania kryteriów:", data);
        alert("Błąd: " + (data.error || "Nie udało się wygenerować kryteriów"));
      }
    } catch (error) {
      console.error("Błąd generowania kryteriów:", error);
      alert("Błąd połączenia z serwerem: " + (error instanceof Error ? error.message : String(error)));
    } finally {
      setGenerating(false);
    }
  };

  const saveCriteria = async () => {
    if (!editingCriteria.name.trim() || !editingCriteria.criteriaText.trim() || !criteriaId) {
      alert("Nazwa i tekst kryteriów są wymagane");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/company-selection/criteria", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: criteriaId,
          ...editingCriteria,
        }),
      });

      const data = await response.json();
      if (data.success) {
        await loadCriteria();
        setActiveTab("view");
        alert("Kryteria zostały zapisane pomyślnie!");
      } else {
        alert("Błąd: " + (data.error || "Nie udało się zapisać kryteriów"));
      }
    } catch (error) {
      console.error("Błąd zapisywania kryteriów:", error);
      alert("Błąd połączenia z serwerem");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!criteriaId || !criteria) return;

    // Sprawdź czy kryterium jest używane w selekcji
    if (criteria.selectionId != null && criteria.selection != null) {
      alert(
        `Nie można usunąć kryteriów, ponieważ są używane w selekcji "${criteria.selection.name}".\n\n` +
          "Najpierw usuń selekcję lub odepnij kryteria od selekcji (ustaw selectionId na null)."
      );
      return;
    }

    if (
      !confirm(
        `Czy na pewno chcesz usunąć kryteria "${criteria.name}"?\n\n` +
          "Ta operacja jest nieodwracalna."
      )
    ) {
      return;
    }

    setDeleting(true);
    try {
      const response = await fetch(`/api/company-selection/criteria/${criteriaId}`, {
        method: "DELETE",
      });

      const data = await response.json();
      if (data.success) {
        alert("Kryteria zostały usunięte pomyślnie!");
        router.push("/company-selection/criteria");
      } else {
        alert("Błąd: " + (data.error || "Nie udało się usunąć kryteriów"));
      }
    } catch (error) {
      console.error("Błąd usuwania kryteriów:", error);
      alert("Błąd połączenia z serwerem");
    } finally {
      setDeleting(false);
    }
  };

  const handleDuplicate = async () => {
    if (!criteriaId || !criteria) return;

    setDuplicating(true);
    try {
      const response = await fetch("/api/company-selection/criteria", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${criteria.name} - kopia`,
          description: criteria.description || "",
          criteriaText: criteria.criteriaText,
          qualifiedThreshold: criteria.qualifiedThreshold,
          rejectedThreshold: criteria.rejectedThreshold,
          qualifiedKeywords: criteria.qualifiedKeywords,
          rejectedKeywords: criteria.rejectedKeywords,
          chatHistory: criteria.chatHistory,
          isActive: true,
          isDefault: false,
          selectionId: null, // Kopia nie jest przypisana do selekcji
        }),
      });

      const data = await response.json();
      if (data.success && data.criteria) {
        router.push(`/company-selection/criteria/${data.criteria.id}`);
      } else {
        alert("Błąd: " + (data.error || "Nie udało się powielić kryteriów"));
      }
    } catch (error) {
      console.error("Błąd powielania kryteriów:", error);
      alert("Błąd połączenia z serwerem");
    } finally {
      setDuplicating(false);
    }
  };

  if (!criteriaId) {
    return (
      <div style={{ padding: "2rem", maxWidth: "1200px", margin: "0 auto" }}>
        <p>Niepoprawne ID kryteriów</p>
        <Link href="/company-selection/criteria">← Powrót do listy kryteriów</Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ padding: "2rem", maxWidth: "1200px", margin: "0 auto" }}>
        <div>Ładowanie...</div>
      </div>
    );
  }

  if (!criteria) {
    return (
      <div style={{ padding: "2rem", maxWidth: "1200px", margin: "0 auto" }}>
        <p>Nie znaleziono kryteriów</p>
        <Link href="/company-selection/criteria">← Powrót do listy kryteriów</Link>
      </div>
    );
  }

  return (
    <div style={{ padding: "2rem", maxWidth: "1200px", margin: "0 auto" }}>
      <div style={{ marginBottom: "2rem" }}>
        <Link
          href="/company-selection/criteria"
          style={{
            color: "#3B82F6",
            textDecoration: "none",
            marginBottom: "1rem",
            display: "inline-block",
          }}
        >
          ← Powrót do listy kryteriów
        </Link>
        <h1 style={{ fontSize: "2rem", marginTop: "1rem" }}>
          {criteria.name}
        </h1>
        {criteria.selection && (
          <p style={{ color: "#6B7280", marginTop: "0.5rem" }}>
            Powiązane z selekcją: {criteria.selection.name}
          </p>
        )}
      </div>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          gap: "0.5rem",
          marginBottom: "2rem",
          borderBottom: "2px solid #E5E7EB",
        }}
      >
        <button
          onClick={() => setActiveTab("view")}
          style={{
            padding: "0.75rem 1.5rem",
            border: "none",
            backgroundColor: "transparent",
            borderBottom: activeTab === "view" ? "2px solid #3B82F6" : "2px solid transparent",
            color: activeTab === "view" ? "#3B82F6" : "#6B7280",
            cursor: "pointer",
            fontWeight: activeTab === "view" ? "600" : "400",
          }}
        >
          Podgląd
        </button>
        <button
          onClick={() => setActiveTab("chat")}
          style={{
            padding: "0.75rem 1.5rem",
            border: "none",
            backgroundColor: "transparent",
            borderBottom: activeTab === "chat" ? "2px solid #3B82F6" : "2px solid transparent",
            color: activeTab === "chat" ? "#3B82F6" : "#6B7280",
            cursor: "pointer",
            fontWeight: activeTab === "chat" ? "600" : "400",
          }}
        >
          Czat z agentem
        </button>
        <button
          onClick={() => setActiveTab("edit")}
          style={{
            padding: "0.75rem 1.5rem",
            border: "none",
            backgroundColor: "transparent",
            borderBottom: activeTab === "edit" ? "2px solid #3B82F6" : "2px solid transparent",
            color: activeTab === "edit" ? "#3B82F6" : "#6B7280",
            cursor: "pointer",
            fontWeight: activeTab === "edit" ? "600" : "400",
          }}
        >
          Edycja ręczna
        </button>
      </div>

      {/* View Tab */}
      {activeTab === "view" && (
        <div
          style={{
            padding: "2rem",
            backgroundColor: "white",
            borderRadius: "0.5rem",
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          }}
        >
          <div style={{ marginBottom: "1.5rem" }}>
            <h2 style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>
              {criteria.name}
            </h2>
            {criteria.description && (
              <p style={{ color: "#6B7280", marginBottom: "1rem" }}>
                {criteria.description}
              </p>
            )}
          </div>

          <div style={{ marginBottom: "2rem" }}>
            <h3 style={{ fontSize: "1.25rem", marginBottom: "1rem" }}>
              Progi pewności
            </h3>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, 1fr)",
                gap: "1rem",
              }}
            >
              <div
                style={{
                  padding: "1rem",
                  backgroundColor: "#F3F4F6",
                  borderRadius: "0.5rem",
                }}
              >
                <div style={{ fontSize: "0.875rem", color: "#6B7280", marginBottom: "0.5rem" }}>
                  Próg kwalifikacji
                </div>
                <div style={{ fontSize: "1.5rem", fontWeight: "bold", color: "#10B981" }}>
                  ≥ {criteria.qualifiedThreshold}
                </div>
              </div>
              <div
                style={{
                  padding: "1rem",
                  backgroundColor: "#F3F4F6",
                  borderRadius: "0.5rem",
                }}
              >
                <div style={{ fontSize: "0.875rem", color: "#6B7280", marginBottom: "0.5rem" }}>
                  Próg odrzucenia
                </div>
                <div style={{ fontSize: "1.5rem", fontWeight: "bold", color: "#EF4444" }}>
                  ≤ {criteria.rejectedThreshold}
                </div>
              </div>
            </div>
          </div>

          <div style={{ marginBottom: "2rem" }}>
            <h3 style={{ fontSize: "1.25rem", marginBottom: "1rem" }}>
              Tekst kryteriów
            </h3>
            <div
              style={{
                padding: "1.5rem",
                backgroundColor: "#F9FAFB",
                borderRadius: "0.5rem",
                whiteSpace: "pre-wrap",
                lineHeight: "1.6",
              }}
            >
              {criteria.criteriaText}
            </div>
          </div>

          {criteria.qualifiedKeywords && (
            <div style={{ marginBottom: "2rem" }}>
              <h3 style={{ fontSize: "1.25rem", marginBottom: "1rem" }}>
                Słowa kluczowe - kwalifikacja
              </h3>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                {JSON.parse(criteria.qualifiedKeywords).map((keyword: string, idx: number) => (
                  <span
                    key={idx}
                    style={{
                      padding: "0.25rem 0.75rem",
                      borderRadius: "0.25rem",
                      backgroundColor: "#10B981",
                      color: "white",
                      fontSize: "0.875rem",
                    }}
                  >
                    {keyword}
                  </span>
                ))}
              </div>
            </div>
          )}

          {criteria.rejectedKeywords && (
            <div style={{ marginBottom: "2rem" }}>
              <h3 style={{ fontSize: "1.25rem", marginBottom: "1rem" }}>
                Słowa kluczowe - odrzucenie
              </h3>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                {JSON.parse(criteria.rejectedKeywords).map((keyword: string, idx: number) => (
                  <span
                    key={idx}
                    style={{
                      padding: "0.25rem 0.75rem",
                      borderRadius: "0.25rem",
                      backgroundColor: "#EF4444",
                      color: "white",
                      fontSize: "0.875rem",
                    }}
                  >
                    {keyword}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div style={{ fontSize: "0.875rem", color: "#6B7280", marginTop: "2rem", marginBottom: "2rem" }}>
            Utworzono: {new Date(criteria.createdAt).toLocaleString("pl-PL")}
            {criteria.updatedAt !== criteria.createdAt && (
              <> | Zaktualizowano: {new Date(criteria.updatedAt).toLocaleString("pl-PL")}</>
            )}
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "1rem", paddingTop: "1.5rem", borderTop: "1px solid #E5E7EB", alignItems: "center" }}>
            {criteria.selectionId != null && criteria.selection != null && (
              <div
                style={{
                  padding: "1rem",
                  backgroundColor: "#FEF3C7",
                  border: "1px solid #F59E0B",
                  borderRadius: "0.5rem",
                  color: "#92400E",
                  fontSize: "0.875rem",
                  flex: 1,
                }}
              >
                <strong>Uwaga:</strong> Te kryteria są używane w selekcji "{criteria.selection.name}".
                Aby je usunąć, najpierw usuń selekcję lub odepnij kryteria od selekcji.
              </div>
            )}
            <button
              onClick={handleDuplicate}
              disabled={duplicating}
              style={{
                padding: "0.75rem 2rem",
                backgroundColor: duplicating ? "#9CA3AF" : "#3B82F6",
                color: "white",
                border: "none",
                borderRadius: "0.5rem",
                cursor: duplicating ? "not-allowed" : "pointer",
                fontSize: "1rem",
                fontWeight: "500",
              }}
              title="Utwórz kopię tych kryteriów"
            >
              {duplicating ? "Powielanie..." : "Powiel"}
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting || (criteria.selectionId != null && criteria.selection != null)}
              style={{
                padding: "0.75rem 2rem",
                backgroundColor:
                  deleting || (criteria.selectionId != null && criteria.selection != null)
                    ? "#9CA3AF"
                    : "#EF4444",
                color: "white",
                border: "none",
                borderRadius: "0.5rem",
                cursor:
                  deleting || (criteria.selectionId != null && criteria.selection != null)
                    ? "not-allowed"
                    : "pointer",
                fontSize: "1rem",
                fontWeight: "500",
              }}
              title={
                criteria.selectionId != null && criteria.selection != null
                  ? `Nie można usunąć - kryteria są używane w selekcji "${criteria.selection.name}"`
                  : "Usuń kryteria"
              }
            >
              {deleting ? "Usuwanie..." : "Usuń kryteria"}
            </button>
          </div>
        </div>
      )}

      {/* Chat Tab */}
      {activeTab === "chat" && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            height: "600px",
            backgroundColor: "white",
            borderRadius: "0.5rem",
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          }}
        >
          <div
            style={{
              padding: "1rem",
              borderBottom: "1px solid #E5E7EB",
              backgroundColor: "#F9FAFB",
              borderRadius: "0.5rem 0.5rem 0 0",
            }}
          >
            <h3 style={{ fontSize: "1.25rem", marginBottom: "0.5rem" }}>
              Czat z agentem AI
            </h3>
            <p style={{ fontSize: "0.875rem", color: "#6B7280" }}>
              Opisz, jakich firm szukasz. Agent pomoże stworzyć kryteria weryfikacji.
            </p>
          </div>

          <div
            ref={chatContainerRef}
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "1.5rem",
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
            }}
          >
            {chatMessages.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  color: "#6B7280",
                  padding: "2rem",
                }}
              >
                <p style={{ marginBottom: "1rem" }}>
                  Rozpocznij rozmowę, opisując jakich firm szukasz.
                </p>
                <p style={{ fontSize: "0.875rem" }}>
                  Przykład: "Szukam firm, które budują stoiska targowe i struktury wystawiennicze"
                </p>
              </div>
            ) : (
              chatMessages.map((msg, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
                  }}
                >
                  <div
                    style={{
                      maxWidth: "70%",
                      padding: "1rem",
                      borderRadius: "0.5rem",
                      backgroundColor: msg.role === "user" ? "#3B82F6" : "#F3F4F6",
                      color: msg.role === "user" ? "white" : "#1F2937",
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {msg.content}
                  </div>
                </div>
              ))
            )}
            {sending && (
              <div style={{ display: "flex", justifyContent: "flex-start" }}>
                <div
                  style={{
                    padding: "1rem",
                    borderRadius: "0.5rem",
                    backgroundColor: "#F3F4F6",
                    color: "#6B7280",
                  }}
                >
                  Agent pisze...
                </div>
              </div>
            )}
            {shouldGenerateCriteria && chatMessages.length > 0 && (
              <div
                style={{
                  padding: "1rem",
                  backgroundColor: "#FEF3C7",
                  border: "1px solid #F59E0B",
                  borderRadius: "0.5rem",
                  marginTop: "1rem",
                }}
              >
                <div style={{ fontWeight: "600", marginBottom: "0.5rem", color: "#92400E" }}>
                  Gotowe do wygenerowania kryteriów
                </div>
                <div style={{ fontSize: "0.875rem", color: "#78350F", marginBottom: "0.75rem" }}>
                  Agent ma wystarczające informacje. Kliknij poniżej, aby wygenerować finalne kryteria weryfikacji.
                </div>
                <button
                  onClick={generateFinalCriteria}
                  disabled={generating || !criteriaId}
                  style={{
                    padding: "0.5rem 1rem",
                    backgroundColor: generating || !criteriaId ? "#9CA3AF" : "#F59E0B",
                    color: "white",
                    border: "none",
                    borderRadius: "0.25rem",
                    cursor: generating || !criteriaId ? "not-allowed" : "pointer",
                    fontSize: "0.875rem",
                    fontWeight: "500",
                  }}
                >
                  {generating ? "Generowanie..." : "Wygeneruj kryteria teraz"}
                </button>
              </div>
            )}
          </div>

          <div
            style={{
              padding: "1rem",
              borderTop: "1px solid #E5E7EB",
              display: "flex",
              gap: "0.5rem",
            }}
          >
            <input
              type="text"
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
              placeholder="Napisz wiadomość..."
              disabled={sending}
              style={{
                flex: 1,
                padding: "0.75rem",
                border: "1px solid #D1D5DB",
                borderRadius: "0.5rem",
                fontSize: "1rem",
              }}
            />
            <button
              onClick={sendMessage}
              disabled={sending || !messageInput.trim()}
              style={{
                padding: "0.75rem 1.5rem",
                backgroundColor: sending || !messageInput.trim() ? "#9CA3AF" : "#3B82F6",
                color: "white",
                border: "none",
                borderRadius: "0.5rem",
                cursor: sending || !messageInput.trim() ? "not-allowed" : "pointer",
              }}
            >
              Wyślij
            </button>
            {chatMessages.length > 0 && (
              <button
                onClick={generateFinalCriteria}
                disabled={generating || !criteriaId}
                style={{
                  padding: "0.75rem 1.5rem",
                  backgroundColor: generating || !criteriaId ? "#9CA3AF" : "#10B981",
                  color: "white",
                  border: "none",
                  borderRadius: "0.5rem",
                  cursor: generating || !criteriaId ? "not-allowed" : "pointer",
                }}
              >
                {generating ? "Generowanie..." : "Wygeneruj kryteria"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Edit Tab */}
      {activeTab === "edit" && (
        <div
          style={{
            padding: "2rem",
            backgroundColor: "white",
            borderRadius: "0.5rem",
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          }}
        >
          <h2 style={{ fontSize: "1.5rem", marginBottom: "2rem" }}>
            Edycja ręczna kryteriów
          </h2>

          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "0.5rem",
                  fontWeight: "500",
                }}
              >
                Nazwa konfiguracji *
              </label>
              <input
                type="text"
                value={editingCriteria.name}
                onChange={(e) =>
                  setEditingCriteria({ ...editingCriteria, name: e.target.value })
                }
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  border: "1px solid #D1D5DB",
                  borderRadius: "0.5rem",
                  fontSize: "1rem",
                }}
              />
            </div>

            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "0.5rem",
                  fontWeight: "500",
                }}
              >
                Opis
              </label>
              <input
                type="text"
                value={editingCriteria.description}
                onChange={(e) =>
                  setEditingCriteria({ ...editingCriteria, description: e.target.value })
                }
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  border: "1px solid #D1D5DB",
                  borderRadius: "0.5rem",
                  fontSize: "1rem",
                }}
              />
            </div>

            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "0.5rem",
                  fontWeight: "500",
                }}
              >
                Tekst kryteriów *
              </label>
              <textarea
                value={editingCriteria.criteriaText}
                onChange={(e) =>
                  setEditingCriteria({ ...editingCriteria, criteriaText: e.target.value })
                }
                rows={10}
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  border: "1px solid #D1D5DB",
                  borderRadius: "0.5rem",
                  fontSize: "1rem",
                  fontFamily: "monospace",
                }}
              />
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, 1fr)",
                gap: "1rem",
              }}
            >
              <div>
                <label
                  style={{
                    display: "block",
                    marginBottom: "0.5rem",
                    fontWeight: "500",
                  }}
                >
                  Próg kwalifikacji (0.0 - 1.0)
                </label>
                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.1"
                  value={editingCriteria.qualifiedThreshold}
                  onChange={(e) =>
                    setEditingCriteria({
                      ...editingCriteria,
                      qualifiedThreshold: parseFloat(e.target.value),
                    })
                  }
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    border: "1px solid #D1D5DB",
                    borderRadius: "0.5rem",
                    fontSize: "1rem",
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    marginBottom: "0.5rem",
                    fontWeight: "500",
                  }}
                >
                  Próg odrzucenia (0.0 - 1.0)
                </label>
                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.1"
                  value={editingCriteria.rejectedThreshold}
                  onChange={(e) =>
                    setEditingCriteria({
                      ...editingCriteria,
                      rejectedThreshold: parseFloat(e.target.value),
                    })
                  }
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    border: "1px solid #D1D5DB",
                    borderRadius: "0.5rem",
                    fontSize: "1rem",
                  }}
                />
              </div>
            </div>

            <div style={{ display: "flex", gap: "1rem", justifyContent: "space-between", alignItems: "center" }}>
              <button
                onClick={saveCriteria}
                disabled={saving}
                style={{
                  padding: "0.75rem 2rem",
                  backgroundColor: saving ? "#9CA3AF" : "#3B82F6",
                  color: "white",
                  border: "none",
                  borderRadius: "0.5rem",
                  cursor: saving ? "not-allowed" : "pointer",
                  fontSize: "1rem",
                  fontWeight: "500",
                }}
              >
                {saving ? "Zapisywanie..." : "Zapisz kryteria"}
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting || (criteria.selectionId != null && criteria.selection != null)}
                style={{
                  padding: "0.75rem 2rem",
                  backgroundColor:
                    deleting || (criteria.selectionId != null && criteria.selection != null)
                      ? "#9CA3AF"
                      : "#EF4444",
                  color: "white",
                  border: "none",
                  borderRadius: "0.5rem",
                  cursor:
                    deleting || (criteria.selectionId != null && criteria.selection != null)
                      ? "not-allowed"
                      : "pointer",
                  fontSize: "1rem",
                  fontWeight: "500",
                }}
                title={
                  criteria.selectionId != null && criteria.selection != null
                    ? `Nie można usunąć - kryteria są używane w selekcji "${criteria.selection.name}"`
                    : "Usuń kryteria"
                }
              >
                {deleting ? "Usuwanie..." : "Usuń kryteria"}
              </button>
            </div>
            {criteria.selectionId != null && criteria.selection != null && (
              <div
                style={{
                  padding: "1rem",
                  backgroundColor: "#FEF3C7",
                  border: "1px solid #F59E0B",
                  borderRadius: "0.5rem",
                  color: "#92400E",
                  fontSize: "0.875rem",
                }}
              >
                <strong>Uwaga:</strong> Te kryteria są używane w selekcji "{criteria.selection.name}".
                Aby je usunąć, najpierw usuń selekcję lub odepnij kryteria od selekcji.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

