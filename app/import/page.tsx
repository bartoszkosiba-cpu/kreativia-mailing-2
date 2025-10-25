"use client";

import Papa from "papaparse";
import { useState, useEffect } from "react";
import Link from "next/link";

type LeadRow = {
  firstName?: string; lastName?: string; title?: string; company?: string; email: string;
  industry?: string; keywords?: string; linkedinUrl?: string; website?: string; companyCity?: string; companyCountry?: string;
};

interface Tag {
  id: number;
  name: string;
  color: string;
}

export default function ImportPage() {
  const [rows, setRows] = useState<LeadRow[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedTagId, setSelectedTagId] = useState<number | null>(null);
  const [tags, setTags] = useState<Tag[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [importId, setImportId] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ 
    percentage: number; 
    currentStep: string; 
    processed: number; 
    total: number; 
  } | null>(null);
  const [showNewTagForm, setShowNewTagForm] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [importCompleted, setImportCompleted] = useState(false);

  useEffect(() => {
    fetchTags();
  }, []);

  // Śledzenie postępu importu
  useEffect(() => {
    if (!importId) return;

    const pollProgress = async () => {
      try {
        const response = await fetch(`/api/leads/import/progress?importId=${importId}`);
        if (response.ok) {
          const data = await response.json();
          setProgress(data);
          console.log(`[PROGRESS] ${data.processed}/${data.total} (${data.percentage}%) - ${data.currentStep}`);
          
          // Jeśli import zakończony, zresetuj statusy
          if (data.isComplete) {
            console.log('[PROGRESS] Import zakończony - resetuję statusy');
            setIsProcessing(false);
            setImportCompleted(true);
            setStatus(`✅ Import zakończony! Dodano: ${data.processed} leadów`);
            
            // NIE resetuj importId i progress - pozostaw efekt końcowy
            // setTimeout(() => {
            //   setImportId(null);
            //   setProgress(null);
            // }, 5000);
          }
        } else if (response.status === 404) {
          // Import jeszcze się nie rozpoczął - to normalne na początku
          console.log(`[PROGRESS] Import ${importId} jeszcze się nie rozpoczął`);
        } else {
          console.error(`[PROGRESS] Błąd HTTP ${response.status}`);
        }
      } catch (error) {
        console.error('[PROGRESS] Błąd:', error);
      }
    };

    // Sprawdź postęp co 500ms dla lepszej responsywności
    const interval = setInterval(pollProgress, 500);
    
    // Pierwsze sprawdzenie od razu
    pollProgress();

    return () => clearInterval(interval);
  }, [importId]);

  const fetchTags = async () => {
    try {
      const response = await fetch("/api/tags");
      if (response.ok) {
        const data = await response.json();
        setTags(data);
      }
    } catch (error) {
      console.error("Błąd pobierania tagów:", error);
    }
  };

  const createNewTag = async () => {
    if (!newTagName.trim()) {
      alert("Podaj nazwę tagu");
      return;
    }

    try {
      const formData = new FormData();
      formData.append("name", newTagName.trim());
      formData.append("color", "#d81e42"); // Kreativia red
      formData.append("description", "Utworzony podczas importu CSV");

      const response = await fetch("/api/tags", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        const newTag = await response.json();
        // Dodaj nowy tag do listy
        setTags(prev => [...prev, newTag]);
        // Wybierz nowo utworzony tag
        setSelectedTagId(newTag.id);
        setShowNewTagForm(false);
        setNewTagName("");
        setStatus(`✅ Utworzono nowy tag: ${newTag.name}`);
      } else {
        const error = await response.json();
        alert(`Błąd tworzenia tagu: ${error.error}`);
      }
    } catch (error) {
      console.error("Błąd tworzenia tagu:", error);
      alert("Błąd tworzenia tagu");
    }
  };

  const tryDelimiters = (file: File, delimiters: string[]) => {
    console.log(`[IMPORT] Próbuję delimiterów:`, delimiters);
    
    const tryNext = (index: number) => {
      if (index >= delimiters.length) {
        setStatus("❌ Nie udało się sparsować pliku z żadnym z delimiterów");
        return;
      }
      
      const delimiter = delimiters[index];
      console.log(`[IMPORT] Próbuję delimiter: "${delimiter}"`);
      
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        delimiter: delimiter,
        quoteChar: '"',
        escapeChar: '"',
        transformHeader: (header: string) => header.trim(),
        complete: (result) => {
          console.log(`[IMPORT] Delimiter "${delimiter}" - wierszy: ${result.data.length}, nagłówki:`, Object.keys(result.data[0] || {}));
          
          if (result.data && result.data.length > 0 && result.data[0] && Object.keys(result.data[0]).length > 1) {
            console.log(`[IMPORT] ✅ Delimiter "${delimiter}" zadziałał!`);
            setStatus(`✅ Wykryto delimiter: "${delimiter}" - przetwarzanie danych...`);
            processParsedData(result.data);
          } else {
            console.log(`[IMPORT] ❌ Delimiter "${delimiter}" nie zadziałał, próbuję następny...`);
            tryNext(index + 1);
          }
        },
        error: (error) => {
          console.log(`[IMPORT] ❌ Błąd z delimiterem "${delimiter}":`, error);
          tryNext(index + 1);
        }
      });
    };
    
    tryNext(0);
  };

  const processParsedData = (data: any[]) => {
    const normalizeKey = (k: string) => (k || "").toString().trim().toLowerCase().replace(/\s+/g, " ");
    const get = (row: Record<string, any>, aliases: string[]) => {
      for (const a of aliases) {
        const val = row[a] ?? row[a.toLowerCase()] ?? row[a.toUpperCase()];
        if (val !== undefined && val !== null && val !== "") {
          return val.toString().trim();
        }
      }
      // try normalized match
      const normRow: Record<string, any> = {};
      Object.keys(row).forEach((k) => (normRow[normalizeKey(k)] = row[k]));
      for (const a of aliases) {
        const val = normRow[normalizeKey(a)];
        if (val !== undefined && val !== null && String(val).trim() !== "") {
          return String(val).trim();
        }
      }
      return "";
    };

    console.log(`[IMPORT] Przetwarzanie ${data.length} wierszy...`);
    console.log(`[IMPORT] Pierwszy wiersz:`, data[0]);
    console.log(`[IMPORT] Nagłówki:`, Object.keys(data[0] || {}));

    const leads = data
      .filter(row => {
        const email = get(row, ["email", "e-mail", "mail"]);
        console.log(`[IMPORT] Sprawdzam wiersz:`, { email, row: Object.keys(row) });
        return email !== "";
      })
      .map(row => {
        const email = get(row, ["email", "e-mail", "mail"]);
        const firstName = get(row, ["firstname", "first name", "imię", "imie", "name", "nazwisko", "nazwa"]);
        const lastName = get(row, ["lastname", "last name", "nazwisko", "surname", "family name"]);
        const company = get(row, ["company", "company name", "company_name", "firma", "organization", "organizacja"]);
        const title = get(row, ["title", "position", "stanowisko", "job title", "role"]);
        const industry = get(row, ["industry", "branża", "branza", "sector"]);
        const keywords = get(row, ["keywords", "słowa kluczowe", "slowa kluczowe", "tags", "tagi"]);
        const linkedinUrl = get(row, ["linkedin", "linkedin url", "linkedin profile", "profil linkedin"]);
        const website = get(row, ["website", "website url", "url", "strona", "web"]);
        const companyCity = get(row, ["city", "miasto", "location", "lokalizacja", "company city", "company state", "company_state", "state"]);
        const companyCountry = get(row, ["country", "kraj", "nation", "company country", "company_country"]);

        const lead = {
          firstName: firstName || "",
          lastName: lastName || "",
          title: title || "",
          company: company || "",
          email: email,
          industry: industry || "",
          keywords: keywords || "",
          linkedinUrl: linkedinUrl || "",
          website: website || "",
          companyCity: companyCity || "",
          companyCountry: companyCountry || ""
        };
        
        console.log(`[IMPORT] Lead:`, lead);
        return lead;
      });

    console.log(`[IMPORT] Przygotowano ${leads.length} leadów do importu`);
    setRows(leads);
    setStatus(`✅ Przygotowano ${leads.length} leadów do importu`);
  };

  const onFile = (file: File) => {
    console.log(`[IMPORT] Rozpoczynam parsowanie pliku: ${file.name} (${file.size} bytes)`);
    setStatus("⏳ Parsowanie pliku...");
    setImportCompleted(false); // Resetuj stan importu
    setImportId(null); // Resetuj importId
    setProgress(null); // Resetuj postęp
    
    // Najpierw spróbuj auto-detect
    Papa.parse(file as any, {
      header: true,
      skipEmptyLines: true,
      delimiter: "",   // Auto-detect delimiter (sprawdzi czy to ; czy ,)
      newline: "\n",     // Auto-detect newline
      quoteChar: '"',
      escapeChar: '"',
      transformHeader: (header: string) => header.trim(), // Trim whitespace from headers
      complete: (result) => {
        console.log(`[IMPORT] Parsowanie zakończone. Wierszy: ${result.data.length}`);
        console.log(`[IMPORT] Wykryty delimiter:`, result.meta?.delimiter || 'nieznany');
        console.log(`[IMPORT] Pierwsze 2 wiersze:`, result.data.slice(0, 2));
        console.log(`[IMPORT] Nagłówki:`, Object.keys(result.data[0] || {}));
        
        const detectedDelimiter = result.meta?.delimiter || 'nieznany';
        setStatus(`✅ Auto-detect wykrył delimiter: "${detectedDelimiter}" - przetwarzanie danych...`);
        
        if (result.errors && result.errors.length > 0) {
          console.warn(`[IMPORT] Błędy parsowania:`, result.errors);
          setStatus(`❌ Błędy parsowania: ${result.errors.map(e => e.message).join(', ')}`);
          return;
        }
        
        // Jeśli auto-detect nie zadziałał, spróbuj z różnymi delimiterami
        if (!result.data || result.data.length === 0 || !result.data[0] || Object.keys(result.data[0]).length === 0) {
          console.log(`[IMPORT] Auto-detect nie zadziałał, próbuję z różnymi delimiterami...`);
          tryDelimiters(file, [';', ',', '\t', '|']);
          return;
        }
        
        // Auto-detect zadziałał, przetwórz dane
        processParsedData(result.data);
      },
      error: (error: any) => {
        console.error("[IMPORT] Błąd parsowania CSV:", error);
        setStatus(`❌ Błąd parsowania pliku: ${error.message}`);
        alert(`❌ Błąd parsowania pliku CSV.\n\nSzczegóły: ${error.message}\n\nSprawdź konsolę (F12) aby zobaczyć więcej informacji.`);
      }
    });
  };

  const handleSave = async () => {
    if (rows.length === 0) {
      alert("Brak danych do zapisania");
      return;
    }

    if (!selectedTagId) {
      alert("⚠️ Musisz wybrać tag dla importowanych leadów!");
      return;
    }

    // USTAW IMPORTID OD RAZU - PRZED WYSŁANIEM!
    const newImportId = `import_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    console.log(`[FRONTEND] Ustawiam importId PRZED importem:`, newImportId);
    setImportId(newImportId);

    console.log(`[FRONTEND] Rozpoczynam import ${rows.length} leadów...`);
    console.log(`[FRONTEND] Pierwsze 3 leady:`, rows.slice(0, 3));
    console.log(`[FRONTEND] Tag ID:`, selectedTagId);

    setIsProcessing(true);
    setStatus("⏳ Wysyłam dane do serwera...");
    
    try {
      const response = await fetch("/api/leads/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          leads: rows,
          tagId: selectedTagId,
          importId: newImportId // Przekaż importId do serwera
        }),
      });

      console.log(`[FRONTEND] Odpowiedź serwera: status ${response.status}`);

      if (response.ok) {
        const result = await response.json();
        console.log(`[FRONTEND] Wynik importu:`, result);
        
        // Ustaw importId dla śledzenia postępu
        if (result.importId) {
          console.log(`[FRONTEND] Ustawiam importId:`, result.importId);
          setImportId(result.importId);
        } else {
          // Fallback dla starych odpowiedzi bez importId
          const totalCount = (result.importedCount || 0) + (result.updatedCount || 0);
          const tagName = selectedTagId ? tags.find(t => t.id === selectedTagId)?.name : "bez tagu";
          setStatus(`✅ Zapisano ${totalCount} leadów z tagiem "${tagName}"`);
          setRows([]);
          setSelectedTagId(null);
          alert(`✅ Import zakończony!\n\nDodano: ${result.importedCount}\nZaktualizowano: ${result.updatedCount}\nPominięto: ${result.skippedCount}`);
          setIsProcessing(false);
        }
      } else {
        const error = await response.json();
        console.error(`[FRONTEND] Błąd importu:`, error);
        setStatus(`❌ Błąd importu`);
        alert(`❌ Błąd importu:\n\n${error.error}\n\n${error.details || ''}`);
        setIsProcessing(false);
      }
    } catch (error) {
      console.error("[FRONTEND] Wyjątek podczas importu:", error);
      setStatus(`❌ Błąd połączenia`);
      alert("❌ Błąd zapisywania leadów - sprawdź konsolę (F12)");
      setIsProcessing(false);
    }
  };





  return (
    <main className="container" style={{ paddingTop: "var(--spacing-xl)", paddingBottom: "var(--spacing-2xl)" }}>
      <h1>Import leadów do bazy</h1>
      
      <div style={{ marginBottom: 20 }}>
        <Link href="/">← Wróć do strony głównej</Link>
      </div>

      <div style={{ backgroundColor: "#f8f9fa", padding: 20, borderRadius: 8, marginBottom: 20 }}>
        <h2>Import z CSV</h2>
        
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontWeight: "bold", marginBottom: 8 }}>
            Plik CSV (kolumny: email, firstName, company, industry, companyCountry)
          </label>
          <input
            type="file"
            accept=".csv,.txt,text/csv,text/plain,application/csv"
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
            style={{ width: "100%", padding: 8, border: "1px solid #ccc", borderRadius: 4 }}
          />
          <p style={{ fontSize: 12, color: "#666", marginTop: 8 }}>
            ✅ Akceptowane formaty: CSV, TXT lub dowolny plik tekstowy<br/>
            ℹ️ Separator: przecinek (,) lub średnik (;) - wykrywany automatycznie<br/>
            ℹ️ Kodowanie: UTF-8 (zalecane)<br/>
            💡 <strong>Tip:</strong> Jeśli plik nie ma rozszerzenia, po prostu wybierz "Wszystkie pliki" w oknie wyboru
          </p>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontWeight: "bold", marginBottom: 8 }}>
            Tag dla leadów <span style={{ color: "#dc3545" }}>*</span>
          </label>
          <select
            value={selectedTagId || ""}
            onChange={(e) => setSelectedTagId(e.target.value ? Number(e.target.value) : null)}
            style={{ width: "100%", padding: 8, border: "1px solid #ccc", borderRadius: 4 }}
          >
            <option value="">-- Wybierz tag --</option>
            {tags.map(tag => (
              <option key={tag.id} value={tag.id}>
                {tag.name}
              </option>
            ))}
          </select>
          
          <div style={{ marginTop: 8 }}>
            <button
              type="button"
              onClick={() => setShowNewTagForm(!showNewTagForm)}
              style={{
                padding: "6px 12px",
                backgroundColor: "#d81e42",
                color: "white",
                border: "none",
                borderRadius: 4,
                cursor: "pointer",
                fontSize: 12
              }}
            >
              + Dodaj nowy tag
            </button>
          </div>

          {showNewTagForm && (
            <div style={{ 
              marginTop: 8, 
              padding: 12, 
              backgroundColor: "#f8f9fa", 
              border: "1px solid #c4c5c1", 
              borderRadius: 4 
            }}>
              <input
                type="text"
                placeholder="Nazwa nowego tagu"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                style={{ 
                  width: "100%", 
                  padding: 8, 
                  border: "1px solid #ccc", 
                  borderRadius: 4,
                  marginBottom: 8
                }}
                onKeyPress={(e) => e.key === 'Enter' && createNewTag()}
              />
              <div>
                <button
                  onClick={createNewTag}
                  style={{
                    padding: "6px 12px",
                    backgroundColor: "#28a745",
                    color: "white",
                    border: "none",
                    borderRadius: 4,
                    cursor: "pointer",
                    fontSize: 12,
                    marginRight: 8
                  }}
                >
                  Utwórz
                </button>
                <button
                  onClick={() => {
                    setShowNewTagForm(false);
                    setNewTagName("");
                  }}
                  style={{
                    padding: "6px 12px",
                    backgroundColor: "#6c757d",
                    color: "white",
                    border: "none",
                    borderRadius: 4,
                    cursor: "pointer",
                    fontSize: 12
                  }}
                >
                  Anuluj
                </button>
              </div>
            </div>
          )}
          
          <p style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
            <span style={{ color: "#dc3545" }}>*</span> Wymagane: oznacz importowane leady tagiem
          </p>
        </div>

        {status && (
          <div style={{ 
            padding: 12, 
            backgroundColor: status.includes("Błąd") ? "#f8d7da" : "#d4edda", 
            color: status.includes("Błąd") ? "#721c24" : "#155724",
            borderRadius: 4,
            marginBottom: 16
          }}>
            {status}
          </div>
        )}

        {!importCompleted && (
          <button
            onClick={handleSave}
            disabled={rows.length === 0 || isProcessing || !selectedTagId}
            style={{
              padding: "12px 24px",
              backgroundColor: (rows.length === 0 || isProcessing || !selectedTagId) ? "#ccc" : "#d81e42",
              color: "white",
              border: "none",
              borderRadius: 4,
              cursor: (rows.length === 0 || isProcessing || !selectedTagId) ? "not-allowed" : "pointer",
              fontSize: 16,
              fontWeight: 500,
              transition: "all 0.2s ease"
            }}
          >
            {isProcessing ? "⏳ Zapisywanie..." : `Zapisz ${rows.length} leadów`}
          </button>
        )}
        
        {rows.length > 0 && !isProcessing && (
          <div style={{ marginTop: 12 }}>
            {!selectedTagId && (
              <p style={{ fontSize: 12, color: "#dc3545", fontWeight: "bold" }}>
                ⚠️ Wybierz tag aby móc zapisać leady
              </p>
            )}
            {selectedTagId && (
              <p style={{ fontSize: 12, color: "#666" }}>
                ℹ️ Po kliknięciu przycisku zobaczysz pasek postępu importu poniżej
              </p>
            )}
          </div>
        )}
      </div>

      {/* Wskaźnik postępu importu - ZAWSZE WIDOCZNY */}
      <div style={{ 
        marginTop: 20, 
        padding: 16, 
        backgroundColor: importId ? "#f8f9fa" : "#fafafa", 
        border: `1px solid ${importId ? "#c4c5c1" : "#e0e0e0"}`, 
        borderRadius: 8,
        opacity: importId ? 1 : 0.6
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
          <span style={{ fontSize: 14, fontWeight: 500, color: "#111111" }}>Postęp importu:</span>
          {importId && (
            <span style={{ fontSize: 12, color: "#666" }}>{importId}</span>
          )}
        </div>
        <div style={{ 
          width: "100%", 
          backgroundColor: "#c4c5c1", 
          borderRadius: 4, 
          height: 10,
          overflow: "hidden"
        }}>
          <div 
            style={{ 
              width: `${progress?.percentage || 0}%`, 
              backgroundColor: "#d81e42",
              height: "100%",
              transition: "width 0.3s ease",
              borderRadius: 4
            }}
          ></div>
        </div>
        <div style={{ marginTop: 12, fontSize: 14, color: importId ? "#111111" : "#666" }}>
          {progress?.currentStep || (importId ? 'Inicjalizacja importu...' : 'Oczekiwanie na import...')}
        </div>
        {progress && (
          <div style={{ marginTop: 8, fontSize: 12, color: "#666" }}>
            <div style={{ marginBottom: 4 }}>
              <strong>{progress.processed}</strong> z <strong>{progress.total}</strong> leadów zaimportowanych
            </div>
            <div style={{ marginBottom: 4 }}>
              Pozostało: <strong>{progress.total - progress.processed}</strong> leadów
            </div>
            <div>
              {progress.percentage}% ukończone
            </div>
          </div>
        )}
        {!importId && (
          <div style={{ marginTop: 8, fontSize: 12, color: "#999", fontStyle: "italic" }}>
            Import rozpocznie się po kliknięciu przycisku "Zapisz leady"
          </div>
        )}
      </div>

      {rows.length > 0 && (
        <div style={{ backgroundColor: "#f8f9fa", padding: 20, borderRadius: 8, marginTop: 20 }}>
          <h3>Podsumowanie importu</h3>
          
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: "bold", fontSize: 18, color: "#28a745" }}>
              ✅ Znaleziono {rows.length} leadów do importu
            </div>
            <div style={{ color: "#666", fontSize: 14, marginTop: 8 }}>
              Wszystkie leady będą automatycznie spersonalizowane przez AI
            </div>
          </div>

          <div style={{ 
            padding: 12, 
            backgroundColor: "#e8f4fd", 
            border: "1px solid #bee5eb", 
            borderRadius: 4,
            fontSize: 14
          }}>
            <strong>💡 Co się stanie po zapisaniu:</strong>
            <ul style={{ marginTop: 8, marginBottom: 0 }}>
              <li>Każdy lead dostanie odpowiedni greeting w swoim języku</li>
              <li>Personalizacja będzie dostępna w szczegółach leada</li>
              <li>Możesz od razu tworzyć kampanie z tymi leadami</li>
            </ul>
          </div>
        </div>
      )}

      <div style={{ backgroundColor: "#e8f4fd", padding: 16, borderRadius: 8, marginTop: 20 }}>
        <h3>Co dalej?</h3>
        <p>Po imporcie leadów będziesz mógł:</p>
        <ul>
          <li>Przeglądać leady w <Link href="/leads">globalnej bazie kontaktów</Link></li>
          <li>Tworzyć kampanie i dodawać leady według tagów</li>
          <li>Edytować teksty kampanii</li>
          <li>Wysyłać spersonalizowane maile</li>
        </ul>
      </div>
    </main>
  );
}