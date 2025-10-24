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

  // Pobierz historię chat przy załadowaniu
  useEffect(() => {
    fetchChatHistory();
  }, []);

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
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            AI Chat Interface
          </h1>
          <p className="text-gray-600">
            Chat z AI do zarządzania zasadami klasyfikacji emaili
          </p>
        </div>

        {/* Chat Messages */}
        <div className="bg-white rounded-lg shadow-sm mb-6">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Historia rozmowy
            </h2>
          </div>
          
          <div className="h-96 overflow-y-auto p-6 space-y-4">
            {messages.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                <p>Brak wiadomości. Rozpocznij rozmowę z AI!</p>
              </div>
            ) : (
              messages.map((message) => (
                <div key={message.id} className="space-y-2">
                  {message.userMessage && (
                    <div className="flex justify-end">
                      <div className="bg-blue-500 text-white rounded-lg px-4 py-2 max-w-xs">
                        <p className="text-sm">{message.userMessage}</p>
                        <p className="text-xs opacity-75 mt-1">
                          {formatTime(message.createdAt)}
                        </p>
                      </div>
                    </div>
                  )}
                  
                  {message.aiResponse && (
                    <div className="flex justify-start">
                      <div className="bg-gray-100 text-gray-900 rounded-lg px-4 py-2 max-w-2xl">
                        <div className="whitespace-pre-wrap text-sm">
                          {message.aiResponse}
                        </div>
                        {message.rulesCreated.length > 0 && (
                          <div className="mt-2 text-xs text-green-600">
                            ✅ Utworzono {message.rulesCreated.length} zasad
                          </div>
                        )}
                        <p className="text-xs text-gray-500 mt-1">
                          {formatTime(message.createdAt)}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
            
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 text-gray-900 rounded-lg px-4 py-2">
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
                    <span className="text-sm">AI myśli...</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Input Area */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex space-x-4">
            <div className="flex-1">
              <textarea
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Napisz wiadomość do AI... (np. 'Dodaj zasadę: jeśli lead pisze nie teraz to klasyfikuj jako MAYBE_LATER')"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                rows={3}
                disabled={isLoading}
              />
            </div>
            <button
              onClick={sendMessage}
              disabled={!inputMessage.trim() || isLoading}
              className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? 'Wysyłanie...' : 'Wyślij'}
            </button>
          </div>
          
          {/* Suggestions */}
          {suggestions.length > 0 && (
            <div className="mt-4">
              <p className="text-sm text-gray-600 mb-2">Sugestie:</p>
              <div className="flex flex-wrap gap-2">
                {suggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    onClick={() => setInputMessage(suggestion)}
                    className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm hover:bg-gray-200 transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Quick Commands */}
        <div className="mt-6 bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Szybkie komendy
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h4 className="font-medium text-gray-700">Dodawanie zasad:</h4>
              <button
                onClick={() => setInputMessage("Dodaj zasadę: jeśli lead pisze 'nie teraz' to klasyfikuj jako MAYBE_LATER")}
                className="block w-full text-left px-3 py-2 bg-gray-50 rounded text-sm hover:bg-gray-100 transition-colors"
              >
                "Dodaj zasadę: jeśli lead pisze 'nie teraz' to klasyfikuj jako MAYBE_LATER"
              </button>
              <button
                onClick={() => setInputMessage("Dodaj zasadę: jeśli lead pisze 'proszę o wycenę' to klasyfikuj jako INTERESTED")}
                className="block w-full text-left px-3 py-2 bg-gray-50 rounded text-sm hover:bg-gray-100 transition-colors"
              >
                "Dodaj zasadę: jeśli lead pisze 'proszę o wycenę' to klasyfikuj jako INTERESTED"
              </button>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium text-gray-700">Zarządzanie:</h4>
              <button
                onClick={() => setInputMessage("Pokaż zasady dla INTERESTED")}
                className="block w-full text-left px-3 py-2 bg-gray-50 rounded text-sm hover:bg-gray-100 transition-colors"
              >
                "Pokaż zasady dla INTERESTED"
              </button>
              <button
                onClick={() => setInputMessage("Pokaż wszystkie zasady")}
                className="block w-full text-left px-3 py-2 bg-gray-50 rounded text-sm hover:bg-gray-100 transition-colors"
              >
                "Pokaż wszystkie zasady"
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
