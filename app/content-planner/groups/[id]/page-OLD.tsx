"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

interface ProductGroup {
  id: number;
  name: string;
  description: string | null;
  iconEmoji: string | null;
  targetAudience: string | null;
  markets: string | null;
  campaignThemes: CampaignTheme[];
}

interface CampaignTheme {
  id: number;
  name: string;
  description: string | null;
  status: string;
  briefingProgress: number;
  _count: {
    versions: number;
  };
  updatedAt: string;
}

export default function ProductGroupPage() {
  const params = useParams();
  const router = useRouter();
  const groupId = Number(params.id);

  const [group, setGroup] = useState<ProductGroup | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: ""
  });

  useEffect(() => {
    fetchGroup();
  }, [groupId]);

  const fetchGroup = async () => {
    try {
      const res = await fetch(`/api/content-planner/groups/${groupId}`);
      if (res.ok) {
        const data = await res.json();
        setGroup(data);
      }
    } catch (error) {
      console.error("Błąd pobierania grupy:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateTheme = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const res = await fetch("/api/content-planner/themes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productGroupId: groupId,
          ...formData
        })
      });

      if (res.ok) {
        const data = await res.json();
        alert(`✅ Temat utworzony! AI czeka na Ciebie...`);
        // Przekieruj do chatu z AI
        router.push(`/content-planner/themes/${data.theme.id}`);
      } else {
        const data = await res.json();
        alert(`❌ Błąd: ${data.error}`);
      }
    } catch (error) {
      alert(`❌ Błąd: ${error}`);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "draft": return "#9ca3af";
      case "in_briefing": return "#f59e0b";
      case "ready": return "#10b981";
      case "approved": return "#3b82f6";
      case "archived": return "#6b7280";
      default: return "#9ca3af";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "draft": return "Szkic";
      case "in_briefing": return "Briefing w toku";
      case "ready": return "Gotowy do generowania";
      case "approved": return "Zatwierdzony";
      case "archived": return "Zarchiwizowany";
      default: return status;
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
        <Link href="/content-planner">← Wróć do grup produktowych</Link>
      </div>

      {/* Nagłówek grupy */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 12 }}>
          <div style={{ fontSize: 48 }}>{group.iconEmoji || "📦"}</div>
          <div>
            <h1 style={{ margin: 0 }}>{group.name}</h1>
            {group.description && (
              <p style={{ color: "#666", margin: "4px 0 0 0" }}>{group.description}</p>
            )}
          </div>
        </div>

        {group.targetAudience && (
          <div className="alert" style={{ backgroundColor: "#f0f9ff", border: "1px solid #bae6fd", padding: 12, borderRadius: 6 }}>
            <strong>🎯 Docelowa grupa:</strong> {group.targetAudience}
          </div>
        )}
      </div>

      {/* Przycisk nowy temat */}
      <div style={{ marginBottom: 24 }}>
        <button 
          onClick={() => setShowForm(!showForm)}
          className="btn btn-success"
        >
          {showForm ? "❌ Anuluj" : "➕ Nowy temat kampanii"}
        </button>
      </div>

      {/* Formularz nowego tematu */}
      {showForm && (
        <div className="card" style={{ padding: 24, marginBottom: 24, backgroundColor: "#f9fafb" }}>
          <h2>Nowy temat kampanii</h2>
          <p style={{ color: "#666", marginBottom: 16 }}>
            Po utworzeniu tematu AI automatycznie rozpocznie rozmowę i zada pierwsze pytanie briefingowe.
          </p>
          
          <form onSubmit={handleCreateTheme}>
            <div style={{ display: "grid", gap: 16 }}>
              <div>
                <label>Nazwa tematu kampanii *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  placeholder="np. Szybki montaż - 15 minut zamiast 2 godzin"
                  style={{ width: "100%", padding: 8 }}
                />
                <small style={{ color: "#666" }}>
                  Nazwa powinna być konkretna i opisywać główny selling point
                </small>
              </div>

              <div>
                <label>Krótki opis (opcjonalnie)</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Na czym skupia się ta kampania..."
                  rows={2}
                  style={{ width: "100%", padding: 8 }}
                />
              </div>

              <div style={{ display: "flex", gap: 12 }}>
                <button type="submit" className="btn btn-primary">
                  🚀 Utwórz i rozpocznij briefing z AI
                </button>
                <button 
                  type="button" 
                  onClick={() => setShowForm(false)}
                  className="btn btn-secondary"
                >
                  ❌ Anuluj
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Lista tematów */}
      {group.campaignThemes.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: "center", color: "#666" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>💬</div>
          <h3>Brak tematów kampanii</h3>
          <p>Utwórz pierwszy temat i zacznij rozmowę z AI Content Assistant</p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 16 }}>
          {group.campaignThemes.map((theme) => {
            const statusColor = getStatusColor(theme.status);
            
            return (
              <Link
                key={theme.id}
                href={`/content-planner/themes/${theme.id}`}
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <div 
                  className="card"
                  style={{
                    padding: 20,
                    cursor: "pointer",
                    transition: "all 0.2s",
                    borderLeft: `4px solid ${statusColor}`
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateX(4px)";
                    e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "translateX(0)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                    <div style={{ flex: 1 }}>
                      <h3 style={{ margin: "0 0 8px 0", fontSize: 16, fontWeight: 600 }}>
                        {theme.name}
                      </h3>
                      
                      {theme.description && (
                        <p style={{ fontSize: 14, color: "#666", margin: "0 0 12px 0" }}>
                          {theme.description}
                        </p>
                      )}

                      <div style={{ display: "flex", gap: 16, fontSize: 12, color: "#888" }}>
                        <div>
                          📝 {theme._count.versions} wersji
                        </div>
                        <div>
                          📊 Briefing: {theme.briefingProgress}%
                        </div>
                        <div>
                          🕐 {new Date(theme.updatedAt).toLocaleDateString("pl-PL")}
                        </div>
                      </div>
                    </div>

                    <div>
                      <span style={{
                        padding: "6px 12px",
                        borderRadius: 4,
                        fontSize: 12,
                        fontWeight: 600,
                        backgroundColor: statusColor,
                        color: "white"
                      }}>
                        {getStatusLabel(theme.status)}
                      </span>
                    </div>
                  </div>

                  {/* Progress bar */}
                  {theme.briefingProgress > 0 && theme.briefingProgress < 100 && (
                    <div style={{ marginTop: 12, backgroundColor: "#e5e7eb", borderRadius: 4, height: 6, overflow: "hidden" }}>
                      <div style={{
                        width: `${theme.briefingProgress}%`,
                        height: "100%",
                        backgroundColor: "#f59e0b",
                        transition: "width 0.3s"
                      }}/>
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}

