"use client";

import { useState, useEffect, useRef, useMemo } from "react";
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

interface CompanyVerificationBrief {
  id: number;
  criteriaId: number;
  summary: string;
  decisionGuidelines: string[];
  targetCompanies: string[];
  avoidCompanies: string[];
  additionalNotes?: string | null;
  aiRole?: string | null;
  qualifiedThreshold: number;
  generatedPrompt?: string | null;
  createdAt: string;
  updatedAt: string;
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
  const [activeTab, setActiveTab] = useState<"chat" | "view" | "prompt">("view");
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
  const messageInputRef = useRef<HTMLTextAreaElement | null>(null);
  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const [tempName, setTempName] = useState("");
  const [nameWasSaved, setNameWasSaved] = useState(false);
  const [verificationModel, setVerificationModel] = useState<"gpt-4o-mini" | "gpt-4o">("gpt-4o-mini");
  const [promptText, setPromptText] = useState<string | null>(null);
  const [loadingPrompt, setLoadingPrompt] = useState(false);
  const conversationStartedRef = useRef(false);
  const [brief, setBrief] = useState<CompanyVerificationBrief | null>(null);
  const [loadingBrief, setLoadingBrief] = useState(false);

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

  const loadPrompt = async () => {
    if (!criteriaId) return;
    setLoadingPrompt(true);
    try {
      const response = await fetch(`/api/company-selection/criteria/${criteriaId}/prompt?model=${verificationModel}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          setPromptText(data.data.promptText);
        }
      }
    } catch (err) {
      console.error("[Criteria Prompt] Błąd pobierania promptu", err);
    } finally {
      setLoadingPrompt(false);
    }
  };

  // Załaduj prompt gdy przełączamy na zakładkę prompt
  useEffect(() => {
    if (activeTab === "prompt" && criteriaId && !promptText) {
      loadPrompt();
    }
  }, [activeTab, criteriaId]);

  // Aktualizuj prompt gdy zmienia się model
  useEffect(() => {
    if (activeTab === "prompt" && criteriaId) {
      loadPrompt();
    }
  }, [verificationModel]);

  // Załaduj model z localStorage gdy criteriaId się zmienia
  useEffect(() => {
    if (criteriaId && typeof window !== "undefined") {
      const saved = localStorage.getItem(`criteria-verification-model-${criteriaId}`);
      if (saved === "gpt-4o" || saved === "gpt-4o-mini") {
        setVerificationModel(saved);
      }
    }
  }, [criteriaId]);

  // Sprawdź, czy nazwa jest wymagana
  const shouldShowNamePrompt = useMemo(() => {
    if (!criteria) return false;
    // Jeśli nazwa została już zapisana przez użytkownika, nie pokazuj ekranu z nazwą
    if (nameWasSaved) return false;
    if (showNamePrompt) return true;
    if (!criteria.name || criteria.name.trim() === "") return true;
    const name = criteria.name.trim();
    const exactDefaultNames = ["Kryteria weryfikacji firm", "Nowe kryteria weryfikacji", "Nowe kryteria weryfikacji firm", "Nowe kryteria weryfikacji dodaj firm"];
    if (exactDefaultNames.includes(name)) return true;
    const match = name.match(/^(Kryteria weryfikacji firm|Nowe kryteria weryfikacji) (\d+)$/);
    return match !== null;
  }, [showNamePrompt, criteria, nameWasSaved]);

  // Automatycznie rozpocznij rozmowę gdy przełączamy na zakładkę chat i historia jest pusta
  useEffect(() => {
    if (activeTab === "chat" && criteriaId && !shouldShowNamePrompt && criteria && chatMessages.length === 0 && !sending && !conversationStartedRef.current) {
      const startConversation = async () => {
        try {
          conversationStartedRef.current = true;
          setSending(true);
          const response = await fetch(`/api/company-selection/criteria/chat?criteriaId=${criteriaId}`, {
            method: "GET",
          });
          const data = await response.json();
          if (data.success && data.response) {
            const aiMessage: ChatMessage = { role: "assistant", content: data.response };
            setChatMessages([aiMessage]);
            if (data.criteria) {
              setCriteria(data.criteria);
            }
          }
        } catch (err) {
          console.error("[Criteria Chat] Błąd rozpoczynania rozmowy", err);
        } finally {
          setSending(false);
        }
      };
      startConversation();
    }
  }, [activeTab, criteriaId, shouldShowNamePrompt, criteria, chatMessages.length, sending]);

  const loadBrief = async () => {
    if (!criteriaId) return;
    setLoadingBrief(true);
    try {
      const response = await fetch(`/api/company-selection/criteria/${criteriaId}/brief`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          setBrief(data.data);
        } else {
          setBrief(null);
        }
      } else {
        setBrief(null);
      }
    } catch (error) {
      console.error("[Criteria Brief] Błąd ładowania briefu", error);
      setBrief(null);
    } finally {
      setLoadingBrief(false);
    }
  };

  const loadCriteria = async (preserveNameSaved = false) => {
    if (!criteriaId) return;
    try {
      setLoading(true);
      // Resetuj flagę tylko jeśli nie zachowujemy jej (np. przy pierwszym ładowaniu)
      if (!preserveNameSaved) {
        setNameWasSaved(false);
      }
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
        
        // Załaduj brief
        await loadBrief();
        
        // Sprawdź czy nazwa jest domyślna - jeśli tak, pokaż ekran z nazwą
        // Ale tylko jeśli nie zachowujemy flagi nameWasSaved
        if (!preserveNameSaved) {
          const name = data.criteria.name?.trim() || "";
          if (!name) {
            setShowNamePrompt(true);
            setTempName("");
            // NIE przełączaj na chat - pokaż ekran z nazwą na aktualnej zakładce
        } else {
          // Dokładne dopasowanie do domyślnych nazw
          const exactDefaultNames = ["Kryteria weryfikacji firm", "Nowe kryteria weryfikacji", "Nowe kryteria weryfikacji firm", "Nowe kryteria weryfikacji dodaj firm"];
          const isExactDefault = exactDefaultNames.includes(name);
          // Sprawdź czy to domyślna nazwa z numerem (np. "Kryteria weryfikacji firm 1" lub "Nowe kryteria weryfikacji 1")
          const match = name.match(/^(Kryteria weryfikacji firm|Nowe kryteria weryfikacji) (\d+)$/);
          if (isExactDefault || match !== null) {
            setShowNamePrompt(true);
            // Ustaw domyślną nazwę w oknie jako "Kryteria weryfikacji firm" (nie pokazuj starej domyślnej nazwy)
            setTempName("Kryteria weryfikacji firm");
            // NIE przełączaj na chat - pokaż ekran z nazwą na aktualnej zakładce
          }
        }
        }
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
    // Reset wysokości textarea
    if (messageInputRef.current) {
      messageInputRef.current.style.height = "auto";
    }
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
          // Zachowaj flagę nameWasSaved, aby nie wracać do ekranu z nazwą
          await loadCriteria(true);
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
        await loadBrief(); // Przeładuj brief po wygenerowaniu kryteriów
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

  const handleSaveName = async () => {
    const nameToSave = (tempName || criteria?.name || "").trim();
    
    if (!criteriaId || !nameToSave) {
      alert("Nazwa jest wymagana");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/company-selection/criteria", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: criteriaId,
          name: nameToSave,
          description: criteria?.description || "",
          criteriaText: criteria?.criteriaText || "",
          qualifiedThreshold: criteria?.qualifiedThreshold || 0.8,
          rejectedThreshold: criteria?.rejectedThreshold || 0.3,
        }),
      });

      const data = await response.json();
      
      if (!data.success) {
        alert(data.error || "Nie udało się zapisać nazwy");
        setSaving(false);
        return;
      }

      // Najpierw ustaw flagę, że nazwa została zapisana - to zapobiegnie ponownemu pokazaniu ekranu z nazwą
      setNameWasSaved(true);
      setShowNamePrompt(false);
      
      if (data.criteria) {
        setCriteria(data.criteria);
        setEditingCriteria({
          name: data.criteria.name,
          description: data.criteria.description || "",
          criteriaText: data.criteria.criteriaText,
          qualifiedThreshold: data.criteria.qualifiedThreshold,
          rejectedThreshold: data.criteria.rejectedThreshold,
        });
      }
      
      setTempName("");
      
      // Po zapisaniu nazwy, przełącz na zakładkę chat
      // Użyj setTimeout, aby upewnić się, że state się zaktualizował
      setTimeout(() => {
        setActiveTab("chat");
      }, 200);
    } catch (err) {
      console.error("[Criteria Save Name] Błąd", err);
      alert("Błąd zapisu nazwy: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSaving(false);
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

      {/* Ekran z nazwą - jeśli jest wymagana */}
      {shouldShowNamePrompt && criteria && (
        <div
          style={{
            padding: "2rem",
            backgroundColor: "white",
            borderRadius: "0.75rem",
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
            border: "2px solid #3B82F6",
            marginBottom: "2rem",
          }}
        >
          <h3 style={{ fontSize: "1.5rem", marginBottom: "0.75rem", color: "#1F2937" }}>
            Nadaj nazwę kryteriom weryfikacji
          </h3>
          <p style={{ color: "#6B7280", marginBottom: "1.5rem", lineHeight: 1.6 }}>
            Zanim rozpoczniesz rozmowę, nadaj nazwę tym kryteriom. Nazwa pomoże Ci później zidentyfikować te kryteria na liście.
          </p>
          
          <div style={{ marginBottom: "1rem" }}>
            <label style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem", color: "#374151" }}>
              Nazwa kryteriów *
            </label>
            <input
              type="text"
              value={tempName || (criteria.name && !["Kryteria weryfikacji firm", "Nowe kryteria weryfikacji", "Nowe kryteria weryfikacji firm", "Nowe kryteria weryfikacji dodaj firm"].includes(criteria.name.trim()) && !criteria.name.match(/^(Kryteria weryfikacji firm|Nowe kryteria weryfikacji) (\d+)$/) ? criteria.name : "") || ""}
              onChange={(e) => setTempName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (tempName || criteria?.name || "").trim()) {
                  handleSaveName();
                }
              }}
              placeholder="np. Kryteria dla producenta stoisk targowych"
              style={{
                width: "100%",
                padding: "0.75rem",
                border: "1px solid #D1D5DB",
                borderRadius: "0.5rem",
                fontSize: "1rem",
              }}
              autoFocus
            />
          </div>

          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
            <button
              onClick={handleSaveName}
              disabled={saving || !(tempName || criteria?.name || "").trim()}
              style={{
                padding: "0.75rem 2rem",
                backgroundColor: saving || !(tempName || criteria?.name || "").trim() ? "#9CA3AF" : "#3B82F6",
                color: "white",
                border: "none",
                borderRadius: "0.5rem",
                cursor: saving || !(tempName || criteria?.name || "").trim() ? "not-allowed" : "pointer",
                fontSize: "1rem",
                fontWeight: 500,
              }}
            >
              {saving ? "Zapisywanie..." : "Zapisz nazwę"}
            </button>
          </div>
        </div>
      )}

      {/* Tabs - ukryj gdy wymagana jest nazwa */}
      {!shouldShowNamePrompt && (
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
          onClick={() => setActiveTab("prompt")}
          style={{
            padding: "0.75rem 1.5rem",
            border: "none",
            backgroundColor: "transparent",
            borderBottom: activeTab === "prompt" ? "2px solid #3B82F6" : "2px solid transparent",
            color: activeTab === "prompt" ? "#3B82F6" : "#6B7280",
            cursor: "pointer",
            fontWeight: activeTab === "prompt" ? "600" : "400",
          }}
        >
          Prompt do analizy
        </button>
      </div>
      )}

      {/* View Tab */}
      {!shouldShowNamePrompt && activeTab === "view" && (
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

          {/* Brief strategiczny */}
          <div
            style={{
              padding: "1.5rem",
              backgroundColor: "white",
              borderRadius: "0.5rem",
              boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
              border: "1px solid #E5E7EB",
              marginBottom: "2rem",
            }}
          >
            <div style={{ marginBottom: "1rem" }}>
              <h3 style={{ fontSize: "1.25rem", marginBottom: "0.5rem", color: "#1F2937" }}>Brief strategiczny</h3>
              <div style={{ 
                padding: "0.75rem", 
                backgroundColor: "#EFF6FF", 
                border: "1px solid #3B82F6", 
                borderRadius: "0.5rem",
                fontSize: "0.9rem",
                color: "#1E40AF"
              }}>
                <strong>🎯 PRIORYTET 1:</strong> Brief strategiczny jest <strong>głównym źródłem kontekstu biznesowego</strong> dla AI podczas weryfikacji firm. 
                Wszystkie decyzje AI są oparte na kontekście biznesowym z tego briefu.
              </div>
            </div>
            {loadingBrief ? (
              <p style={{ color: "#6B7280" }}>Ładowanie briefu...</p>
            ) : brief && (brief.summary || brief.decisionGuidelines.length > 0 || brief.targetCompanies.length > 0 || brief.avoidCompanies.length > 0 || brief.aiRole) ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.9rem", color: "#4B5563" }}>
                {brief.aiRole && (
                  <div>
                    <strong>Rola AI podczas weryfikacji:</strong>
                    <p style={{ marginTop: "0.35rem", fontStyle: "italic", color: "#2563EB" }}>{brief.aiRole}</p>
                  </div>
                )}
                {brief.summary && <p>{brief.summary}</p>}

                {brief.decisionGuidelines && brief.decisionGuidelines.length > 0 && (
                  <div>
                    <strong>Wskazówki decyzyjne:</strong>
                    <ul style={{ marginTop: "0.35rem", marginBottom: 0, paddingLeft: "1.2rem" }}>
                      {brief.decisionGuidelines.map((item, index) => (
                        <li key={`guideline-${index}`}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {brief.targetCompanies && brief.targetCompanies.length > 0 && (
                  <div>
                    <strong>Przykłady firm kwalifikowanych:</strong>
                    <ul style={{ marginTop: "0.35rem", marginBottom: 0, paddingLeft: "1.2rem" }}>
                      {brief.targetCompanies.map((item, index) => (
                        <li key={`target-${index}`}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {brief.avoidCompanies && brief.avoidCompanies.length > 0 && (
                  <div>
                    <strong>Przykłady firm odrzucanych:</strong>
                    <ul style={{ marginTop: "0.35rem", marginBottom: 0, paddingLeft: "1.2rem" }}>
                      {brief.avoidCompanies.map((item, index) => (
                        <li key={`avoid-${index}`}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {brief.additionalNotes && (
                  <div>
                    <strong>Dodatkowe notatki:</strong>
                    <p style={{ marginTop: "0.35rem" }}>{brief.additionalNotes}</p>
                  </div>
                )}

                {brief.updatedAt && (
                  <div style={{ fontSize: "0.75rem", color: "#9CA3AF" }}>
                    Ostatnia aktualizacja: {new Date(brief.updatedAt).toLocaleString("pl-PL")}
                  </div>
                )}
              </div>
            ) : (
              <p style={{ color: "#6B7280" }}>
                Brief zostanie wygenerowany automatycznie po wygenerowaniu kryteriów z rozmowy.
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
      {!shouldShowNamePrompt && activeTab === "chat" && (
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
              alignItems: "flex-end",
              borderRadius: "0 0 0.5rem 0.5rem",
            }}
          >
            <textarea
              ref={messageInputRef}
              value={messageInput}
              onChange={(e) => {
                setMessageInput(e.target.value);
                // Automatyczne dopasowanie wysokości
                e.target.style.height = "auto";
                e.target.style.height = `${Math.min(e.target.scrollHeight, 150)}px`;
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Wpisz wiadomość... (Shift+Enter dla nowej linii, Enter aby wysłać)"
              disabled={sending}
              rows={1}
              style={{
                flex: 1,
                padding: "0.75rem",
                border: "1px solid #D1D5DB",
                borderRadius: "0.5rem",
                fontSize: "1rem",
                fontFamily: "inherit",
                resize: "none",
                minHeight: "44px",
                maxHeight: "150px",
                overflowY: "auto",
                lineHeight: "1.5",
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
                height: "fit-content",
                whiteSpace: "nowrap",
              }}
            >
              Wyślij
            </button>
          </div>
        </div>
      )}

      {/* Prompt Tab */}
      {!shouldShowNamePrompt && activeTab === "prompt" && (
        <div
          style={{
            padding: "2rem",
            backgroundColor: "white",
            borderRadius: "0.5rem",
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          }}
        >
          <div style={{ marginBottom: "1.5rem" }}>
            <h2 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>
              Prompt do analizy
            </h2>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "1rem",
                padding: "1rem",
                backgroundColor: "#F9FAFB",
                borderRadius: "0.5rem",
                border: "1px solid #E5E7EB"
              }}
            >
              <label style={{ fontSize: "0.95rem", fontWeight: 500, color: "#374151" }}>
                Model AI:
              </label>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  onClick={() => {
                    setVerificationModel("gpt-4o-mini");
                    if (typeof window !== "undefined" && criteriaId) {
                      localStorage.setItem(`criteria-verification-model-${criteriaId}`, "gpt-4o-mini");
                    }
                  }}
                  style={{
                    padding: "0.5rem 1rem",
                    borderRadius: "0.375rem",
                    border: "1px solid #D1D5DB",
                    backgroundColor: verificationModel === "gpt-4o-mini" ? "#3B82F6" : "white",
                    color: verificationModel === "gpt-4o-mini" ? "white" : "#374151",
                    cursor: "pointer",
                    fontWeight: verificationModel === "gpt-4o-mini" ? 600 : 400,
                  }}
                >
                  GPT-4o Mini
                </button>
                <button
                  onClick={() => {
                    setVerificationModel("gpt-4o");
                    if (typeof window !== "undefined" && criteriaId) {
                      localStorage.setItem(`criteria-verification-model-${criteriaId}`, "gpt-4o");
                    }
                  }}
                  style={{
                    padding: "0.5rem 1rem",
                    borderRadius: "0.375rem",
                    border: "1px solid #D1D5DB",
                    backgroundColor: verificationModel === "gpt-4o" ? "#3B82F6" : "white",
                    color: verificationModel === "gpt-4o" ? "white" : "#374151",
                    cursor: "pointer",
                    fontWeight: verificationModel === "gpt-4o" ? 600 : 400,
                  }}
                >
                  GPT-4o
                </button>
              </div>
              <span style={{ fontSize: "0.85rem", color: "#6B7280" }}>
                Wybrany model będzie używany do weryfikacji firm
              </span>
            </div>
          </div>

          {loadingPrompt ? (
            <div style={{ padding: "2rem", textAlign: "center", color: "#6B7280" }}>
              Ładowanie promptu...
            </div>
          ) : promptText ? (
            <div
              style={{
                padding: "1.5rem",
                backgroundColor: "#F9FAFB",
                borderRadius: "0.5rem",
                border: "1px solid #E5E7EB",
              }}
            >
              <pre
                style={{
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  fontFamily: "monospace",
                  fontSize: "0.875rem",
                  lineHeight: 1.6,
                  color: "#1F2937",
                  margin: 0,
                }}
              >
                {promptText}
              </pre>
            </div>
          ) : (
            <div style={{ padding: "2rem", textAlign: "center", color: "#6B7280" }}>
              Nie udało się załadować promptu. Upewnij się, że kryteria zostały wygenerowane.
            </div>
          )}

          <div style={{ marginTop: "2rem", padding: "1rem", backgroundColor: "#FEF3C7", border: "1px solid #F59E0B", borderRadius: "0.5rem", color: "#92400E", fontSize: "0.875rem" }}>
            <strong>Uwaga:</strong> Ten prompt jest używany przez AI do weryfikacji firm. Brief strategiczny (PRIORYTET 1) jest głównym źródłem kontekstu biznesowego, a kryteria weryfikacji (PRIORYTET 2) zawierają szczegółowe instrukcje.
          </div>
        </div>
      )}

      {/* Edit Tab - usunięty, zastąpiony przez Prompt Tab */}
    </div>
  );
}
