"use client";

import { useState } from "react";

export default function ApolloTestPage() {
  const [personId, setPersonId] = useState("63d7e20c3ad30800015da253");
  const [organizationId, setOrganizationId] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [domain, setDomain] = useState("tori-expo.com");
  const [testType, setTestType] = useState("all");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);

  const handleTest = async () => {
    if (!personId) {
      alert("Podaj Person ID");
      return;
    }

    setLoading(true);
    setResults(null);

    try {
      const response = await fetch("/api/company-selection/apollo/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          testType,
          personId,
          organizationId: organizationId || undefined,
          organizationName: organizationName || undefined,
          domain: domain || undefined,
        }),
      });

      const data = await response.json();
      setResults(data);
    } catch (error) {
      alert("Błąd: " + (error instanceof Error ? error.message : String(error)));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "2rem", maxWidth: "1200px", margin: "0 auto" }}>
      <h1 style={{ fontSize: "2rem", marginBottom: "1rem" }}>Test Apollo API</h1>
      <p style={{ color: "#6B7280", marginBottom: "2rem" }}>
        Testowanie różnych endpointów Apollo API, aby sprawdzić kiedy zużywany jest kredyt.
      </p>

      <div style={{ backgroundColor: "white", borderRadius: "0.75rem", border: "1px solid #E5E7EB", padding: "1.5rem", marginBottom: "2rem" }}>
        <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "1rem" }}>Parametry testu</h2>
        
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div>
            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 500 }}>Person ID *</label>
            <input
              type="text"
              value={personId}
              onChange={(e) => setPersonId(e.target.value)}
              style={{
                width: "100%",
                padding: "0.5rem 0.75rem",
                borderRadius: "0.5rem",
                border: "1px solid #D1D5DB",
                fontSize: "0.95rem",
              }}
              placeholder="63d7e20c3ad30800015da253"
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 500 }}>Organization ID</label>
            <input
              type="text"
              value={organizationId}
              onChange={(e) => setOrganizationId(e.target.value)}
              style={{
                width: "100%",
                padding: "0.5rem 0.75rem",
                borderRadius: "0.5rem",
                border: "1px solid #D1D5DB",
                fontSize: "0.95rem",
              }}
              placeholder="55e85d9bf3e5bb44df00010e"
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 500 }}>Organization Name</label>
            <input
              type="text"
              value={organizationName}
              onChange={(e) => setOrganizationName(e.target.value)}
              style={{
                width: "100%",
                padding: "0.5rem 0.75rem",
                borderRadius: "0.5rem",
                border: "1px solid #D1D5DB",
                fontSize: "0.95rem",
              }}
              placeholder="TORI EXPO LTD"
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 500 }}>Domain</label>
            <input
              type="text"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              style={{
                width: "100%",
                padding: "0.5rem 0.75rem",
                borderRadius: "0.5rem",
                border: "1px solid #D1D5DB",
                fontSize: "0.95rem",
              }}
              placeholder="tori-expo.com"
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 500 }}>Typ testu</label>
            <select
              value={testType}
              onChange={(e) => setTestType(e.target.value)}
              style={{
                width: "100%",
                padding: "0.5rem 0.75rem",
                borderRadius: "0.5rem",
                border: "1px solid #D1D5DB",
                fontSize: "0.95rem",
              }}
            >
              <option value="all">Wszystkie testy</option>
              <option value="check_person">Test 1: people/search (bez email)</option>
              <option value="check_person_with_email">Test 2: people/search (z email) - ZUŻYWA KREDYT</option>
              <option value="check_mixed">Test 3: mixed_people/search (bez email)</option>
              <option value="check_mixed_with_email">Test 4: mixed_people/search (z email) - ZUŻYWA KREDYT</option>
            </select>
          </div>

          <button
            onClick={handleTest}
            disabled={loading}
            style={{
              padding: "0.75rem 1.5rem",
              backgroundColor: loading ? "#9CA3AF" : "#3B82F6",
              color: "white",
              border: "none",
              borderRadius: "0.5rem",
              cursor: loading ? "not-allowed" : "pointer",
              fontWeight: 600,
              fontSize: "1rem",
            }}
          >
            {loading ? "Testowanie..." : "Uruchom test"}
          </button>
        </div>
      </div>

      {results && (
        <div style={{ backgroundColor: "white", borderRadius: "0.75rem", border: "1px solid #E5E7EB", padding: "1.5rem" }}>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "1rem" }}>Wyniki testów</h2>
          
          {results.summary && (
            <div style={{ 
              padding: "1rem", 
              backgroundColor: "#F0F9FF", 
              borderRadius: "0.5rem", 
              marginBottom: "1.5rem",
              border: "1px solid #BAE6FD"
            }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
                <div>
                  <div style={{ fontSize: "0.85rem", color: "#6B7280" }}>Testy wykonane</div>
                  <div style={{ fontSize: "1.5rem", fontWeight: 600 }}>{results.summary.totalTests}</div>
                </div>
                <div>
                  <div style={{ fontSize: "0.85rem", color: "#6B7280" }}>Sukces</div>
                  <div style={{ fontSize: "1.5rem", fontWeight: 600, color: "#059669" }}>
                    {results.summary.successfulTests}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: "0.85rem", color: "#6B7280" }}>Kredyty zużyte</div>
                  <div style={{ fontSize: "1.5rem", fontWeight: 600, color: results.summary.totalCreditsUsed > 0 ? "#DC2626" : "#059669" }}>
                    {results.summary.totalCreditsUsed}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: "0.85rem", color: "#6B7280" }}>Osoba znaleziona</div>
                  <div style={{ fontSize: "1.5rem", fontWeight: 600, color: results.summary.personFoundInAnyTest ? "#059669" : "#DC2626" }}>
                    {results.summary.personFoundInAnyTest ? "TAK" : "NIE"}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {results.results?.map((result: any, index: number) => (
              <div
                key={index}
                style={{
                  padding: "1rem",
                  backgroundColor: result.success ? (result.creditsUsed > 0 ? "#FEF2F2" : "#F0FDF4") : "#FEF2F2",
                  borderRadius: "0.5rem",
                  border: `1px solid ${result.success ? (result.creditsUsed > 0 ? "#FECACA" : "#BBF7D0") : "#FECACA"}`,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                  <h3 style={{ fontSize: "1rem", fontWeight: 600 }}>{result.test}</h3>
                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                    {result.creditsUsed > 0 && (
                      <span style={{ 
                        padding: "0.25rem 0.75rem", 
                        backgroundColor: "#DC2626", 
                        color: "white", 
                        borderRadius: "0.375rem",
                        fontSize: "0.75rem",
                        fontWeight: 600
                      }}>
                        ⚠️ {result.creditsUsed} KREDYT
                      </span>
                    )}
                    <span style={{
                      padding: "0.25rem 0.75rem",
                      backgroundColor: result.success ? "#059669" : "#DC2626",
                      color: "white",
                      borderRadius: "0.375rem",
                      fontSize: "0.75rem",
                      fontWeight: 600
                    }}>
                      {result.success ? "SUKCES" : "BŁĄD"}
                    </span>
                  </div>
                </div>

                {result.note && (
                  <div style={{ 
                    padding: "0.75rem", 
                    backgroundColor: "#FEF3C7", 
                    borderRadius: "0.375rem", 
                    marginBottom: "0.5rem",
                    fontSize: "0.875rem",
                    fontWeight: 500
                  }}>
                    {result.note}
                  </div>
                )}

                {result.error && (
                  <div style={{ color: "#DC2626", fontSize: "0.875rem", marginBottom: "0.5rem" }}>
                    Błąd: {result.error}
                  </div>
                )}

                {result.person && (
                  <div style={{ fontSize: "0.875rem", color: "#374151" }}>
                    <div><strong>ID:</strong> {result.person.id}</div>
                    <div><strong>Nazwa:</strong> {result.person.name}</div>
                    {result.person.organization && <div><strong>Organizacja:</strong> {result.person.organization}</div>}
                    {result.person.organizationId && <div><strong>Organization ID:</strong> {result.person.organizationId}</div>}
                    {result.person.domain && <div><strong>Domain:</strong> {result.person.domain}</div>}
                    {result.person.email && (
                      <div style={{ color: "#059669" }}>
                        <strong>Email:</strong> {result.person.email}
                      </div>
                    )}
                    {result.person.emailStatus && (
                      <div><strong>Email Status:</strong> {result.person.emailStatus}</div>
                    )}
                  </div>
                )}

                {result.personFound === false && (
                  <div style={{ color: "#DC2626", fontSize: "0.875rem" }}>
                    ❌ Osoba nie została znaleziona
                    {result.totalContacts !== undefined && (
                      <span> (sprawdzono {result.totalContacts} contacts, {result.totalPeople} people)</span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

