"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Tag {
  id: number;
  name: string;
  color: string;
  description: string | null;
  createdAt: Date;
  _count: {
    LeadTag: number;
  };
}

export default function TagsPage() {
  const router = useRouter();
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Pobierz tagi przy załadowaniu strony
  useEffect(() => {
    fetchTags();
  }, []);

  const fetchTags = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/tags");
      if (response.ok) {
        const data = await response.json();
        setTags(data);
      }
    } catch (error) {
      console.error("Błąd pobierania tagów:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (tagId: number, tagName: string, usageCount: number) => {
    if (usageCount > 0) {
      alert(`Nie można usunąć tagu "${tagName}" - jest używany przez ${usageCount} ${usageCount === 1 ? 'leada' : 'leadów'}. Najpierw usuń tag z leadów.`);
      return;
    }

    if (!confirm(`Czy na pewno chcesz usunąć tag "${tagName}"?`)) {
      return;
    }

    try {
      setDeletingId(tagId);
      setError(null);
      const response = await fetch(`/api/tags?id=${tagId}`, {
        method: "DELETE"
      });

      const data = await response.json();

      if (response.ok) {
        // Odśwież listę tagów
        await fetchTags();
        alert("Tag został usunięty");
      } else {
        setError(data.message || data.error || "Błąd usuwania tagu");
        alert(data.message || data.error || "Błąd usuwania tagu");
      }
    } catch (error: any) {
      console.error("Błąd usuwania tagu:", error);
      setError("Wystąpił błąd podczas usuwania tagu");
      alert("Wystąpił błąd podczas usuwania tagu");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <main className="container" style={{ paddingTop: "var(--spacing-xl)", paddingBottom: "var(--spacing-2xl)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "var(--spacing-xl)" }}>
        <div>
          <h1>Zarządzanie tagami</h1>
          <p style={{ color: "var(--gray-600)", marginTop: "var(--spacing-sm)" }}>
            System segmentacji kontaktów
          </p>
        </div>
        <Link href="/" style={{ color: "var(--gray-600)", textDecoration: "none" }}>
          ← Wróć
        </Link>
      </div>

      {/* Formularz dodawania */}
      <div className="card" style={{ marginBottom: "var(--spacing-xl)" }}>
        <h2 style={{ marginBottom: "var(--spacing-lg)" }}>Dodaj nowy tag</h2>
          <form 
            action="/api/tags" 
            method="POST" 
            onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              fetch("/api/tags", {
                method: "POST",
                body: formData
              })
                .then(res => {
                  if (res.ok || res.status === 302) {
                    fetchTags();
                    (e.target as HTMLFormElement).reset();
                  }
                })
                .catch(err => console.error("Błąd:", err));
            }}
            style={{ display: "grid", gridTemplateColumns: "2fr 1fr 2fr auto", gap: "var(--spacing-md)", alignItems: "end" }}
          >
          <div>
            <label style={{ display: "block", marginBottom: "var(--spacing-xs)", fontWeight: "600", fontSize: "14px" }}>
              Nazwa tagu
            </label>
            <input 
              name="name" 
              placeholder="np. firmy targowe" 
              required 
              style={{ width: "100%", padding: "var(--spacing-sm)", border: "1px solid var(--gray-300)", borderRadius: "var(--radius)" }}
            />
          </div>
          <div>
            <label style={{ display: "block", marginBottom: "var(--spacing-xs)", fontWeight: "600", fontSize: "14px" }}>
              Kolor
            </label>
            <input 
              name="color" 
              type="color" 
              defaultValue="#3B82F6" 
              style={{ width: "100%", height: "40px", border: "1px solid var(--gray-300)", borderRadius: "var(--radius)", cursor: "pointer" }}
            />
          </div>
          <div>
            <label style={{ display: "block", marginBottom: "var(--spacing-xs)", fontWeight: "600", fontSize: "14px" }}>
              Opis (opcjonalnie)
            </label>
            <input 
              name="description" 
              placeholder="Krótki opis tagu" 
              style={{ width: "100%", padding: "var(--spacing-sm)", border: "1px solid var(--gray-300)", borderRadius: "var(--radius)" }}
            />
          </div>
          <button 
            type="submit" 
            className="btn"
            style={{ backgroundColor: "#d81e42", color: "white", padding: "var(--spacing-sm) var(--spacing-md)", height: "40px" }}
          >
            Dodaj tag
          </button>
        </form>
      </div>

      {/* Lista tagów */}
      <div className="card">
        <h2 style={{ marginBottom: "var(--spacing-lg)" }}>Lista tagów</h2>
        
        {error && (
          <div className="card" style={{ 
            marginBottom: "var(--spacing-md)", 
            backgroundColor: "#fff5f5", 
            border: "1px solid var(--danger)",
            color: "var(--danger)",
            padding: "var(--spacing-md)"
          }}>
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: "center", padding: "var(--spacing-2xl)", color: "var(--gray-500)" }}>
            Ładowanie...
          </div>
        ) : tags.length === 0 ? (
          <div style={{ textAlign: "center", padding: "var(--spacing-2xl)", color: "var(--gray-500)" }}>
            Brak tagów. Dodaj pierwszy tag powyżej.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid var(--gray-200)" }}>
                  <th style={{ textAlign: "left", padding: "var(--spacing-md)", fontWeight: "600", minWidth: "80px" }}>Kolor</th>
                  <th style={{ textAlign: "left", padding: "var(--spacing-md)", fontWeight: "600" }}>Nazwa</th>
                  <th style={{ textAlign: "left", padding: "var(--spacing-md)", fontWeight: "600" }}>Opis</th>
                  <th style={{ textAlign: "center", padding: "var(--spacing-md)", fontWeight: "600", minWidth: "120px" }}>Kontakty</th>
                  <th style={{ textAlign: "left", padding: "var(--spacing-md)", fontWeight: "600", minWidth: "120px" }}>Utworzono</th>
                  <th style={{ textAlign: "center", padding: "var(--spacing-md)", fontWeight: "600", minWidth: "100px" }}>Akcje</th>
                </tr>
              </thead>
              <tbody>
                {tags.map((tag) => {
                  // Upewnij się że _count jest poprawnie odczytane
                  const usageCount = (tag as any)._count?.LeadTag ?? 0;
                  const canDelete = usageCount === 0;
                  
                  // Debug log (można usunąć później)
                  if (process.env.NODE_ENV === 'development') {
                    console.log(`Tag ${tag.name}: usageCount=${usageCount}, canDelete=${canDelete}`);
                  }
                  return (
                    <tr key={tag.id} style={{ borderBottom: "1px solid var(--gray-100)" }}>
                      <td style={{ padding: "var(--spacing-md)" }}>
                        <div style={{ 
                          width: "24px", 
                          height: "24px", 
                          backgroundColor: tag.color, 
                          borderRadius: "var(--radius)",
                          display: "inline-block",
                          border: "1px solid var(--gray-300)"
                        }}></div>
                      </td>
                      <td style={{ padding: "var(--spacing-md)", fontWeight: "600" }}>{tag.name}</td>
                      <td style={{ padding: "var(--spacing-md)", color: "var(--gray-600)" }}>{tag.description || "—"}</td>
                      <td style={{ padding: "var(--spacing-md)", textAlign: "center" }}>
                        <span style={{ 
                          display: "inline-block",
                          padding: "4px 12px",
                          backgroundColor: usageCount > 0 ? "#e8f4fd" : "var(--gray-100)",
                          color: usageCount > 0 ? "#0056b3" : "var(--gray-600)",
                          borderRadius: "12px",
                          fontSize: "14px",
                          fontWeight: "600"
                        }}>
                          {usageCount}
                        </span>
                      </td>
                      <td style={{ padding: "var(--spacing-md)", color: "var(--gray-600)", fontSize: "14px" }}>
                        {new Date(tag.createdAt).toLocaleDateString("pl-PL")}
                      </td>
                      <td style={{ padding: "var(--spacing-md)", textAlign: "center" }}>
                        <button
                          onClick={() => handleDelete(tag.id, tag.name, usageCount)}
                          disabled={!canDelete || deletingId === tag.id}
                          className="btn"
                          style={{
                            backgroundColor: canDelete ? "#d81e42" : "var(--gray-400)",
                            color: "white",
                            padding: "6px 12px",
                            fontSize: "13px",
                            cursor: canDelete ? "pointer" : "not-allowed",
                            opacity: deletingId === tag.id ? 0.6 : (canDelete ? 1 : 0.5),
                            border: "none",
                            borderRadius: "var(--radius)",
                            fontWeight: "500"
                          }}
                          title={!canDelete ? `Tag jest używany przez ${usageCount} ${usageCount === 1 ? 'leada' : 'leadów'}. Najpierw usuń tag z leadów.` : "Kliknij aby usunąć tag"}
                        >
                          {deletingId === tag.id ? "Usuwanie..." : "Usuń"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
