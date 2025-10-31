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
    console.log(`[PROGRESS] useEffect uruchomiony - importId: ${importId}, importCompleted: ${importCompleted}`);
    if (!importId || importCompleted) {
      console.log(`[PROGRESS] useEffect zakończony - brak importId lub importCompleted`);
      return;
    }

    const pollProgress = async () => {
      try {
        const response = await fetch(`/api/leads/import/progress?importId=${importId}`);
        if (response.ok) {
          const data = await response.json();
          setProgress(data);
          console.log(`[PROGRESS] ${data.processed}/${data.total} (${data.percentage}%) - ${data.currentStep}`);
          
          // Jeśli import zakończony, zresetuj statusy i PRZESTAŃ polling
          if (data.isComplete) {
            console.log('[PROGRESS] Import zakończony - resetuję statusy');
            setIsProcessing(false);
            setImportCompleted(true);
            setStatus(`Import zakończony! Dodano: ${data.processed} leadów`);
            return; // Wyjdź z funkcji - nie kontynuuj polling
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
    
    // Dodaj małe opóźnienie żeby upewnić się, że importId jest ustawiony
    const timeoutId = setTimeout(() => {
      console.log(`[PROGRESS] Timeout uruchomiony - importId: ${importId}`);
      // Rozpocznij polling po timeout
      pollProgress();
    }, 100);
    
    console.log(`[PROGRESS] Rozpoczęto polling dla importId: ${importId}`);

    return () => {
      clearInterval(interval);
      clearTimeout(timeoutId);
    };
  }, [importId, importCompleted]);

  // Debug: useEffect który będzie się uruchamiał za każdym razem gdy importId się zmieni
  useEffect(() => {
    console.log(`[DEBUG] importId zmieniony na: ${importId}`);
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
          setStatus(`Utworzono nowy tag: ${newTag.name}`);
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
        setStatus("Nie udało się sparsować pliku z żadnym z delimiterów");
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
            setStatus(`Wykryto delimiter: "${delimiter}" - przetwarzanie danych...`);
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
          setStatus(`Przygotowano ${leads.length} leadów do importu`);
  };

  const onFile = (file: File) => {
    console.log(`[IMPORT] Rozpoczynam parsowanie pliku: ${file.name} (${file.size} bytes)`);
    setStatus("Parsowanie pliku...");
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
        setStatus(`Auto-detect wykrył delimiter: "${detectedDelimiter}" - przetwarzanie danych...`);
        
        if (result.errors && result.errors.length > 0) {
          console.warn(`[IMPORT] Błędy parsowania:`, result.errors);
          setStatus(`Błędy parsowania: ${result.errors.map(e => e.message).join(', ')}`);
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
        setStatus(`Błąd parsowania pliku: ${error.message}`);
        alert(`Błąd parsowania pliku CSV.\n\nSzczegóły: ${error.message}\n\nSprawdź konsolę (F12) aby zobaczyć więcej informacji.`);
      }
    });
  };

  const handleSave = async () => {
    if (rows.length === 0) {
      alert("Brak danych do zapisania");
      return;
    }

    if (!selectedTagId) {
      alert("Musisz wybrać tag dla importowanych leadów!");
      return;
    }

    // USTAW IMPORTID OD RAZU - PRZED WYSŁANIEM!
    const newImportId = `import_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    console.log(`[FRONTEND] Ustawiam importId PRZED importem:`, newImportId);
    setImportId(newImportId);
    console.log(`[FRONTEND] importId ustawiony, powinien uruchomić useEffect`);
    
    // Sprawdź czy importId jest rzeczywiście ustawiony
    setTimeout(() => {
      console.log(`[FRONTEND] Sprawdzam importId po 200ms:`, importId);
    }, 200);

    console.log(`[FRONTEND] Rozpoczynam import ${rows.length} leadów...`);
    console.log(`[FRONTEND] Pierwsze 3 leady:`, rows.slice(0, 3));
    console.log(`[FRONTEND] Tag ID:`, selectedTagId);

    setIsProcessing(true);
        setStatus("Wysyłam dane do serwera...");
    
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
        
        // importId już jest ustawiony przed wysłaniem
        if (result.importId) {
          console.log(`[FRONTEND] Serwer zwrócił importId:`, result.importId);
        } else {
          // Fallback dla starych odpowiedzi bez importId
          const totalCount = (result.importedCount || 0) + (result.skippedCount || 0);
          const tagName = selectedTagId ? tags.find(t => t.id === selectedTagId)?.name : "bez tagu";
          setStatus(`Zapisano ${totalCount} leadów z tagiem "${tagName}"`);
          setRows([]);
          setSelectedTagId(null);
          alert(`Import zakończony!\n\nDodano nowych: ${result.importedCount}\nIstniejące (otrzymały tag): ${result.skippedCount}`);
          setIsProcessing(false);
        }
      } else {
        const error = await response.json();
        console.error(`[FRONTEND] Błąd importu:`, error);
        setStatus(`Błąd importu`);
        alert(`Błąd importu:\n\n${error.error}\n\n${error.details || ''}`);
        setIsProcessing(false);
      }
    } catch (error) {
      console.error("[FRONTEND] Wyjątek podczas importu:", error);
      setStatus(`Błąd połączenia`);
      alert("Błąd zapisywania leadów - sprawdź konsolę (F12)");
      setIsProcessing(false);
    }
  };





  return (
    <main className="container" style={{ paddingTop: "var(--spacing-xl)", paddingBottom: "var(--spacing-2xl)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "var(--spacing-xl)" }}>
        <div>
          <h1>Import leadów</h1>
          <p style={{ color: "var(--gray-600)", marginTop: "var(--spacing-sm)" }}>
            Importuj leady z pliku CSV do bazy danych
          </p>
        </div>
        <Link href="/" style={{ color: "var(--gray-600)", textDecoration: "none" }}>
          ← Wróć
        </Link>
      </div>

      <div className="card" style={{ marginBottom: "var(--spacing-xl)" }}>
        <h2 style={{ marginBottom: "var(--spacing-lg)" }}>Import z CSV</h2>
        
        <div style={{ marginBottom: "var(--spacing-lg)" }}>
          <label style={{ display: "block", marginBottom: "var(--spacing-xs)", fontWeight: "600" }}>
            Plik CSV
          </label>
          <input
            type="file"
            accept=".csv,.txt,text/csv,text/plain,application/csv"
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
            style={{ width: "100%", padding: "var(--spacing-sm)", border: "1px solid var(--gray-300)", borderRadius: "var(--radius)" }}
          />
          <p style={{ fontSize: "14px", color: "var(--gray-600)", marginTop: "var(--spacing-sm)", lineHeight: "1.6" }}>
            Akceptowane formaty: CSV, TXT lub dowolny plik tekstowy<br/>
            Separator: przecinek (,) lub średnik (;) - wykrywany automatycznie<br/>
            Kodowanie: UTF-8 (zalecane)<br/>
            <strong>Wymagane kolumny:</strong> email, firstName (lub imię), company (lub firma), industry (lub branża), companyCountry (lub kraj)
          </p>
        </div>

        <div style={{ marginBottom: "var(--spacing-lg)" }}>
          <label style={{ display: "block", marginBottom: "var(--spacing-xs)", fontWeight: "600" }}>
            Tag dla leadów <span style={{ color: "var(--danger)" }}>*</span>
          </label>
          <select
            value={selectedTagId || ""}
            onChange={(e) => setSelectedTagId(e.target.value ? Number(e.target.value) : null)}
            style={{ width: "100%", padding: "var(--spacing-sm)", border: "1px solid var(--gray-300)", borderRadius: "var(--radius)", marginBottom: "var(--spacing-sm)" }}
          >
            <option value="">-- Wybierz tag --</option>
            {tags.map(tag => (
              <option key={tag.id} value={tag.id}>
                {tag.name}
              </option>
            ))}
          </select>
          
          <button
            type="button"
            onClick={() => setShowNewTagForm(!showNewTagForm)}
            className="btn"
            style={{
              backgroundColor: "#d81e42",
              color: "white",
              fontSize: "14px",
              padding: "8px 16px"
            }}
          >
            Dodaj nowy tag
          </button>

          {showNewTagForm && (
            <div className="card" style={{ 
              marginTop: "var(--spacing-md)", 
              padding: "var(--spacing-md)",
              backgroundColor: "var(--gray-50)"
            }}>
              <input
                type="text"
                placeholder="Nazwa nowego tagu"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                style={{ 
                  width: "100%", 
                  padding: "var(--spacing-sm)", 
                  border: "1px solid var(--gray-300)", 
                  borderRadius: "var(--radius)",
                  marginBottom: "var(--spacing-sm)"
                }}
                onKeyPress={(e) => e.key === 'Enter' && createNewTag()}
              />
              <div style={{ display: "flex", gap: "var(--spacing-sm)" }}>
                <button
                  onClick={createNewTag}
                  className="btn btn-success"
                  style={{ fontSize: "14px" }}
                >
                  Utwórz
                </button>
                <button
                  onClick={() => {
                    setShowNewTagForm(false);
                    setNewTagName("");
                  }}
                  className="btn btn-secondary"
                  style={{ fontSize: "14px" }}
                >
                  Anuluj
                </button>
              </div>
            </div>
          )}
          
          <p style={{ fontSize: "14px", color: "var(--gray-600)", marginTop: "var(--spacing-sm)" }}>
            <span style={{ color: "var(--danger)" }}>*</span> Wymagane: oznacz importowane leady tagiem
          </p>
        </div>

        {status && (
          <div className="card" style={{ 
            padding: "var(--spacing-md)", 
            backgroundColor: status.includes("Błąd") || status.includes("❌") ? "#fff5f5" : "#f0f9f4", 
            border: `1px solid ${status.includes("Błąd") || status.includes("❌") ? "var(--danger)" : "var(--success)"}`,
            marginBottom: "var(--spacing-lg)",
            color: status.includes("Błąd") || status.includes("❌") ? "var(--danger)" : "var(--success)",
            fontWeight: "500"
          }}>
            {status.replace(/[✅❌⏳💡ℹ️⚠️]/g, '').trim()}
          </div>
        )}

        {!importCompleted && (
          <button
            onClick={handleSave}
            disabled={rows.length === 0 || isProcessing || !selectedTagId}
            className="btn"
            style={{
              backgroundColor: (rows.length === 0 || isProcessing || !selectedTagId) ? "var(--gray-400)" : "#d81e42",
              color: "white",
              fontSize: "16px",
              fontWeight: "600",
              padding: "12px 24px",
              cursor: (rows.length === 0 || isProcessing || !selectedTagId) ? "not-allowed" : "pointer"
            }}
          >
            {isProcessing ? "Zapisywanie..." : `Zapisz ${rows.length} leadów`}
          </button>
        )}
        
        {rows.length > 0 && !isProcessing && (
          <div style={{ marginTop: "var(--spacing-md)" }}>
            {!selectedTagId && (
              <p style={{ fontSize: "14px", color: "var(--danger)", fontWeight: "600" }}>
                Wybierz tag aby móc zapisać leady
              </p>
            )}
            {selectedTagId && (
              <p style={{ fontSize: "14px", color: "var(--gray-600)" }}>
                Po kliknięciu przycisku zobaczysz pasek postępu importu poniżej
              </p>
            )}
          </div>
        )}
      </div>

      {/* Wskaźnik postępu importu - ZAWSZE WIDOCZNY */}
      <div className="card" style={{ 
        marginBottom: "var(--spacing-xl)",
        opacity: importId ? 1 : 0.7
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "var(--spacing-md)" }}>
          <h3 style={{ margin: 0, fontSize: "18px", fontWeight: "600" }}>Postęp importu</h3>
          {importId && (
            <span style={{ fontSize: "12px", color: "var(--gray-500)", fontFamily: "monospace" }}>{importId}</span>
          )}
        </div>
        <div style={{ 
          width: "100%", 
          backgroundColor: "var(--gray-200)", 
          borderRadius: "var(--radius)", 
          height: "24px",
          overflow: "hidden",
          marginBottom: "var(--spacing-md)"
        }}>
          <div 
            style={{ 
              width: `${progress?.percentage || 0}%`, 
              backgroundColor: "#d81e42",
              height: "100%",
              transition: "width 0.3s ease",
              borderRadius: "var(--radius)",
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              paddingRight: "8px",
              color: "white",
              fontSize: "12px",
              fontWeight: "600"
            }}
          >
            {progress && progress.percentage > 15 && `${progress.percentage}%`}
          </div>
        </div>
        <div style={{ marginBottom: "var(--spacing-sm)", fontSize: "14px", color: importId ? "var(--gray-900)" : "var(--gray-500)", fontWeight: "500" }}>
          {progress?.currentStep || (importId ? 'Inicjalizacja importu...' : 'Oczekiwanie na import...')}
        </div>
        {progress && (
          <div style={{ marginTop: "var(--spacing-sm)", fontSize: "14px", color: "var(--gray-600)", lineHeight: "1.8" }}>
            <div>
              <strong>{progress.processed}</strong> z <strong>{progress.total}</strong> leadów zaimportowanych
            </div>
            <div>
              Pozostało: <strong>{progress.total - progress.processed}</strong> leadów
            </div>
            <div>
              {progress.percentage}% ukończone
            </div>
          </div>
        )}
        {!importId && (
          <div style={{ marginTop: "var(--spacing-sm)", fontSize: "13px", color: "var(--gray-500)", fontStyle: "italic" }}>
            Import rozpocznie się po kliknięciu przycisku "Zapisz leady"
          </div>
        )}
      </div>

      {rows.length > 0 && (
        <div className="card" style={{ marginBottom: "var(--spacing-xl)" }}>
          <h3 style={{ marginBottom: "var(--spacing-md)" }}>Podsumowanie importu</h3>
          
          <div style={{ marginBottom: "var(--spacing-lg)" }}>
            <div style={{ fontWeight: "600", fontSize: "18px", color: "var(--success)", marginBottom: "var(--spacing-sm)" }}>
              Znaleziono {rows.length} leadów do importu
            </div>
            <div style={{ color: "var(--gray-600)", fontSize: "14px" }}>
              Wszystkie leady będą automatycznie spersonalizowane przez AI
            </div>
          </div>

          <div style={{ 
            padding: "var(--spacing-md)", 
            backgroundColor: "#e8f4fd", 
            border: "1px solid #bee5eb", 
            borderRadius: "var(--radius)",
            fontSize: "14px"
          }}>
            <strong style={{ display: "block", marginBottom: "var(--spacing-sm)" }}>Co się stanie po zapisaniu:</strong>
            <ul style={{ margin: 0, paddingLeft: "20px", lineHeight: "1.8" }}>
              <li>Każdy lead dostanie odpowiedni greeting w swoim języku</li>
              <li>Personalizacja będzie dostępna w szczegółach leada</li>
              <li>Możesz od razu tworzyć kampanie z tymi leadami</li>
            </ul>
          </div>
        </div>
      )}

      <div className="card" style={{ backgroundColor: "#e8f4fd" }}>
        <h3 style={{ marginBottom: "var(--spacing-md)" }}>Co dalej?</h3>
        <p style={{ marginBottom: "var(--spacing-sm)", color: "var(--gray-700)" }}>Po imporcie leadów będziesz mógł:</p>
        <ul style={{ margin: 0, paddingLeft: "20px", lineHeight: "1.8", color: "var(--gray-700)" }}>
          <li>Przeglądać leady w <Link href="/leads" style={{ color: "var(--primary)", textDecoration: "underline" }}>globalnej bazie kontaktów</Link></li>
          <li>Tworzyć kampanie i dodawać leady według tagów</li>
          <li>Edytować teksty kampanii</li>
          <li>Wysyłać spersonalizowane maile</li>
        </ul>
      </div>
    </main>
  );
}