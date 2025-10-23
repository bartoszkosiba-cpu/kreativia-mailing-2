"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface ProductGroup {
  id: number;
  name: string;
  description: string | null;
  iconEmoji: string | null;
  targetAudience: string | null;
  markets: string | null;
  isActive: boolean;
  _count: {
    savedContents: number;
    campaignThemes: number;
  };
}

export default function ContentPlannerPage() {
  const router = useRouter();
  const [groups, setGroups] = useState<ProductGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    targetAudience: "",
    markets: "PL",
    iconEmoji: "📦"
  });

  useEffect(() => {
    fetchGroups();
  }, []);

  const fetchGroups = async () => {
    try {
      const res = await fetch("/api/content-planner/groups");
      if (res.ok) {
        const data = await res.json();
        setGroups(data);
      }
    } catch (error) {
      console.error("Błąd pobierania grup:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const res = await fetch("/api/content-planner/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });

      if (res.ok) {
        alert("✅ Grupa utworzona!");
        setShowForm(false);
        setFormData({ name: "", description: "", targetAudience: "", markets: "PL", iconEmoji: "📦" });
        fetchGroups();
      } else {
        const data = await res.json();
        alert(`❌ Błąd: ${data.error}`);
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
      <div className="flex-between" style={{ marginBottom: "var(--spacing-lg)" }}>
        <div>
          <h1>Planer treści kampanii</h1>
          <p style={{ color: "var(--gray-600)" }}>
            AI Content Assistant - twórz skuteczne kampanie z pomocą GPT-4o
          </p>
        </div>
        <div className="flex gap-sm">
          <Link href="/content-planner/settings">
            <button className="btn btn-secondary">
              Ustawienia AI
            </button>
          </Link>
          <button 
            onClick={() => setShowForm(!showForm)}
            className="btn btn-success"
          >
            {showForm ? "Anuluj" : "+ Nowa grupa produktowa"}
          </button>
        </div>
      </div>

      {/* Formularz */}
      {showForm && (
        <div className="card" style={{ padding: 24, marginBottom: 24, backgroundColor: "#f9fafb" }}>
          <h2>Nowa grupa produktowa</h2>
          <form onSubmit={handleSubmit}>
            <div style={{ display: "grid", gap: 16 }}>
              <div style={{ display: "grid", gridTemplateColumns: "3fr 1fr", gap: 12 }}>
                <div>
                  <label>Nazwa grupy *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    placeholder="np. Podwieszenia Targowe, Druk wielkoformatowy"
                    style={{ width: "100%", padding: 8 }}
                  />
                </div>

                <div>
                  <label>Emoji ikona</label>
                  <input
                    type="text"
                    value={formData.iconEmoji}
                    onChange={(e) => setFormData({ ...formData, iconEmoji: e.target.value })}
                    placeholder="📦"
                    style={{ width: "100%", padding: 8, fontSize: 20, textAlign: "center" }}
                  />
                </div>
              </div>

              <div>
                <label>Opis grupy</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Krótki opis grupy produktowej..."
                  rows={2}
                  style={{ width: "100%", padding: 8 }}
                />
              </div>

              <div>
                <label>Docelowa grupa odbiorców</label>
                <input
                  type="text"
                  value={formData.targetAudience}
                  onChange={(e) => setFormData({ ...formData, targetAudience: e.target.value })}
                  placeholder="np. Wykonawcy stoisk, agencje eventowe, sieci retail"
                  style={{ width: "100%", padding: 8 }}
                />
              </div>

              <div>
                <label>Rynki docelowe</label>
                <input
                  type="text"
                  value={formData.markets}
                  onChange={(e) => setFormData({ ...formData, markets: e.target.value })}
                  placeholder="PL,DE,FR"
                  style={{ width: "100%", padding: 8 }}
                />
                <small style={{ color: "#666" }}>Kody krajów oddzielone przecinkiem</small>
              </div>

              <div style={{ display: "flex", gap: 12 }}>
                <button type="submit" className="btn btn-primary">
                  ✅ Utwórz grupę
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

      {/* Lista grup */}
      {groups.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: "center", color: "#666" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📦</div>
          <h3>Brak grup produktowych</h3>
          <p>Zacznij od utworzenia pierwszej grupy (np. "Podwieszenia Targowe")</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 20 }}>
          {groups.map((group) => (
            <Link
              key={group.id}
              href={`/content-planner/groups/${group.id}`}
              style={{ textDecoration: "none", color: "inherit" }}
              >
                <div 
                  className="card"
                  style={{
                    padding: 20,
                    cursor: "pointer",
                    transition: "all 0.2s",
                    borderLeft: "4px solid var(--color-primary)",
                    height: "100%"
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-4px)";
                    e.currentTarget.style.boxShadow = "0 8px 16px rgba(0,0,0,0.1)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  <h3 style={{ margin: "0 0 8px 0", fontSize: 18, fontWeight: 600 }}>
                    {group.name}
                  </h3>
                  
                  {group.description && (
                    <p style={{ 
                      fontSize: 14, 
                      color: "#666", 
                      marginBottom: 12, 
                      lineHeight: 1.5,
                      overflow: "hidden",
                      display: "-webkit-box",
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: "vertical"
                    }}>
                      {group.description}
                    </p>
                  )}

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12, paddingTop: 12, borderTop: "1px solid #eee" }}>
                    <div style={{ fontSize: 12, color: "#666" }}>
                      {group._count.savedContents} treści
                    </div>
                    <div style={{ fontSize: 12, color: "var(--color-primary)", fontWeight: 600 }}>
                      Otwórz →
                    </div>
                  </div>
                </div>
            </Link>
          ))}
        </div>
      )}

      {/* Info box */}
      <div className="alert alert-info" style={{ marginTop: 32 }}>
        <strong>Jak to działa?</strong>
        <ol style={{ marginTop: 8, paddingLeft: 20 }}>
          <li>Utwórz <strong>grupę produktową</strong> (np. "Podwieszenia Targowe")</li>
          <li><strong>Rozmawiaj z AI</strong> o produkcie - AI pamięta całą rozmowę</li>
          <li><strong>Zapisuj treści</strong> które Ci się podobają</li>
          <li><strong>Edytuj</strong> przed użyciem w kampanii</li>
          <li><strong>Używaj wielokrotnie</strong> - jedna treść w wielu kampaniach</li>
        </ol>
        <div style={{ marginTop: 12, padding: 12, backgroundColor: "#e0f2fe", borderRadius: 6 }}>
          <strong>AI Engine: GPT-4o</strong> - najlepszy model dla polskiego content marketingu B2B
        </div>
      </div>
    </main>
  );
}

