"use client";

import { useState } from "react";

interface AIAgentButtonProps {
  replyId: number;
  onProcessed?: () => void;
}

export default function AIAgentButton({ replyId, onProcessed }: AIAgentButtonProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleProcess = async () => {
    if (isProcessing) return;
    
    setIsProcessing(true);
    setMessage(null);
    
    try {
      const response = await fetch("/api/ai-agent/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ replyId })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Błąd przetwarzania przez AI Agent");
      }

      const result = await response.json();
      setMessage({ 
        type: "success", 
        text: `AI Agent przetworzył odpowiedź: ${result.analysis.classification} (${result.analysis.actionsTaken} akcji)` 
      });
      
      if (onProcessed) {
        onProcessed();
      }
      
      // Usuń komunikat po 5 sekundach
      setTimeout(() => setMessage(null), 5000);
      
    } catch (error: any) {
      setMessage({ type: "error", text: error.message });
      console.error("Error processing with AI Agent:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      <button
        onClick={handleProcess}
        disabled={isProcessing}
        style={{
          padding: "8px 16px",
          backgroundColor: isProcessing ? "var(--gray-400)" : "var(--primary)",
          color: "white",
          border: "none",
          borderRadius: "4px",
          cursor: isProcessing ? "not-allowed" : "pointer",
          fontSize: "12px",
          fontWeight: "600",
          display: "flex",
          alignItems: "center",
          gap: "6px",
          opacity: isProcessing ? 0.7 : 1
        }}
      >
        {isProcessing ? (
          <>⏳ Przetwarzanie...</>
        ) : (
          <>🤖 AI Agent</>
        )}
      </button>
      
      {message && (
        <div style={{
          padding: "8px 12px",
          backgroundColor: message.type === "success" ? "var(--success-light)" : "var(--error-light)",
          color: message.type === "success" ? "var(--success-dark)" : "var(--error-dark)",
          borderRadius: "4px",
          fontSize: "11px",
          fontWeight: "500",
          maxWidth: "200px"
        }}>
          {message.type === "success" ? "✅" : "❌"} {message.text}
        </div>
      )}
    </div>
  );
}
