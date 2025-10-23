"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

interface ConfigMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export default function AISettingsPage() {
  const [config, setConfig] = useState<any>(null);
  const [history, setHistory] = useState<ConfigMessage[]>([]);
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchConfig();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history]);

  const fetchConfig = async () => {
    try {
      const res = await fetch("/api/content-planner/settings");
      if (res.ok) {
        const data = await res.json();
        setConfig(data.config);
        setHistory(data.config.history || []);
      }
    } catch (error) {
      console.error("Błąd pobierania config:", error);
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

    // Dodaj message do historii (optymistycznie)
    const newMsg: ConfigMessage = {
      role: "user",
      content: userMessage,
      timestamp: new Date().toISOString()
    };
    setHistory(prev => [...prev, newMsg]);

    try {
      const res = await fetch("/api/content-planner/settings/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage })
      });

      if (res.ok) {
        await fetchConfig(); // Odśwież całą konfigurację
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

  const handleReset = async () => {
    if (!confirm("Czy na pewno chcesz zresetować konfigurację do domyślnej? Utracisz wszystkie własne zasady.")) {
      return;
    }

    try {
      const res = await fetch("/api/content-planner/settings", {
        method: "DELETE"
      });

      if (res.ok) {
        alert("✅ Konfiguracja zresetowana!");
        fetchConfig();
      }
    } catch (error) {
      alert(`❌ Błąd: ${error}`);
    }
  };

  if (isLoading) {
    return <main className="container" style={{ paddingTop: "var(--spacing-xl)" }}>Ładowanie...</main>;
  }

  return (
    <main className="container" style={{ paddingTop: "var(--spacing-xl)", paddingBottom: "var(--spacing-2xl)" }}>
      <div style={{ marginBottom: 20 }}>
        <Link href="/content-planner">← Wróć do plannera</Link>
      </div>

      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ display: "flex", alignItems: "center", gap: 12, margin: 0 }}>
          ⚙️ Ustawienia AI Content Assistant
        </h1>
        <p style={{ color: "#666", marginTop: 8 }}>
          Rozmawiaj z Meta-AI aby skonfigurować jak AI pisze kampanie
        </p>
        {config && (
          <div style={{ marginTop: 12, fontSize: 13, color: "#888" }}>
            Wersja promptu: v{config.promptVersion} • Ostatnia aktualizacja: {new Date(config.lastUpdate).toLocaleDateString("pl-PL")}
          </div>
        )}
      </div>

      {/* Layout: Chat (left) + Rules Preview (right) */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 24 }}>
        
        {/* CHAT PANEL */}
        <div className="card" style={{ padding: 0, height: "600px", display: "flex", flexDirection: "column" }}>
          {/* Chat header */}
          <div style={{ padding: "16px 20px", borderBottom: "2px solid #e5e7eb", backgroundColor: "#f9fafb" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ fontSize: 32 }}>🤖</div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 16 }}>Meta-AI Assistant</div>
                <div style={{ fontSize: 12, color: "#666" }}>Powered by GPT-4o • Konfiguruje zachowanie Content AI</div>
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
            {history.length === 0 ? (
              <div style={{ textAlign: "center", padding: 40, color: "#999" }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>💬</div>
                <p>Brak historii rozmowy</p>
                <p style={{ fontSize: 14, marginTop: 8 }}>
                  Napisz pierwszą wiadomość, np:<br />
                  <em>"Zawsze pisz krótko, max 150 słów"</em>
                </p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {history.map((msg, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      justifyContent: msg.role === "user" ? "flex-end" : "flex-start"
                    }}
                  >
                    <div
                      style={{
                        maxWidth: "75%",
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
                          🤖 Meta-AI
                        </div>
                      )}
                      <div dangerouslySetInnerHTML={{ __html: msg.content.replace(/\n/g, '<br />') }} />
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
                placeholder="Napisz jak AI ma pisać kampanie..."
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

        {/* RULES PREVIEW SIDEBAR */}
        <div>
          {/* Obecne zasady */}
          <div className="card" style={{ padding: 20, marginBottom: 16 }}>
            <h3 style={{ margin: "0 0 16px 0", fontSize: 16 }}>📋 Obecne zasady</h3>
            
            {config?.globalRules && Object.keys(config.globalRules).length > 0 ? (
              <div style={{ fontSize: 13 }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>🌍 Globalne:</div>
                <div style={{ backgroundColor: "#f9fafb", padding: 12, borderRadius: 6, fontSize: 12, fontFamily: "monospace" }}>
                  <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
                    {JSON.stringify(config.globalRules, null, 2)}
                  </pre>
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 13, color: "#999" }}>
                Używasz domyślnych zasad
              </div>
            )}

            {config?.groupSpecificRules && Object.keys(config.groupSpecificRules).length > 0 && (
              <div style={{ fontSize: 13, marginTop: 16 }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>📦 Dla grup:</div>
                <div style={{ backgroundColor: "#f9fafb", padding: 12, borderRadius: 6, fontSize: 12, fontFamily: "monospace" }}>
                  <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
                    {JSON.stringify(config.groupSpecificRules, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ margin: "0 0 16px 0", fontSize: 16 }}>⚡ Akcje</h3>
            
            <button
              onClick={handleReset}
              className="btn btn-danger"
              style={{ width: "100%", marginBottom: 12 }}
            >
              🔄 Reset do domyślnych
            </button>

            <div style={{ fontSize: 11, color: "#666", lineHeight: 1.4 }}>
              💡 Przykładowe komendy:<br />
              • "Zawsze pisz max 2 akapity"<br />
              • "Ton bardziej formalny"<br />
              • "Dla podwieszeń dodaj certyfikaty"<br />
              • "Pokaż obecne zasady"
            </div>
          </div>

          {/* Info */}
          <div style={{ marginTop: 16, padding: 12, backgroundColor: "#e0f2fe", borderRadius: 6, fontSize: 12 }}>
            ℹ️ <strong>Jak to działa?</strong><br />
            Meta-AI rozmawia z Tobą, ekstraktuje zasady i generuje SYSTEM_PERSONA. Content AI używa go w następnych kampaniach.
          </div>
        </div>
      </div>
    </main>
  );
}

