"use client";

import { useState, useEffect } from 'react';

interface ChatMessage {
  id: string;
  userMessage: string;
  aiResponse: string;
  rulesCreated: string[];
  createdAt: Date;
}

export default function AIChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [rules, setRules] = useState<any[]>([]);

  // Fetch chat history and rules on component mount
  useEffect(() => {
    fetchChatHistory();
    fetchRules();
  }, []);

  const fetchRules = async () => {
    try {
      const response = await fetch('/api/ai/rules');
      const data = await response.json();
      
      if (data.success) {
        setRules(data.data);
      }
    } catch (error) {
      console.error('Błąd pobierania zasad:', error);
    }
  };

  const fetchChatHistory = async () => {
    try {
      const response = await fetch('/api/ai/chat');
      const data = await response.json();
      
      if (data.success) {
        setMessages(data.data || []);
      }
    } catch (error) {
      console.error('Błąd pobierania historii chat:', error);
    }
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage = inputMessage.trim();
    setInputMessage('');
    setIsLoading(true);

    // Add user message to chat
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      userMessage,
      aiResponse: '',
      rulesCreated: [],
      createdAt: new Date()
    };

    setMessages(prev => [...prev, userMsg]);

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: userMessage }),
      });

      const data = await response.json();

      if (data.success) {
        const aiMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          userMessage: '',
          aiResponse: data.response,
          rulesCreated: data.rulesCreated || [],
          createdAt: new Date()
        };

        setMessages(prev => [...prev, aiMsg]);

        // Refresh rules if new ones were created
        if (data.rulesCreated && data.rulesCreated.length > 0) {
          fetchRules();
        }

        // Set suggestions
        if (data.suggestions) {
          setSuggestions(data.suggestions);
        }
      } else {
        throw new Error(data.error || 'Błąd komunikacji z AI');
      }
    } catch (error: any) {
      console.error('Błąd wysyłania wiadomości:', error);
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        userMessage: '',
        aiResponse: `❌ Błąd: ${error instanceof Error ? error.message : 'Nieznany błąd'}`,
        rulesCreated: [],
        createdAt: new Date()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat('pl-PL', {
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  return (
    <div className="container" style={{ paddingTop: "var(--spacing-xl)", paddingBottom: "var(--spacing-2xl)" }}>
      <div style={{ marginBottom: "var(--spacing-2xl)" }}>
        <h1 style={{ fontSize: "2.5rem", marginBottom: "var(--spacing-sm)" }}>
          AI Chat Interface
        </h1>
        <p style={{ fontSize: "1.1rem", color: "var(--gray-600)" }}>
          Inteligentny chat do zarządzania zasadami klasyfikacji emaili
        </p>
      </div>

      {/* Main Content - Two Column Layout */}
      <div className="grid" style={{ gridTemplateColumns: "1fr 3fr", gap: "var(--spacing-lg)" }}>
        {/* Sidebar - Rules */}
        <div>
          <div className="card" style={{ marginBottom: "var(--spacing-lg)" }}>
            <div className="card-header">
              <h3>Zasady AI</h3>
            </div>
            <div>
              {rules.length > 0 ? (
                rules.slice(0, 5).map((rule, index) => (
                  <div key={rule.id} style={{ marginBottom: "var(--spacing-md)", padding: "var(--spacing-sm)", backgroundColor: "var(--gray-50)", borderRadius: "var(--radius)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "var(--spacing-xs)" }}>
                      <span style={{ fontWeight: "600", color: "var(--color-text)" }}>
                        {rule.classification}
                      </span>
                      <span style={{ fontSize: "0.8rem", color: "var(--gray-500)" }}>
                        {Math.round(rule.confidence * 100)}%
                      </span>
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "var(--gray-600)" }}>
                      {rule.keywords.slice(0, 2).join(', ')}
                      {rule.keywords.length > 2 && '...'}
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ textAlign: "center", color: "var(--gray-500)", padding: "var(--spacing-lg)" }}>
                  Ładowanie zasad...
                </div>
              )}
              {rules.length > 5 && (
                <div style={{ textAlign: "center", fontSize: "0.8rem", color: "var(--color-primary)", marginTop: "var(--spacing-sm)" }}>
                  +{rules.length - 5} więcej zasad
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="card">
            <div className="card-header">
              <h3>Szybkie akcje</h3>
            </div>
            <div>
              <button
                onClick={() => setInputMessage("Pokaż wszystkie zasady")}
                className="btn"
                style={{ width: "100%", marginBottom: "var(--spacing-sm)", justifyContent: "flex-start" }}
              >
                Pokaż wszystkie zasady
              </button>
              <button
                onClick={() => setInputMessage("Pokaż zasady dla INTERESTED")}
                className="btn"
                style={{ width: "100%", marginBottom: "var(--spacing-sm)", justifyContent: "flex-start", backgroundColor: "var(--success)", color: "white" }}
              >
                Zasady INTERESTED
              </button>
              <button
                onClick={() => setInputMessage("Pokaż zasady dla NOT_INTERESTED")}
                className="btn"
                style={{ width: "100%", marginBottom: "var(--spacing-sm)", justifyContent: "flex-start", backgroundColor: "var(--error)", color: "white" }}
              >
                Zasady NOT_INTERESTED
              </button>
              <button
                onClick={() => setInputMessage("Pokaż zasady dla MAYBE_LATER")}
                className="btn"
                style={{ width: "100%", justifyContent: "flex-start", backgroundColor: "var(--warning)", color: "white" }}
              >
                Zasady MAYBE_LATER
              </button>
            </div>
          </div>
        </div>

        {/* Main Chat Area */}
        <div>
          <div className="card" style={{ marginBottom: "var(--spacing-lg)" }}>
            <div className="card-header">
              <h3>Chat z AI</h3>
            </div>
            
            <div style={{ height: "400px", overflowY: "auto", padding: "var(--spacing-md)" }}>
              {messages.length === 0 ? (
                <div style={{ textAlign: "center", color: "var(--gray-500)", padding: "var(--spacing-2xl)" }}>
                  <div style={{ fontSize: "4rem", marginBottom: "var(--spacing-lg)" }}>🤖</div>
                  <p style={{ fontSize: "1.2rem", marginBottom: "var(--spacing-sm)" }}>Witaj w AI Chat Interface!</p>
                  <p style={{ fontSize: "0.9rem" }}>Rozpocznij rozmowę z AI, aby zarządzać zasadami klasyfikacji.</p>
                </div>
              ) : (
                messages.map((message) => (
                  <div key={message.id} style={{ marginBottom: "var(--spacing-lg)" }}>
                    {message.userMessage && (
                      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "var(--spacing-sm)" }}>
                        <div style={{ backgroundColor: "var(--color-primary)", color: "white", padding: "var(--spacing-md)", borderRadius: "var(--radius-lg)", maxWidth: "70%", boxShadow: "var(--shadow-sm)" }}>
                          <p style={{ fontSize: "0.9rem", lineHeight: "1.5", marginBottom: "var(--spacing-xs)" }}>{message.userMessage}</p>
                          <p style={{ fontSize: "0.7rem", opacity: "0.8", textAlign: "right" }}>
                            {formatTime(message.createdAt)}
                          </p>
                        </div>
                      </div>
                    )}
                    
                    {message.aiResponse && (
                      <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: "var(--spacing-sm)" }}>
                        <div style={{ backgroundColor: "var(--gray-50)", border: "1px solid var(--gray-200)", color: "var(--color-text)", padding: "var(--spacing-md)", borderRadius: "var(--radius-lg)", maxWidth: "90%", boxShadow: "var(--shadow-sm)" }}>
                          <div style={{ display: "flex", alignItems: "flex-start", gap: "var(--spacing-sm)" }}>
                            <div style={{ fontSize: "1.2rem" }}>🤖</div>
                            <div style={{ flex: 1 }}>
                              <div style={{ whiteSpace: "pre-wrap", fontSize: "0.9rem", lineHeight: "1.5", marginBottom: "var(--spacing-sm)" }}>
                                {message.aiResponse}
                              </div>
                              {message.rulesCreated.length > 0 && (
                                <div style={{ marginTop: "var(--spacing-sm)", padding: "var(--spacing-sm)", backgroundColor: "var(--success)", color: "white", borderRadius: "var(--radius)", fontSize: "0.8rem" }}>
                                  ✅ Utworzono {message.rulesCreated.length} zasad
                                </div>
                              )}
                              <p style={{ fontSize: "0.7rem", color: "var(--gray-500)", marginTop: "var(--spacing-sm)" }}>
                                {formatTime(message.createdAt)}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}

              {isLoading && (
                <div style={{ display: "flex", justifyContent: "flex-start" }}>
                  <div style={{ backgroundColor: "var(--gray-50)", border: "1px solid var(--gray-200)", color: "var(--color-text)", padding: "var(--spacing-md)", borderRadius: "var(--radius-lg)", maxWidth: "90%", boxShadow: "var(--shadow-sm)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--spacing-sm)" }}>
                      <div style={{ width: "16px", height: "16px", border: "2px solid var(--gray-300)", borderTop: "2px solid var(--gray-600)", borderRadius: "50%", animation: "spin 1s linear infinite" }}></div>
                      <span style={{ fontSize: "0.9rem" }}>AI analizuje...</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Input Area */}
          <div className="card">
            <div style={{ display: "flex", gap: "var(--spacing-md)" }}>
              <div style={{ flex: 1 }}>
                <textarea
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Napisz wiadomość do AI... (np. 'Dodaj zasadę: jeśli lead pisze nie teraz to klasyfikuj jako MAYBE_LATER')"
                  style={{ 
                    width: "100%", 
                    padding: "var(--spacing-md)", 
                    border: "1px solid var(--gray-300)", 
                    borderRadius: "var(--radius)", 
                    resize: "none", 
                    fontSize: "0.9rem",
                    fontFamily: "inherit"
                  }}
                  rows={3}
                  disabled={isLoading}
                />
              </div>
              <button
                onClick={sendMessage}
                disabled={!inputMessage.trim() || isLoading}
                className="btn btn-primary"
                style={{ 
                  padding: "var(--spacing-md) var(--spacing-lg)",
                  alignSelf: "flex-start"
                }}
              >
                {isLoading ? '⏳' : '📤'}
              </button>
            </div>
            
            {/* Suggestions */}
            {suggestions.length > 0 && (
              <div style={{ marginTop: "var(--spacing-md)" }}>
                <p style={{ fontSize: "0.9rem", color: "var(--gray-600)", marginBottom: "var(--spacing-sm)" }}>💡 Sugestie:</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--spacing-sm)" }}>
                  {suggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      onClick={() => setInputMessage(suggestion)}
                      className="btn"
                      style={{ 
                        fontSize: "0.8rem", 
                        padding: "var(--spacing-xs) var(--spacing-sm)",
                        backgroundColor: "var(--color-primary)",
                        color: "white"
                      }}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}