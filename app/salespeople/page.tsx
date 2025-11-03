"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface VirtualSalesperson {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  language: string;
  markets: string | null;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpUser: string | null;
  smtpPass: string | null;
  smtpSecure: boolean;
  imapHost: string | null;
  imapPort: number | null;
  imapUser: string | null;
  imapPass: string | null;
  imapSecure: boolean;
  realSalespersonEmail: string | null;
  realSalespersonName: string | null;
  realSalespersonPhone: string | null;
  realSalespersonSignature: string | null;
  isActive: boolean;
  createdAt: string;
  campaigns: Array<{ id: number; name: string }>;
  mainMailboxId: number | null;
  mainMailbox: {
    id: number;
    email: string;
    isActive: boolean;
  } | null;
  mailboxes: Array<{
    id: number;
    email: string;
    isActive: boolean;
    priority: number;
  }>;
}

export default function SalespeoplePage() {
  const [salespeople, setSalespeople] = useState<VirtualSalesperson[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    language: "pl",
    markets: "",
    realSalespersonEmail: "",
    realSalespersonName: "",
    realSalespersonPhone: "",
    realSalespersonSignature: "",
    isActive: true
  });

  useEffect(() => {
    fetchSalespeople();
  }, []);

  const fetchSalespeople = async () => {
    try {
      const response = await fetch("/api/salespeople");
      if (response.ok) {
        const data = await response.json();
        setSalespeople(data);
      }
    } catch (error) {
      console.error("Błąd pobierania handlowców:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingId ? `/api/salespeople/${editingId}` : "/api/salespeople";
      const method = editingId ? "PUT" : "POST";
      
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        alert(editingId ? "Handlowiec zaktualizowany pomyślnie!" : "Handlowiec dodany pomyślnie!");
        setFormData({
          name: "",
          phone: "",
          language: "pl",
          markets: "",
          realSalespersonEmail: "",
          realSalespersonName: "",
          realSalespersonPhone: "",
          realSalespersonSignature: "",
          isActive: true
        });
        setShowForm(false);
        setEditingId(null);
        fetchSalespeople();
      } else {
        const errorData = await response.json().catch(() => ({ error: "Nieznany błąd" }));
        console.error("Błąd odpowiedzi API:", errorData);
        alert(editingId ? `Błąd aktualizacji handlowca: ${errorData.error || errorData.details || "Nieznany błąd"}` : `Błąd dodawania handlowca: ${errorData.error || errorData.details || "Nieznany błąd"}`);
      }
    } catch (error) {
      alert(editingId ? "Błąd aktualizacji handlowca" : "Błąd dodawania handlowca");
    }
  };

  const handleEdit = (salesperson: VirtualSalesperson) => {
    setFormData({
      name: salesperson.name,
      phone: salesperson.phone || "",
      language: salesperson.language,
      markets: salesperson.markets || "",
      realSalespersonEmail: salesperson.realSalespersonEmail || "",
      realSalespersonName: salesperson.realSalespersonName || "",
      realSalespersonPhone: salesperson.realSalespersonPhone || "",
      realSalespersonSignature: salesperson.realSalespersonSignature || "",
      isActive: salesperson.isActive
    });
    setEditingId(salesperson.id);
    setShowForm(true);
  };

  const handleCancel = () => {
    setFormData({
      name: "",
      phone: "",
      language: "pl",
      markets: "",
      realSalespersonEmail: "",
      realSalespersonName: "",
      realSalespersonPhone: "", // ✅ Dodano
      realSalespersonSignature: "", // ✅ Dodano
      isActive: true
    });
    setEditingId(null);
    setShowForm(false);
  };

  const handleDelete = async (id: number) => {
    const salesperson = salespeople.find(sp => sp.id === id);
    if (!salesperson) return;

    // Pierwsze potwierdzenie
    if (!confirm(`⚠️ UWAGA! Czy na pewno chcesz usunąć handlowca "${salesperson.name}"?\n\nTa operacja jest nieodwracalna!`)) return;

    // Drugie potwierdzenie - wymaga wpisania nazwy
    const confirmName = prompt(
      `Aby potwierdzić usunięcie, wpisz nazwę handlowca:\n"${salesperson.name}"`
    );

    if (confirmName !== salesperson.name) {
      alert("Nazwa nie pasuje. Usunięcie anulowane.");
      return;
    }

    try {
      const response = await fetch(`/api/salespeople/${id}`, {
        method: "DELETE"
      });

      if (response.ok) {
        alert("Handlowiec usunięty pomyślnie!");
        setShowForm(false);
        setEditingId(null);
        fetchSalespeople();
      } else {
        alert("Błąd usuwania handlowca");
      }
    } catch (error) {
      alert("Błąd usuwania handlowca");
    }
  };

  const handleChangeMainMailbox = async (salespersonId: number, mailboxId: number) => {
    try {
      const response = await fetch(`/api/salespeople/${salespersonId}/main-mailbox`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mainMailboxId: mailboxId })
      });

      if (response.ok) {
        alert("Główna skrzynka zmieniona pomyślnie!");
        fetchSalespeople();
      } else {
        const error = await response.json();
        alert(`Błąd zmiany głównej skrzynki: ${error.error}`);
      }
    } catch (error) {
      alert("Błąd zmiany głównej skrzynki");
    }
  };

  if (isLoading) {
    return <main>Ładowanie...</main>;
  }

  return (
    <main className="container" style={{ paddingTop: "var(--spacing-xl)", paddingBottom: "var(--spacing-2xl)" }}>
      <h1>Zarządzanie wirtualnymi handlowcami</h1>
      
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h2>Lista handlowców ({salespeople.length})</h2>
        <button
          onClick={showForm ? handleCancel : () => setShowForm(true)}
          style={{
            padding: "10px 20px",
            backgroundColor: showForm ? "#dc3545" : "#007bff",
            color: "white",
            border: "none",
            borderRadius: 4,
            cursor: "pointer"
          }}
        >
          {showForm ? "Anuluj" : "Dodaj handlowca"}
        </button>
      </div>

      {showForm && (
        <div style={{ backgroundColor: "#f8f9fa", padding: 20, borderRadius: 8, marginBottom: 20 }}>
          <h3>{editingId ? "Edytuj handlowca" : "Dodaj nowego handlowca"}</h3>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontWeight: "bold", marginBottom: 4 }}>
                Imię i nazwisko *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                style={{ width: "100%", padding: 8, border: "1px solid #ccc", borderRadius: 4 }}
                placeholder="Marta Żółkowska"
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontWeight: "bold", marginBottom: 4 }}>
                Telefon
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                style={{ width: "100%", padding: 8, border: "1px solid #ccc", borderRadius: 4 }}
                placeholder="+48 604 753 176"
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              <div>
                <label style={{ display: "block", fontWeight: "bold", marginBottom: 4 }}>
                  Język
                </label>
                <select
                  value={formData.language}
                  onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                  style={{ width: "100%", padding: 8, border: "1px solid #ccc", borderRadius: 4 }}
                >
                  <option value="pl">Polski</option>
                  <option value="en">Angielski</option>
                  <option value="de">Niemiecki</option>
                  <option value="fr">Francuski</option>
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontWeight: "bold", marginBottom: 4 }}>
                  Rynki (oddzielone przecinkami)
                </label>
                <input
                  type="text"
                  value={formData.markets}
                  onChange={(e) => setFormData({ ...formData, markets: e.target.value })}
                  style={{ width: "100%", padding: 8, border: "1px solid #ccc", borderRadius: 4 }}
                  placeholder="Polska, Niemcy, Francja"
                />
              </div>
            </div>
            

            {/* Real Salesperson Settings */}
            <div style={{ marginTop: 24, paddingTop: 24, borderTop: "2px solid #28a745" }}>
              <h3 style={{ marginBottom: 8, color: "#28a745" }}>Prawdziwy handlowiec (do przekazywania leadów)</h3>
              <p style={{ fontSize: 12, color: "#666", marginBottom: 16 }}>
                Gdy lead odpowie "jestem zainteresowany", email zostanie przekazany na podany adres
              </p>
              
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                <div>
                  <label style={{ display: "block", fontWeight: "bold", marginBottom: 4 }}>
                    Email prawdziwego handlowca
                  </label>
                  <input
                    type="email"
                    value={formData.realSalespersonEmail}
                    onChange={(e) => setFormData({ ...formData, realSalespersonEmail: e.target.value })}
                    style={{ width: "100%", padding: 8, border: "1px solid #ccc", borderRadius: 4 }}
                    placeholder="bartosz.kosiba@kreativia.pl"
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontWeight: "bold", marginBottom: 4 }}>
                    Imię i nazwisko prawdziwego handlowca
                  </label>
                  <input
                    type="text"
                    value={formData.realSalespersonName}
                    onChange={(e) => setFormData({ ...formData, realSalespersonName: e.target.value })}
                    style={{ width: "100%", padding: 8, border: "1px solid #ccc", borderRadius: 4 }}
                    placeholder="Bartosz Kosiba"
                  />
                </div>
              </div>
              
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                <div>
                  <label style={{ display: "block", fontWeight: "bold", marginBottom: 4 }}>
                    Telefon prawdziwego handlowca
                  </label>
                  <input
                    type="tel"
                    value={formData.realSalespersonPhone}
                    onChange={(e) => setFormData({ ...formData, realSalespersonPhone: e.target.value })}
                    style={{ width: "100%", padding: 8, border: "1px solid #ccc", borderRadius: 4 }}
                    placeholder="+48 606 452 952"
                  />
                  <p style={{ fontSize: 11, color: "#666", marginTop: 4, marginBottom: 0 }}>
                    Używany w automatycznych odpowiedziach z materiałami
                  </p>
                </div>
                <div>
                  <label style={{ display: "block", fontWeight: "bold", marginBottom: 4 }}>
                    Podpis/Stanowisko (pod nazwiskiem)
                  </label>
                  <input
                    type="text"
                    value={formData.realSalespersonSignature}
                    onChange={(e) => setFormData({ ...formData, realSalespersonSignature: e.target.value })}
                    style={{ width: "100%", padding: 8, border: "1px solid #ccc", borderRadius: 4 }}
                    placeholder="New Business Development"
                  />
                  <p style={{ fontSize: 11, color: "#666", marginTop: 4, marginBottom: 0 }}>
                    Używany w automatycznych odpowiedziach z materiałami
                  </p>
                </div>
              </div>
            </div>

            {/* Główna skrzynka - tylko przy edycji */}
            {editingId && (
              <div style={{ marginTop: 24, paddingTop: 24, borderTop: "2px solid #6c757d" }}>
                <h3 style={{ marginBottom: 8, color: "#0066cc" }}>Główna skrzynka</h3>
                <p style={{ fontSize: 12, color: "#666", marginBottom: 16 }}>
                  Główna skrzynka jest zawsze używana jako pierwsza w round-robin dla kampanii
                </p>
                {salespeople.find(sp => sp.id === editingId)?.mailboxes && 
                 salespeople.find(sp => sp.id === editingId)!.mailboxes!.length > 0 ? (
                  <select
                    value={salespeople.find(sp => sp.id === editingId)?.mainMailboxId || ""}
                    onChange={(e) => handleChangeMainMailbox(editingId, parseInt(e.target.value))}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      border: "1px solid #ccc",
                      borderRadius: 4,
                      fontSize: "14px",
                      backgroundColor: "white"
                    }}
                  >
                    <option value="">Wybierz główną skrzynkę</option>
                    {salespeople.find(sp => sp.id === editingId)!.mailboxes!
                      .filter(mb => mb.isActive)
                      .map(mailbox => (
                        <option key={mailbox.id} value={mailbox.id}>
                          {mailbox.email} {mailbox.id === salespeople.find(sp => sp.id === editingId)?.mainMailboxId ? "(główna)" : ""}
                        </option>
                      ))}
                  </select>
                ) : (
                  <div style={{ 
                    backgroundColor: "#fff3cd", 
                    padding: 12, 
                    borderRadius: 4, 
                    border: "1px solid #ffc107" 
                  }}>
                    <p style={{ margin: 0, fontSize: "14px", color: "#856404" }}>
                      Brak skrzynek. Dodaj skrzynki mailowe przez przycisk "Skrzynki" w tabeli.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Informacja o skrzynkach - tylko przy dodawaniu */}
            {!editingId && (
              <div style={{ marginTop: 24, paddingTop: 24, borderTop: "2px solid #6c757d" }}>
                <div style={{ 
                  backgroundColor: "#e8f4fd", 
                  padding: 16, 
                  borderRadius: 8, 
                  border: "1px solid #b3d9ff" 
                }}>
                  <h4 style={{ margin: "0 0 8px 0", color: "#0066cc" }}>Skrzynki mailowe</h4>
                  <p style={{ margin: 0, fontSize: "14px", color: "#666" }}>
                    Po utworzeniu handlowca, dodaj skrzynki mailowe przez przycisk "Skrzynki" w tabeli.
                    <strong> Ważne:</strong> Ustaw jedną ze skrzynek jako główną - będzie używana w kampaniach i podpisach emaili.
                  </p>
                </div>
              </div>
            )}

            <div style={{ marginTop: 24, paddingTop: 24, borderTop: "1px solid #ddd", marginBottom: 16 }}>
              <label style={{ display: "flex", alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  style={{ marginRight: 8 }}
                />
                Aktywny
              </label>
            </div>

            <div style={{ display: "flex", gap: 12, justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", gap: 12 }}>
                <button
                  type="submit"
                  style={{
                    padding: "10px 20px",
                    backgroundColor: "#28a745",
                    color: "white",
                    border: "none",
                    borderRadius: 4,
                    cursor: "pointer"
                  }}
                >
                  {editingId ? "Zapisz zmiany" : "Dodaj handlowca"}
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  style={{
                    padding: "10px 20px",
                    backgroundColor: "#6c757d",
                    color: "white",
                    border: "none",
                    borderRadius: 4,
                    cursor: "pointer"
                  }}
                >
                  Anuluj
                </button>
              </div>

              {editingId && (
                <button
                  type="button"
                  onClick={() => handleDelete(editingId)}
                  style={{
                    padding: "10px 20px",
                    backgroundColor: "#dc3545",
                    color: "white",
                    border: "none",
                    borderRadius: 4,
                    cursor: "pointer",
                    fontWeight: "bold"
                  }}
                >
                  Usuń handlowca
                </button>
              )}
            </div>
          </form>
        </div>
      )}

      {!showForm && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 16 }}>
          <thead>
                <tr style={{ backgroundColor: "#f5f5f5" }}>
                  <th style={{ padding: 12, textAlign: "left", border: "1px solid #ddd" }}>ID</th>
                  <th style={{ padding: 12, textAlign: "left", border: "1px solid #ddd" }}>Imię i nazwisko</th>
                  <th style={{ padding: 12, textAlign: "left", border: "1px solid #ddd" }}>Email</th>
                  <th style={{ padding: 12, textAlign: "left", border: "1px solid #ddd" }}>Prawdziwy handlowiec</th>
                  <th style={{ padding: 12, textAlign: "left", border: "1px solid #ddd" }}>Telefon</th>
                  <th style={{ padding: 12, textAlign: "left", border: "1px solid #ddd" }}>Język</th>
                  <th style={{ padding: 12, textAlign: "left", border: "1px solid #ddd" }}>Rynki</th>
                  <th style={{ padding: 12, textAlign: "left", border: "1px solid #ddd" }}>Limit/dzień</th>
                  <th style={{ padding: 12, textAlign: "left", border: "1px solid #ddd" }}>Kampanie</th>
                  <th style={{ padding: 12, textAlign: "left", border: "1px solid #ddd" }}>Status</th>
                </tr>
          </thead>
          <tbody>
            {salespeople.map((sp) => (
              <tr key={sp.id}>
                <td style={{ padding: 12, border: "1px solid #ddd" }}>{sp.id}</td>
                <td style={{ padding: 12, border: "1px solid #ddd", fontWeight: "bold" }}>{sp.name}</td>
                <td style={{ padding: 12, border: "1px solid #ddd" }}>
                  {sp.mainMailboxId && sp.mainMailbox ? (
                    <a href={`mailto:${sp.mainMailbox.email}`} style={{ color: "#0066cc" }}>
                      {sp.mainMailbox.email}
                    </a>
                  ) : (
                    <span style={{ color: "#666", fontStyle: "italic" }}>Brak skrzynki</span>
                  )}
                </td>
                <td style={{ padding: 12, border: "1px solid #ddd" }}>
                  {sp.realSalespersonEmail ? (
                    <div>
                      <div style={{ fontWeight: "bold", marginBottom: 2 }}>
                        {sp.realSalespersonName || "Brak nazwy"}
                      </div>
                      <a href={`mailto:${sp.realSalespersonEmail}`} style={{ color: "#0066cc", fontSize: "12px" }}>
                        {sp.realSalespersonEmail}
                      </a>
                    </div>
                  ) : (
                    <span style={{ color: "#666", fontStyle: "italic" }}>Brak</span>
                  )}
                </td>
                <td style={{ padding: 12, border: "1px solid #ddd" }}>
                  {sp.phone ? (
                    <a href={`tel:${sp.phone}`} style={{ color: "#0066cc" }}>
                      {sp.phone}
                    </a>
                  ) : (
                    <span style={{ color: "#666", fontStyle: "italic" }}>-</span>
                  )}
                </td>
                <td style={{ padding: 12, border: "1px solid #ddd" }}>
                  <span style={{
                    backgroundColor: sp.language === 'pl' ? '#e8f4fd' : sp.language === 'en' ? '#fff3cd' : sp.language === 'de' ? '#d1ecf1' : '#f8d7da',
                    padding: "4px 8px",
                    borderRadius: 12,
                    fontSize: "12px"
                  }}>
                    {sp.language.toUpperCase()}
                  </span>
                </td>
                <td style={{ padding: 12, border: "1px solid #ddd" }}>{sp.markets || "-"}</td>
                <td style={{ padding: 12, border: "1px solid #ddd" }}>
                  <span style={{ color: "#666", fontStyle: "italic" }}>W skrzynkach</span>
                </td>
                <td style={{ padding: 12, border: "1px solid #ddd" }}>
                  {sp.campaigns.length > 0 ? (
                    <div>
                      {sp.campaigns.map(campaign => (
                        <div key={campaign.id} style={{ fontSize: "12px", marginBottom: 2 }}>
                          <Link href={`/campaigns/${campaign.id}`} style={{ color: "#0066cc" }}>
                            {campaign.name}
                          </Link>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span style={{ color: "#666", fontStyle: "italic" }}>Brak kampanii</span>
                  )}
                </td>
                <td style={{ padding: 12, border: "1px solid #ddd" }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{
                      backgroundColor: sp.isActive ? "#d4edda" : "#f8d7da",
                      color: sp.isActive ? "#155724" : "#721c24",
                      padding: "4px 8px",
                      borderRadius: 12,
                      fontSize: "12px"
                    }}>
                      {sp.isActive ? "Aktywny" : "Nieaktywny"}
                    </span>
                    <div style={{ display: "flex", gap: 8 }}>
                      <Link 
                        href={`/salespeople/${sp.id}/mailboxes`}
                        style={{
                          padding: "4px 8px",
                          backgroundColor: "#10b981",
                          color: "white",
                          textDecoration: "none",
                          borderRadius: 4,
                          fontSize: "12px",
                          fontWeight: "500"
                        }}
                      >
                        Skrzynki
                      </Link>
                      <button
                        onClick={() => handleEdit(sp)}
                        style={{
                          padding: "4px 8px",
                          backgroundColor: "#007bff",
                          color: "white",
                          border: "none",
                          borderRadius: 4,
                          cursor: "pointer",
                          fontSize: "12px"
                        }}
                      >
                        Edytuj
                      </button>
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          </table>
        </div>
      )}

      {!showForm && salespeople.length === 0 && (
        <div style={{ textAlign: "center", padding: 40, color: "#666" }}>
          <p>Brak handlowców. Dodaj pierwszego handlowca.</p>
        </div>
      )}

      {!showForm && (
        <div style={{ backgroundColor: "#e8f4fd", padding: 16, borderRadius: 8, marginTop: 20 }}>
          <h3>Jak to działa?</h3>
        <ul>
          <li><strong>Wirtualni handlowcy</strong> - to fikcyjne osoby, które będą wysyłać maile</li>
          <li><strong>Tytuł</strong> - będzie widoczny jako "Asystent [Imię] - Twój opiekun"</li>
          <li><strong>Rynki</strong> - określają na jakie kraje może wysyłać dany handlowiec</li>
          <li><strong>Język</strong> - określa w jakim języku będzie pisał maile</li>
          <li><strong>Podpis</strong> - będzie dodany na końcu każdego maila</li>
        </ul>
        </div>
      )}
    </main>
  );
}
