"use client";

import { useState, useEffect } from 'react';

interface ChatMessage {
  id: string;
  userMessage: string;
  aiResponse: string;
  rulesCreated: string[];
  createdAt: Date;
}

interface ChatResponse {
  message: string;
  rulesCreated: string[];
  suggestions: string[];
}

export default function AIChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [rules, setRules] = useState<any[]>([]);

  // Pobierz historię chat i zasady przy załadowaniu
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
        setMessages(data.data.history);
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

    // Dodaj wiadomość użytkownika do UI
    const userMsg: ChatMessage = {
      id: `user_${Date.now()}`,
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
        const aiResponse: ChatResponse = data.data;
        
        // Dodaj odpowiedź AI do UI
        const aiMsg: ChatMessage = {
          id: `ai_${Date.now()}`,
          userMessage: '',
          aiResponse: aiResponse.message,
          rulesCreated: aiResponse.rulesCreated,
          createdAt: new Date()
        };
        
        setMessages(prev => [...prev, aiMsg]);
        setSuggestions(aiResponse.suggestions);
        
        // Odśwież zasady jeśli utworzono nowe
        if (aiResponse.rulesCreated.length > 0) {
          fetchRules();
        }
      } else {
        throw new Error(data.error || 'Błąd przetwarzania wiadomości');
      }
    } catch (error) {
      console.error('Błąd wysyłania wiadomości:', error);
      
      // Dodaj wiadomość o błędzie
      const errorMsg: ChatMessage = {
        id: `error_${Date.now()}`,
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
    return new Date(date).toLocaleTimeString('pl-PL', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto p-6" style={{ maxWidth: '1200px', width: '100%' }}>
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                🤖 AI Chat Interface
              </h1>
              <p className="text-gray-600">
                Inteligentny chat do zarządzania zasadami klasyfikacji emaili
              </p>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-500">Status</div>
              <div className="text-green-600 font-semibold">🟢 Online</div>
            </div>
          </div>
        </div>

        {/* Main Content - Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Sidebar - Rules */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm mb-6">
              <div className="p-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">
                  📋 Zasady AI
                </h3>
              </div>
              <div className="p-4">
                <div className="space-y-3">
                  {rules.length > 0 ? (
                    rules.slice(0, 5).map((rule, index) => (
                      <div key={rule.id} className="text-sm">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-gray-800">
                            {rule.classification}
                          </span>
                          <span className="text-xs text-gray-500">
                            {rule.confidence * 100}%
                          </span>
                        </div>
                        <div className="text-gray-600 text-xs">
                          {rule.keywords.slice(0, 2).join(', ')}
                          {rule.keywords.length > 2 && '...'}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-gray-500">
                      Ładowanie zasad...
                    </div>
                  )}
                  {rules.length > 5 && (
                    <div className="text-xs text-blue-600 text-center pt-2">
                      +{rules.length - 5} więcej zasad
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-lg shadow-sm">
              <div className="p-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">
                  ⚡ Szybkie akcje
                </h3>
              </div>
              <div className="p-4 space-y-2">
                <button
                  onClick={() => setInputMessage("Pokaż wszystkie zasady")}
                  className="w-full text-left px-3 py-2 bg-blue-50 text-blue-700 rounded text-sm hover:bg-blue-100 transition-colors"
                >
                  📋 Pokaż wszystkie zasady
                </button>
                <button
                  onClick={() => setInputMessage("Pokaż zasady dla INTERESTED")}
                  className="w-full text-left px-3 py-2 bg-green-50 text-green-700 rounded text-sm hover:bg-green-100 transition-colors"
                >
                  ✅ Zasady INTERESTED
                </button>
                <button
                  onClick={() => setInputMessage("Pokaż zasady dla NOT_INTERESTED")}
                  className="w-full text-left px-3 py-2 bg-red-50 text-red-700 rounded text-sm hover:bg-red-100 transition-colors"
                >
                  ❌ Zasady NOT_INTERESTED
                </button>
                <button
                  onClick={() => setInputMessage("Pokaż zasady dla MAYBE_LATER")}
                  className="w-full text-left px-3 py-2 bg-yellow-50 text-yellow-700 rounded text-sm hover:bg-yellow-100 transition-colors"
                >
                  ⏰ Zasady MAYBE_LATER
                </button>
              </div>
            </div>
          </div>

          {/* Main Chat Area */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm mb-6">
              <div className="p-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">
                  💬 Chat z AI
                </h2>
              </div>
              
              <div className="h-96 overflow-y-auto p-6 space-y-4">
            {messages.length === 0 ? (
              <div className="text-center text-gray-500 py-12">
                <div className="text-6xl mb-4">🤖</div>
                <p className="text-lg mb-2">Witaj w AI Chat Interface!</p>
                <p className="text-sm">Rozpocznij rozmowę z AI, aby zarządzać zasadami klasyfikacji.</p>
              </div>
            ) : (
              messages.map((message) => (
                <div key={message.id} className="space-y-3">
                  {message.userMessage && (
                    <div className="flex justify-end">
                      <div className="bg-blue-500 text-white rounded-lg px-4 py-3 max-w-md shadow-sm">
                        <p className="text-sm leading-relaxed">{message.userMessage}</p>
                        <p className="text-xs opacity-75 mt-2 text-right">
                          {formatTime(message.createdAt)}
                        </p>
                      </div>
                    </div>
                  )}
                  
                  {message.aiResponse && (
                    <div className="flex justify-start">
                      <div className="bg-gray-50 border border-gray-200 text-gray-900 rounded-lg px-4 py-3 max-w-3xl shadow-sm">
                        <div className="flex items-start space-x-2">
                          <div className="text-lg">🤖</div>
                          <div className="flex-1">
                            <div className="whitespace-pre-wrap text-sm leading-relaxed">
                              {message.aiResponse}
                            </div>
                            {message.rulesCreated.length > 0 && (
                              <div className="mt-3 p-2 bg-green-50 border border-green-200 rounded text-xs text-green-700">
                                ✅ Utworzono {message.rulesCreated.length} zasad
                              </div>
                            )}
                            <p className="text-xs text-gray-500 mt-2">
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
              <div className="flex justify-start">
                <div className="bg-gray-50 border border-gray-200 text-gray-900 rounded-lg px-4 py-3 shadow-sm">
                  <div className="flex items-center space-x-2">
                    <div className="text-lg">🤖</div>
                    <div className="flex items-center space-x-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
                      <span className="text-sm">AI analizuje...</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
              </div>
            </div>

            {/* Input Area */}
            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="flex space-x-3">
                <div className="flex-1">
                  <textarea
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Napisz wiadomość do AI... (np. 'Dodaj zasadę: jeśli lead pisze nie teraz to klasyfikuj jako MAYBE_LATER')"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm"
                    rows={3}
                    disabled={isLoading}
                  />
                </div>
                <button
                  onClick={sendMessage}
                  disabled={!inputMessage.trim() || isLoading}
                  className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  {isLoading ? '⏳' : '📤'}
                </button>
              </div>
              
              {/* Suggestions */}
              {suggestions.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm text-gray-600 mb-2">💡 Sugestie:</p>
                  <div className="flex flex-wrap gap-2">
                    {suggestions.map((suggestion, index) => (
                      <button
                        key={index}
                        onClick={() => setInputMessage(suggestion)}
                        className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm hover:bg-blue-100 transition-colors border border-blue-200"
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
    </div>
  );
}
