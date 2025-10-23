"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

interface Mailbox {
  id: number;
  email: string;
  displayName: string | null;
  description: string | null;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpSecure: boolean;
  imapHost: string;
  imapPort: number;
  imapUser: string;
  imapSecure: boolean;
  dailyEmailLimit: number;
  currentDailySent: number;
  totalEmailsSent: number;
  isActive: boolean;
  priority: number;
  lastUsedAt: string | null;
  verificationStatus?: string;
  mailboxType: string;
  warmupStatus: string;
  warmupDay: number;
  verificationError?: string | null;
  verificationDate?: string | null;
}

interface Salesperson {
  id: number;
  name: string;
  email: string;
}

export default function MailboxesPage() {
  const params = useParams();
  const router = useRouter();
  const salespersonId = Number(params.id);

  const [salesperson, setSalesperson] = useState<Salesperson | null>(null);
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    email: "",
    displayName: "",
    description: "",
    smtpHost: "",
    smtpPort: 587,
    smtpUser: "",
    smtpPass: "",
    smtpSecure: false,
    imapHost: "",
    imapPort: 993,
    imapUser: "",
    imapPass: "",
    imapSecure: true,
    dailyEmailLimit: 50,
    priority: 999,
    isActive: true,
    mailboxType: "new" // new | warmed_up
  });

  useEffect(() => {
    fetchData();
  }, [salespersonId]);

  const fetchData = async () => {
    try {
      // Pobierz dane handlowca
      const spRes = await fetch(`/api/salespeople/${salespersonId}`);
      if (spRes.ok) {
        const spData = await spRes.json();
        setSalesperson(spData);
      }

      // Pobierz skrzynki
      const mbRes = await fetch(`/api/salespeople/${salespersonId}/mailboxes`);
      if (mbRes.ok) {
        const mbData = await mbRes.json();
        setMailboxes(mbData);
      }
    } catch (error) {
      console.error("Błąd pobierania danych:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setIsSubmitting(true);

    // WALIDACJA - wszystkie pola wymagane
    const requiredFields: Record<string, string> = {
      email: 'Email',
      smtpHost: 'Host SMTP',
      smtpUser: 'Login SMTP',
      imapHost: 'Host IMAP',
      imapUser: 'Login IMAP'
    };

    // Hasła wymagane tylko przy DODAWANIU (nie przy edycji)
    if (!editingId) {
      requiredFields.smtpPass = 'Hasło SMTP';
      requiredFields.imapPass = 'Hasło IMAP';
    }

    for (const [field, label] of Object.entries(requiredFields)) {
      if (!formData[field as keyof typeof formData]) {
        alert(`Pole "${label}" jest wymagane!`);
        setIsSubmitting(false);
        return;
      }
    }

    // Walidacja formatu email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      alert('Nieprawidłowy format adresu email!');
      setIsSubmitting(false);
      return;
    }

    try {
      const url = editingId 
        ? `/api/salespeople/${salespersonId}/mailboxes/${editingId}`
        : `/api/salespeople/${salespersonId}/mailboxes`;
      
      const method = editingId ? "PUT" : "POST";

      // Wyczyść białe znaki (trim) ze wszystkich pól tekstowych
      const cleanedData = {
        ...formData,
        email: formData.email.trim(),
        displayName: formData.displayName.trim(),
        description: formData.description.trim(),
        smtpHost: formData.smtpHost.trim(),
        smtpUser: formData.smtpUser.trim(),
        smtpPass: formData.smtpPass.trim(),
        imapHost: formData.imapHost.trim(),
        imapUser: formData.imapUser.trim(),
        imapPass: formData.imapPass.trim()
      };

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cleanedData)
      });

      if (response.ok) {
        const savedMailbox = await response.json();
        const mailboxId = savedMailbox.id;
        
        // Pokaż komunikat o weryfikacji
        alert(`Skrzynka zapisana!\n\nRozpoczynam weryfikację połączenia...\nTo może potrwać do 30 sekund.`);
        
        // Uruchom weryfikację w tle
        try {
          const verifyResponse = await fetch('/api/mailboxes/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mailboxId })
          });
          
          const verifyResult = await verifyResponse.json();
          
          if (verifyResult.success) {
            alert(`Weryfikacja zakończona pomyślnie!\n\nSkrzynka ${formData.email} działa prawidłowo.`);
          } else {
            const errors = verifyResult.data?.errors || ['Nieznany błąd'];
            alert(`Weryfikacja nie powiodła się!\n\nBłędy:\n${errors.join('\n')}\n\nSprawdź dane logowania SMTP/IMAP.`);
          }
        } catch (verifyError) {
          alert(`Nie udało się zweryfikować skrzynki.\nMożesz spróbować ponownie później.`);
        }
        
        setShowForm(false);
        setEditingId(null);
        resetForm();
        fetchData();
      } else {
        const data = await response.json();
        alert(`Błąd: ${data.error}`);
      }
    } catch (error) {
      alert(`Błąd: ${error}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (mailbox: Mailbox) => {
    setFormData({
      email: mailbox.email,
      displayName: mailbox.displayName || "",
      description: mailbox.description || "",
      smtpHost: mailbox.smtpHost,
      smtpPort: mailbox.smtpPort,
      smtpUser: mailbox.smtpUser,
      smtpPass: "", // Nie pokazuj hasła (zostaw puste - użytkownik może je zmienić)
      smtpSecure: mailbox.smtpSecure,
      imapHost: mailbox.imapHost,
      imapPort: mailbox.imapPort,
      imapUser: mailbox.imapUser,
      imapPass: "", // Nie pokazuj hasła (zostaw puste - użytkownik może je zmienić)
      imapSecure: mailbox.imapSecure,
      dailyEmailLimit: mailbox.dailyEmailLimit,
      priority: mailbox.priority,
      isActive: mailbox.isActive,
      mailboxType: mailbox.mailboxType || "new"
    });
    setEditingId(mailbox.id);
    setShowForm(true);
  };

  const handleDelete = async (mailboxId: number) => {
    if (!confirm("Czy na pewno chcesz usunąć tę skrzynkę?")) return;

    try {
      const response = await fetch(`/api/salespeople/${salespersonId}/mailboxes/${mailboxId}`, {
        method: "DELETE"
      });

      if (response.ok) {
        alert("Skrzynka usunięta!");
        fetchData();
      } else {
        alert("Błąd usuwania skrzynki");
      }
    } catch (error) {
      alert(`Błąd: ${error}`);
    }
  };

  const handleToggleActive = async (mailboxId: number, currentStatus: boolean) => {
    try {
      const response = await fetch(`/api/salespeople/${salespersonId}/mailboxes/${mailboxId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !currentStatus })
      });

      if (response.ok) {
        fetchData();
      } else {
        alert("Błąd zmiany statusu");
      }
    } catch (error) {
      alert(`Błąd: ${error}`);
    }
  };

  const resetForm = () => {
    // Znajdź najwyższy używany priorytet (pomiń 999)
    const usedPriorities = mailboxes
      .filter(mb => mb.priority < 999)
      .map(mb => mb.priority);
    const maxPriority = usedPriorities.length > 0 ? Math.max(...usedPriorities) : 0;
    const nextPriority = maxPriority + 1;
    
    // Jeśli istnieje pierwsza skrzynka, skopiuj jej ustawienia jako template
    const templateMailbox = mailboxes[0];
    
    if (templateMailbox) {
      setFormData({
        email: "",
        displayName: "",
        description: "",
        smtpHost: templateMailbox.smtpHost,
        smtpPort: templateMailbox.smtpPort,
        smtpUser: "",
        smtpPass: "",
        smtpSecure: false, // Domyślnie STARTTLS dla SMTP
        imapHost: templateMailbox.smtpHost, // Zwykle ten sam host
        imapPort: 993,
        imapUser: "",
        imapPass: "",
        imapSecure: true, // Domyślnie SSL dla IMAP
        dailyEmailLimit: templateMailbox.dailyEmailLimit,
        priority: nextPriority, // Następny wolny priorytet
        isActive: true,
        mailboxType: "new"
      });
    } else {
      // Brak skrzynek - użyj domyślnych wartości
      setFormData({
        email: "",
        displayName: "",
        description: "",
        smtpHost: "bartgrafic.home.pl", // Domyślny host
        smtpPort: 587,
        smtpUser: "",
        smtpPass: "",
        smtpSecure: false,
        imapHost: "bartgrafic.home.pl", // Domyślny host
        imapPort: 993,
        imapUser: "",
        imapPass: "",
        imapSecure: true,
        dailyEmailLimit: 150,
        priority: 1,
        isActive: true,
        mailboxType: "new"
      });
    }
  };

  if (isLoading) {
    return <main className="container" style={{ paddingTop: "var(--spacing-xl)" }}>Ładowanie...</main>;
  }

  const totalDailyLimit = mailboxes.reduce((sum, mb) => sum + (mb.isActive ? mb.dailyEmailLimit : 0), 0);
  const totalSentToday = mailboxes.reduce((sum, mb) => sum + mb.currentDailySent, 0);
  const totalSentAll = mailboxes.reduce((sum, mb) => sum + mb.totalEmailsSent, 0);
  const remainingToday = totalDailyLimit - totalSentToday;

  return (
    <main className="container" style={{ paddingTop: "var(--spacing-xl)", paddingBottom: "var(--spacing-2xl)" }}>
      <div style={{ marginBottom: 20 }}>
        <Link href="/salespeople">← Wróć do handlowców</Link>
      </div>

      <h1>Skrzynki mailowe: {salesperson?.name}</h1>
      
      {/* Statystyki */}
      <div style={{ 
        display: "grid", 
        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", 
        gap: 16, 
        marginBottom: 24 
      }}>
        <div className="card" style={{ padding: 16, backgroundColor: "#f0f9ff", borderLeft: "4px solid #3b82f6" }}>
          <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>Aktywne skrzynki</div>
          <div style={{ fontSize: 24, fontWeight: "bold", color: "#3b82f6" }}>
            {mailboxes.filter(m => m.isActive).length} / {mailboxes.length}
          </div>
        </div>

        <div className="card" style={{ padding: 16, backgroundColor: "#f0fdf4", borderLeft: "4px solid #22c55e" }}>
          <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>Limit dzienny (łącznie)</div>
          <div style={{ fontSize: 24, fontWeight: "bold", color: "#22c55e" }}>
            {totalDailyLimit} maili
          </div>
        </div>

        <div className="card" style={{ padding: 16, backgroundColor: "#fefce8", borderLeft: "4px solid #eab308" }}>
          <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>Wysłano dzisiaj</div>
          <div style={{ fontSize: 24, fontWeight: "bold", color: "#eab308" }}>
            {totalSentToday} / {totalDailyLimit}
          </div>
        </div>

        <div className="card" style={{ padding: 16, backgroundColor: "#faf5ff", borderLeft: "4px solid #a855f7" }}>
          <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>Pozostało dziś</div>
          <div style={{ fontSize: 24, fontWeight: "bold", color: "#a855f7" }}>
            {remainingToday} maili
          </div>
        </div>

        <div className="card" style={{ padding: 16, backgroundColor: "#f5f5f5", borderLeft: "4px solid #6b7280" }}>
          <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>Wysłano ogółem</div>
          <div style={{ fontSize: 24, fontWeight: "bold", color: "#6b7280" }}>
            {totalSentAll}
          </div>
        </div>
      </div>

      {/* Przycisk dodaj nową skrzynkę */}
      <div style={{ marginBottom: 20 }}>
        <button 
          onClick={() => {
            resetForm();
            setEditingId(null);
            setShowForm(!showForm);
          }}
          className="btn btn-success"
        >
          {showForm ? "Anuluj" : "Dodaj nową skrzynkę"}
        </button>
      </div>

      {/* Formularz */}
      {showForm && (
        <div className="card" style={{ padding: 24, marginBottom: 24, backgroundColor: "#f9fafb" }}>
          <h2>{editingId ? "Edytuj skrzynkę" : "Nowa skrzynka mailowa"}</h2>
          
          <form onSubmit={handleSubmit}>
            <div style={{ display: "grid", gap: 16 }}>
              {/* Podstawowe dane */}
              <div>
                <h3>Podstawowe dane</h3>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label>Email skrzynki *</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                      placeholder="marta.zolkowska@firma.pl"
                      style={{ width: "100%", padding: 8 }}
                    />
                  </div>

                  <div>
                    <label>Nazwa wyświetlana</label>
                    <input
                      type="text"
                      value={formData.displayName}
                      onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                      placeholder={salesperson?.name || "Marta Żółkowska"}
                      style={{ width: "100%", padding: 8 }}
                    />
                    <small style={{ color: "#666" }}>Opcjonalne - domyślnie używa imienia handlowca</small>
                  </div>

                  <div style={{ gridColumn: "1 / -1" }}>
                    <label>Opis skrzynki</label>
                    <input
                      type="text"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Skrzynka główna / Backup / ..."
                      style={{ width: "100%", padding: 8 }}
                    />
                  </div>

                  <div style={{ gridColumn: "1 / -1" }}>
                    <label>Typ skrzynki *</label>
                    <select
                      value={formData.mailboxType}
                      onChange={(e) => setFormData({ ...formData, mailboxType: e.target.value })}
                      style={{ width: "100%", padding: 8 }}
                    >
                      <option value="new">🆕 Nowa skrzynka (wymaga warmup)</option>
                      <option value="warmed_up">✅ Stara skrzynka (już rozgrzana)</option>
                    </select>
                    <small style={{ color: "#666" }}>
                      {formData.mailboxType === 'new' 
                        ? 'Skrzynka będzie automatycznie rozgrzewana po weryfikacji' 
                        : 'Skrzynka jest już gotowa do wysyłania bez warmup'
                      }
                    </small>
                  </div>
                </div>
              </div>

              {/* SMTP */}
              <div>
                <h3>Ustawienia SMTP (wysyłka)</h3>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 12 }}>
                  <div>
                    <label>Host SMTP *</label>
                    <input
                      type="text"
                      value={formData.smtpHost}
                      onChange={(e) => setFormData({ ...formData, smtpHost: e.target.value })}
                      required
                      placeholder="smtp.gmail.com"
                      style={{ width: "100%", padding: 8 }}
                    />
                  </div>

                  <div>
                    <label>Port SMTP *</label>
                    <input
                      type="number"
                      value={formData.smtpPort}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === '') {
                          setFormData({ ...formData, smtpPort: 0 });
                        } else {
                          const numValue = Number(value);
                          if (!isNaN(numValue)) {
                            setFormData({ ...formData, smtpPort: numValue });
                          }
                        }
                      }}
                      required
                      placeholder="587"
                      style={{ width: "100%", padding: 8 }}
                    />
                  </div>

                  <div style={{ display: "flex", alignItems: "center", marginTop: 24 }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <input
                        type="checkbox"
                        checked={formData.smtpSecure}
                        onChange={(e) => setFormData({ ...formData, smtpSecure: e.target.checked })}
                      />
                      SSL/TLS
                    </label>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
                  <div>
                    <label>Użytkownik SMTP *</label>
                    <input
                      type="text"
                      value={formData.smtpUser}
                      onChange={(e) => setFormData({ ...formData, smtpUser: e.target.value })}
                      required
                      placeholder="login@firma.pl"
                      style={{ width: "100%", padding: 8 }}
                    />
                  </div>

                  <div>
                    <label>Hasło SMTP {editingId ? '(pozostaw puste aby nie zmieniać)' : '*'}</label>
                    <input
                      type="password"
                      value={formData.smtpPass}
                      onChange={(e) => setFormData({ ...formData, smtpPass: e.target.value })}
                      placeholder={editingId ? "****** (zachowane - zostaw puste aby nie zmieniać)" : "Hasło SMTP"}
                      required={!editingId}
                      style={{ width: "100%", padding: 8 }}
                    />
                  </div>
                </div>
              </div>

              {/* IMAP */}
              <div>
                <h3>Ustawienia IMAP (odbieranie)</h3>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 12 }}>
                  <div>
                    <label>Host IMAP *</label>
                    <input
                      type="text"
                      value={formData.imapHost}
                      onChange={(e) => setFormData({ ...formData, imapHost: e.target.value })}
                      required
                      placeholder="imap.gmail.com"
                      style={{ width: "100%", padding: 8 }}
                    />
                  </div>

                  <div>
                    <label>Port IMAP *</label>
                    <input
                      type="number"
                      value={formData.imapPort}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === '') {
                          setFormData({ ...formData, imapPort: 0 });
                        } else {
                          const numValue = Number(value);
                          if (!isNaN(numValue)) {
                            setFormData({ ...formData, imapPort: numValue });
                          }
                        }
                      }}
                      required
                      placeholder="993"
                      style={{ width: "100%", padding: 8 }}
                    />
                  </div>

                  <div style={{ display: "flex", alignItems: "center", marginTop: 24 }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <input
                        type="checkbox"
                        checked={formData.imapSecure}
                        onChange={(e) => setFormData({ ...formData, imapSecure: e.target.checked })}
                      />
                      SSL/TLS
                    </label>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
                  <div>
                    <label>Użytkownik IMAP *</label>
                    <input
                      type="text"
                      value={formData.imapUser}
                      onChange={(e) => setFormData({ ...formData, imapUser: e.target.value })}
                      required
                      placeholder="login@firma.pl"
                      style={{ width: "100%", padding: 8 }}
                    />
                  </div>

                  <div>
                    <label>Hasło IMAP {editingId ? '(pozostaw puste aby nie zmieniać)' : '*'}</label>
                    <input
                      type="password"
                      value={formData.imapPass}
                      onChange={(e) => setFormData({ ...formData, imapPass: e.target.value })}
                      placeholder={editingId ? "****** (zachowane - zostaw puste aby nie zmieniać)" : "Hasło IMAP"}
                      required={!editingId}
                      style={{ width: "100%", padding: 8 }}
                    />
                  </div>
                </div>
              </div>

              {/* Limity i priorytet */}
              <div>
                <h3>Ustawienia wysyłki</h3>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                  <div>
                    <label>Limit dzienny *</label>
                    <input
                      type="number"
                      value={formData.dailyEmailLimit}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === '') {
                          setFormData({ ...formData, dailyEmailLimit: 0 });
                        } else {
                          const numValue = Number(value);
                          if (!isNaN(numValue)) {
                            setFormData({ ...formData, dailyEmailLimit: numValue });
                          }
                        }
                      }}
                      required
                      min={5}
                      max={150}
                      placeholder="50"
                      style={{ width: "100%", padding: 8 }}
                    />
                    <small style={{ color: "#666" }}>Maili dziennie (zalecane: 20-50)</small>
                  </div>

                  <div>
                    <label>Priorytet</label>
                    <input
                      type="number"
                      value={formData.priority}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === '') {
                          setFormData({ ...formData, priority: 0 });
                        } else {
                          const numValue = Number(value);
                          if (!isNaN(numValue)) {
                            setFormData({ ...formData, priority: numValue });
                          }
                        }
                      }}
                      min={1}
                      max={999}
                      placeholder="999"
                      style={{ width: "100%", padding: 8 }}
                    />
                    <small style={{ color: "#666" }}>Im niższa liczba, tym wyższy priorytet</small>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", marginTop: 24 }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <input
                        type="checkbox"
                        checked={formData.isActive}
                        onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                      />
                      Aktywna
                    </label>
                  </div>
                </div>
              </div>

              {/* Przyciski */}
              <div style={{ display: "flex", gap: 12 }}>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={isSubmitting}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    opacity: isSubmitting ? 0.7 : 1,
                    cursor: isSubmitting ? "not-allowed" : "pointer"
                  }}
                >
                  {isSubmitting && (
                    <span style={{
                      display: "inline-block",
                      width: "16px",
                      height: "16px",
                      border: "2px solid white",
                      borderTop: "2px solid transparent",
                      borderRadius: "50%",
                      animation: "spin 1s linear infinite"
                    }}></span>
                  )}
                  {isSubmitting 
                    ? (editingId ? "Zapisywanie..." : "Dodawanie...") 
                    : (editingId ? "Zapisz zmiany" : "Dodaj skrzynkę")
                  }
                </button>
                <button 
                  type="button" 
                  onClick={() => {
                    setShowForm(false);
                    setEditingId(null);
                    resetForm();
                  }}
                  className="btn btn-secondary"
                >
                  Anuluj
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Tabela skrzynek */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {mailboxes.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "#666" }}>
            Brak skrzynek mailowych. Dodaj pierwszą skrzynkę aby móc wysyłać kampanie.
          </div>
        ) : (
          <div>
            {/* Objaśnienia kolumn */}
            <div style={{ 
              background: '#f8fafc', 
              border: '1px solid #e2e8f0', 
              borderRadius: '8px', 
              padding: '16px', 
              marginBottom: '16px',
              fontSize: '13px',
              color: '#64748b'
            }}>
              <h4 style={{ margin: '0 0 12px 0', color: '#374151', fontSize: '14px' }}>📋 Objaśnienia kolumn:</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '12px' }}>
                <div>
                  <strong>✅ Weryfikacja:</strong> Status połączenia SMTP/IMAP
                </div>
                <div>
                  <strong>🎯 Dostępność:</strong> Czy skrzynka jest aktywna do wysyłania
                </div>
                <div>
                  <strong>🔥 Warmup:</strong> Status rozgrzewania skrzynki
                </div>
              </div>
            </div>
            
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead style={{ backgroundColor: "#f9fafb", borderBottom: "2px solid #e5e7eb" }}>
              <tr>
                <th style={{ padding: 12, textAlign: "left" }}>Email skrzynki</th>
                <th style={{ padding: 12, textAlign: "center" }}>Limit dzienny</th>
                <th style={{ padding: 12, textAlign: "center" }}>Wysłano dzisiaj</th>
                <th style={{ padding: 12, textAlign: "center" }}>Wysłano ogółem</th>
                <th style={{ padding: 12, textAlign: "center" }}>Priorytet</th>
                <th style={{ padding: 12, textAlign: "center" }}>Weryfikacja</th>
                <th style={{ padding: 12, textAlign: "center" }}>Dostępność</th>
                <th style={{ padding: 12, textAlign: "center" }}>Warmup</th>
                <th style={{ padding: 12, textAlign: "center" }}>Akcje</th>
              </tr>
            </thead>
            <tbody>
              {mailboxes
                .sort((a, b) => a.priority - b.priority)
                .map((mailbox) => {
                  const remaining = mailbox.dailyEmailLimit - mailbox.currentDailySent;
                  const percentUsed = Math.round((mailbox.currentDailySent / mailbox.dailyEmailLimit) * 100);
                  
                  return (
                    <tr key={mailbox.id} style={{ borderBottom: "1px solid #e5e7eb" }}>
                      <td style={{ padding: 12 }}>
                        <div style={{ fontWeight: "600" }}>{mailbox.email}</div>
                        {mailbox.displayName && (
                          <div style={{ fontSize: 12, color: "#666" }}>{mailbox.displayName}</div>
                        )}
                        {/* Sprawdź czy to główna skrzynka */}
                        {salesperson?.email === mailbox.email && (
                          <div style={{ fontSize: 11, color: "#059669", marginTop: 2, fontWeight: "600" }}>
                            🎯 Główna skrzynka
                          </div>
                        )}
                        {/* Pokaż description tylko jeśli to nie jest główna skrzynka */}
                        {mailbox.description && salesperson?.email !== mailbox.email && (
                          <div style={{ fontSize: 11, color: "#999", marginTop: 2 }}>{mailbox.description}</div>
                        )}
                      </td>
                      <td style={{ padding: 12, textAlign: "center", fontWeight: "600" }}>
                        {mailbox.dailyEmailLimit}
                      </td>
                      <td style={{ padding: 12, textAlign: "center" }}>
                        <div style={{ fontWeight: "600", color: percentUsed >= 90 ? "#dc2626" : percentUsed >= 70 ? "#f59e0b" : "#22c55e" }}>
                          {mailbox.currentDailySent}
                        </div>
                        <div style={{ fontSize: 11, color: "#666" }}>
                          {percentUsed}% użyte
                        </div>
                        <div style={{ fontSize: 11, color: "#10b981" }}>
                          ↓ {remaining} wolne
                        </div>
                      </td>
                      <td style={{ padding: 12, textAlign: "center", fontWeight: "600", color: "#6b7280" }}>
                        {mailbox.totalEmailsSent.toLocaleString()}
                      </td>
                      <td style={{ padding: 12, textAlign: "center" }}>
                        <span style={{
                          padding: "4px 8px",
                          borderRadius: 4,
                          fontSize: 12,
                          fontWeight: "600",
                          backgroundColor: mailbox.priority === 1 ? "#dbeafe" : "#f3f4f6",
                          color: mailbox.priority === 1 ? "#1e40af" : "#6b7280"
                        }}>
                          {mailbox.priority}
                        </span>
                      </td>
                      <td style={{ padding: 12, textAlign: "center" }}>
                        {mailbox.verificationStatus === 'verified' ? (
                          <span style={{
                            padding: "6px 12px",
                            borderRadius: 4,
                            fontSize: 12,
                            fontWeight: "600",
                            backgroundColor: "#dcfce7",
                            color: "#166534",
                            display: "inline-block"
                          }}>
                            Zweryfikowana
                          </span>
                        ) : mailbox.verificationStatus === 'failed' ? (
                          <div style={{ textAlign: "center" }}>
                            <span style={{
                              padding: "6px 12px",
                              borderRadius: 4,
                              fontSize: 12,
                              fontWeight: "600",
                              backgroundColor: "#fee2e2",
                              color: "#991b1b",
                              display: "inline-block"
                            }}>
                              Błąd
                            </span>
                            {mailbox.verificationError && (
                              <div style={{ fontSize: 10, color: "#dc2626", marginTop: 4 }}>
                                {mailbox.verificationError.substring(0, 50)}...
                              </div>
                            )}
                          </div>
                        ) : mailbox.verificationStatus === 'verifying' ? (
                          <span style={{
                            padding: "6px 12px",
                            borderRadius: 4,
                            fontSize: 12,
                            fontWeight: "600",
                            backgroundColor: "#fef3c7",
                            color: "#92400e",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px"
                          }}>
                            <span style={{
                              display: "inline-block",
                              width: "12px",
                              height: "12px",
                              border: "2px solid #92400e",
                              borderTop: "2px solid transparent",
                              borderRadius: "50%",
                              animation: "spin 1s linear infinite"
                            }}></span>
                            Sprawdzam...
                          </span>
                        ) : (
                          <span style={{
                            padding: "6px 12px",
                            borderRadius: 4,
                            fontSize: 12,
                            fontWeight: "600",
                            backgroundColor: "#f3f4f6",
                            color: "#6b7280",
                            display: "inline-block"
                          }}>
                            Nie sprawdzono
                          </span>
                        )}
                      </td>
                      <td style={{ padding: 12, textAlign: "center" }}>
                        <button
                          onClick={() => handleToggleActive(mailbox.id, mailbox.isActive)}
                          disabled={mailbox.verificationStatus !== 'verified'}
                          style={{
                            padding: "4px 12px",
                            borderRadius: 4,
                            border: "none",
                            fontSize: 12,
                            fontWeight: "600",
                            cursor: mailbox.verificationStatus === 'verified' ? "pointer" : "not-allowed",
                            backgroundColor: mailbox.isActive ? "#22c55e" : "#dc2626",
                            color: "white",
                            opacity: mailbox.verificationStatus !== 'verified' ? 0.5 : 1
                          }}
                          title={mailbox.verificationStatus !== 'verified' ? 'Skrzynka musi przejść weryfikację aby mogła być aktywna' : ''}
                        >
                          {mailbox.isActive ? "✅ Dostępna" : "❌ Zablokowana"}
                        </button>
                      </td>
                      <td style={{ padding: 12, textAlign: "center" }}>
                        <div style={{ fontSize: 11, color: "#666" }}>
                          {mailbox.mailboxType === 'warmed_up' ? '✅ Gotowa (istniejąca)' : 
                           mailbox.warmupStatus === 'warming' ? '🔥 Rozgrzewana' : 
                           (mailbox.warmupStatus === 'ready' && mailbox.warmupDay > 0) ? '✅ Rozgrzana' :
                           '⏸️ Nowa'}
                        </div>
                      </td>
                      <td style={{ padding: 12, textAlign: "center" }}>
                        <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                          <button
                            onClick={() => handleEdit(mailbox)}
                            className="btn btn-sm btn-secondary"
                          >
                            Edytuj
                          </button>
                          <button
                            onClick={() => handleDelete(mailbox.id)}
                            className="btn btn-sm btn-danger"
                          >
                            Usuń
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {/* Info box */}
      <div className="alert alert-info" style={{ marginTop: 24 }}>
        <strong>Wskazówka:</strong> Dodanie wielu skrzynek mailowych pozwala na szybszą wysyłkę kampanii. 
        Przykład: 5 skrzynek × 50 maili/dzień = 250 maili dziennie!
        <br/><br/>
        <strong>Ważne:</strong> Każda skrzynka powinna wysyłać max 20-50 maili dziennie, aby uniknąć filtrów antyspamowych.
      </div>
    </main>
  );
}

