"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface VirtualSalesperson {
  id: number;
  name: string;
  email: string;
  language: string;
  markets: string | null;
  isActive: boolean;
}

interface SalespersonEditorProps {
  campaignId: number;
  currentSalesperson: VirtualSalesperson | null;
}

export default function SalespersonEditor({ campaignId, currentSalesperson }: SalespersonEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [selectedSalespersonId, setSelectedSalespersonId] = useState<number | null>(
    currentSalesperson?.id || null
  );
  const [salespeople, setSalespeople] = useState<VirtualSalesperson[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetchSalespeople();
  }, []);

  const fetchSalespeople = async () => {
    try {
      const response = await fetch("/api/salespeople");
      if (response.ok) {
        const data = await response.json();
        setSalespeople(data.filter((sp: VirtualSalesperson) => sp.isActive));
      }
    } catch (error) {
      console.error("Błąd pobierania handlowców:", error);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/salesperson`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ virtualSalespersonId: selectedSalespersonId })
      });

      if (response.ok) {
        setIsEditing(false);
        alert("Handlowiec zaktualizowany!");
        router.refresh();
      } else {
        alert("Błąd aktualizacji handlowca");
      }
    } catch (error) {
      alert("Błąd aktualizacji handlowca");
    } finally {
      setIsSaving(false);
    }
  };

  if (!isEditing) {
    return (
      <div style={{ marginBottom: 20, padding: 20, backgroundColor: "#f8f9fa", borderRadius: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3>Wirtualny handlowiec</h3>
          <button
            onClick={() => setIsEditing(true)}
            style={{
              padding: 8,
              backgroundColor: "#0066cc",
              color: "white",
              border: "none",
              borderRadius: 4,
              cursor: "pointer"
            }}
          >
            {currentSalesperson ? "Zmień handlowca" : "Przypisz handlowca"}
          </button>
        </div>
        {currentSalesperson ? (
          <div style={{ padding: 12, backgroundColor: "white", borderRadius: 4, border: "1px solid #ddd" }}>
            <p style={{ margin: 0, fontWeight: "bold" }}>{currentSalesperson.name}</p>
            <p style={{ margin: "4px 0", fontSize: "14px" }}>
              <a href={`mailto:${currentSalesperson.email}`} style={{ color: "#0066cc" }}>
                {currentSalesperson.email}
              </a>
            </p>
            <p style={{ margin: "4px 0", fontSize: "12px", color: "#666" }}>
              Język: {currentSalesperson.language.toUpperCase()}
              {currentSalesperson.markets && ` • Rynki: ${currentSalesperson.markets}`}
            </p>
          </div>
        ) : (
          <div style={{ padding: 12, backgroundColor: "#fff3cd", borderRadius: 4, border: "1px solid #ffeaa7" }}>
            <p style={{ margin: 0, color: "#856404" }}>Brak przypisanego handlowca</p>
            <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#856404" }}>
              Maile będą wysyłane bez określonego nadawcy
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 20, padding: 20, backgroundColor: "#f8f9fa", borderRadius: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h3>{currentSalesperson ? "Zmień handlowca" : "Przypisz handlowca"}</h3>
        <div>
          <button
            onClick={() => setIsEditing(false)}
            style={{
              padding: 8,
              marginRight: 8,
              backgroundColor: "#6c757d",
              color: "white",
              border: "none",
              borderRadius: 4,
              cursor: "pointer"
            }}
          >
            Anuluj
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            style={{
              padding: 8,
              backgroundColor: isSaving ? "#ccc" : "#28a745",
              color: "white",
              border: "none",
              borderRadius: 4,
              cursor: isSaving ? "not-allowed" : "pointer"
            }}
          >
            {isSaving ? "Zapisuję..." : "Zapisz"}
          </button>
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={{ display: "block", fontWeight: "bold", marginBottom: 8 }}>
          Wybierz handlowca:
        </label>
        <select
          value={selectedSalespersonId || ""}
          onChange={(e) => setSelectedSalespersonId(e.target.value ? Number(e.target.value) : null)}
          style={{
            width: "100%",
            padding: 8,
            border: "1px solid #ccc",
            borderRadius: 4,
            fontSize: 16
          }}
        >
          <option value="">-- Brak handlowca --</option>
          {salespeople.map(salesperson => (
            <option key={salesperson.id} value={salesperson.id}>
{salesperson.name} ({salesperson.language.toUpperCase()})
              {salesperson.markets && ` - ${salesperson.markets}`}
            </option>
          ))}
        </select>
        <p style={{ fontSize: "12px", color: "#666", marginTop: 4 }}>
          Handlowiec będzie widoczny jako nadawca maili. Maile będą wysyłane z jego adresu email.
        </p>
      </div>
    </div>
  );
}
