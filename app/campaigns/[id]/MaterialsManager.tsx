"use client";

import { useState, useEffect } from "react";

interface Material {
  id: number;
  name: string;
  type: "LINK" | "ATTACHMENT";
  url: string | null;
  filePath: string | null;
  fileName: string | null;
  fileSize: number | null;
  order: number;
  isActive: boolean;
}

interface Props {
  campaignId: number;
}

export default function MaterialsManager({ campaignId }: Props) {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState<"LINK" | "ATTACHMENT">("LINK");
  const [formUrl, setFormUrl] = useState("");
  const [formFilePath, setFormFilePath] = useState("");
  const [formFileName, setFormFileName] = useState("");
  const [formOrder, setFormOrder] = useState(0);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    loadMaterials();
  }, [campaignId]);

  const loadMaterials = async () => {
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/materials`);
      const data = await response.json();
      if (data.success) {
        setMaterials(data.data);
      }
    } catch (error: any) {
      alert(`Błąd ładowania materiałów: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setFormFileName(file.name);
      // Automatycznie ustaw rozmiar pliku (opcjonalnie)
    }
  };

  const handleFileUpload = async (): Promise<string | null> => {
    if (!selectedFile) return null;

    setUploadingFile(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await fetch(`/api/campaigns/${campaignId}/materials/upload`, {
        method: "POST",
        body: formData
      });

      const data = await response.json();

      if (!data.success) {
        alert(`Błąd uploadu: ${data.error}`);
        return null;
      }

      return data.data.filePath;
    } catch (error: any) {
      alert(`Błąd uploadu: ${error.message}`);
      return null;
    } finally {
      setUploadingFile(false);
    }
  };

  const handleAdd = async () => {
    if (!formName.trim()) {
      alert("Nazwa materiału jest wymagana");
      return;
    }

    if (formType === "LINK" && !formUrl.trim()) {
      alert("URL jest wymagany dla typu LINK");
      return;
    }

    if (formType === "ATTACHMENT" && !selectedFile) {
      alert("Wybierz plik z dysku");
      return;
    }

    try {
      let finalFilePath: string | null = formFilePath?.trim() || null;
      let finalFileName: string | null = formFileName?.trim() || null;

      // Jeśli wybrano plik z dysku - uploaduj go
      if (formType === "ATTACHMENT" && selectedFile) {
        const uploadedPath = await handleFileUpload();
        if (!uploadedPath) {
          return; // Błąd uploadu - już pokazano alert
        }
        finalFilePath = uploadedPath;
        finalFileName = selectedFile.name;
      }

      // Ostatnia walidacja - dla ATTACHMENT musi być filePath
      if (formType === "ATTACHMENT" && !finalFilePath) {
        alert("Błąd: Brak ścieżki pliku. Spróbuj ponownie.");
        return;
      }

      const response = await fetch(`/api/campaigns/${campaignId}/materials`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName.trim(),
          type: formType,
          url: formType === "LINK" ? formUrl.trim() : null,
          filePath: formType === "ATTACHMENT" ? finalFilePath : null,
          fileName: finalFileName?.trim() || null,
          fileSize: selectedFile ? selectedFile.size : (formType === "ATTACHMENT" && formFilePath ? null : undefined),
          order: formOrder || 0
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Nieznany błąd serwera" }));
        console.error("[MATERIALS] Błąd zapisu:", errorData);
        alert(`Błąd: ${errorData.error || `HTTP ${response.status}`}`);
        return;
      }

      const data = await response.json();

      if (!data.success) {
        alert(`Błąd: ${data.error}`);
        return;
      }

      // Reset form (ale zostaw formularz otwarty aby dodać kolejny)
      setFormName("");
      setFormUrl("");
      setFormFilePath("");
      setFormFileName("");
      setFormOrder(0);
      setSelectedFile(null);
      // setShowAddForm(false); // Nie ukrywaj formularza - pozwól dodać kolejny materiał
      
      // Reset file input
      const fileInput = document.getElementById('material-file-input') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
      
      // Reload
      await loadMaterials();
      
      // Formularz pozostaje otwarty - możesz dodać kolejny materiał
    } catch (error: any) {
      alert(`Błąd dodawania: ${error.message}`);
    }
  };

  const handleUpdate = async (material: Material) => {
    if (!formName.trim()) {
      alert("Nazwa materiału jest wymagana");
      return;
    }

    if (formType === "LINK" && !formUrl.trim()) {
      alert("URL jest wymagany dla typu LINK");
      return;
    }

    if (formType === "ATTACHMENT" && !selectedFile) {
      alert("Wybierz plik z dysku");
      return;
    }

    try {
      let finalFilePath: string | null = material.filePath || null;
      let finalFileName: string | null = material.fileName || null;

      // Jeśli wybrano nowy plik z dysku - uploaduj go
      if (formType === "ATTACHMENT" && selectedFile) {
        const uploadedPath = await handleFileUpload();
        if (!uploadedPath) {
          return; // Błąd uploadu - już pokazano alert
        }
        finalFilePath = uploadedPath;
        finalFileName = selectedFile.name;
      }
      
      // Jeśli edytujemy i nie wybrano pliku - użyj istniejącej ścieżki
      if (formType === "ATTACHMENT" && !selectedFile && !finalFilePath) {
        alert("Wybierz plik z dysku");
        return;
      }

      const response = await fetch(`/api/campaigns/${campaignId}/materials/${material.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName.trim(),
          type: formType,
          url: formType === "LINK" ? formUrl.trim() : null,
          filePath: formType === "ATTACHMENT" ? finalFilePath : null,
          fileName: finalFileName,
          order: formOrder || 0,
          isActive: material.isActive
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
        console.error("[MATERIALS] Błąd aktualizacji:", errorData);
        alert(`Błąd: ${errorData.error || `HTTP ${response.status}`}`);
        return;
      }

      const data = await response.json();

      if (!data.success) {
        alert(`Błąd: ${data.error}`);
        return;
      }

      setEditingMaterial(null);
      // Po edycji ukryj formularz (edytujemy jeden materiał, nie dodajemy kolejnych)
      setShowAddForm(false);
      resetForm();
      await loadMaterials();
    } catch (error: any) {
      alert(`Błąd aktualizacji: ${error.message}`);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Czy na pewno chcesz usunąć ten materiał?")) return;

    try {
      const response = await fetch(`/api/campaigns/${campaignId}/materials/${id}`, {
        method: "DELETE"
      });

      const data = await response.json();

      if (!data.success) {
        alert(`Błąd: ${data.error}`);
        return;
      }

      await loadMaterials();
    } catch (error: any) {
      alert(`Błąd usuwania: ${error.message}`);
    }
  };

  const handleToggleActive = async (material: Material) => {
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/materials/${material.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isActive: !material.isActive
        })
      });

      const data = await response.json();

      if (!data.success) {
        alert(`Błąd: ${data.error}`);
        return;
      }

      await loadMaterials();
    } catch (error: any) {
      alert(`Błąd: ${error.message}`);
    }
  };

  const startEdit = (material: Material) => {
    setEditingMaterial(material);
    setFormName(material.name);
    setFormType(material.type);
    setFormUrl(material.url || "");
    setFormFilePath(material.filePath || "");
    setFormFileName(material.fileName || "");
    setFormOrder(material.order);
    setShowAddForm(true);
  };

  const resetForm = () => {
    setFormName("");
    setFormType("LINK");
    setFormUrl("");
    setFormFilePath("");
    setFormFileName("");
    setFormOrder(0);
    setSelectedFile(null);
    setEditingMaterial(null);
    setShowAddForm(false);
    
    // Reset file input
    const fileInput = document.getElementById('material-file-input') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  };

  if (loading) {
    return <div style={{ padding: "20px" }}>Ładowanie materiałów...</div>;
  }

  return (
    <div style={{ padding: "20px", backgroundColor: "white", borderRadius: "8px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <h2 style={{ margin: 0 }}>Materiały do wysyłki</h2>
        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            style={{
              padding: "8px 16px",
              backgroundColor: "var(--primary)",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontWeight: 600
            }}
          >
            + Dodaj materiał
          </button>
        )}
      </div>

      {showAddForm && (
        <div style={{ padding: "20px", backgroundColor: "#f8f9fa", borderRadius: "8px", marginBottom: "20px" }}>
          <h3 style={{ marginTop: 0 }}>
            {editingMaterial ? "Edytuj materiał" : "Nowy materiał"}
          </h3>

          <div style={{ marginBottom: "15px" }}>
            <label style={{ display: "block", marginBottom: "6px", fontWeight: 600 }}>
              Nazwa materiału *
            </label>
            <input
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="Np. Katalog mebli biurowych 2025"
              style={{
                width: "100%",
                padding: "8px",
                border: "1px solid #ddd",
                borderRadius: "4px",
                fontSize: "14px"
              }}
            />
          </div>

          <div style={{ marginBottom: "15px" }}>
            <label style={{ display: "block", marginBottom: "6px", fontWeight: 600 }}>
              Typ *
            </label>
            <select
              value={formType}
              onChange={(e) => setFormType(e.target.value as "LINK" | "ATTACHMENT")}
              style={{
                width: "100%",
                padding: "8px",
                border: "1px solid #ddd",
                borderRadius: "4px",
                fontSize: "14px"
              }}
            >
              <option value="LINK">Link do pobrania</option>
              <option value="ATTACHMENT">Załącznik (plik)</option>
            </select>
          </div>

          {formType === "LINK" ? (
            <div style={{ marginBottom: "15px" }}>
              <label style={{ display: "block", marginBottom: "6px", fontWeight: 600 }}>
                URL *
              </label>
              <input
                type="url"
                value={formUrl}
                onChange={(e) => setFormUrl(e.target.value)}
                placeholder="https://example.com/katalog.pdf"
                style={{
                  width: "100%",
                  padding: "8px",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                  fontSize: "14px"
                }}
              />
            </div>
          ) : (
            <>
              <div style={{ marginBottom: "15px" }}>
                <label style={{ display: "block", marginBottom: "6px", fontWeight: 600 }}>
                  Wybierz plik z dysku *
                </label>
                <input
                  id="material-file-input"
                  type="file"
                  onChange={handleFileSelect}
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif"
                  style={{
                    width: "100%",
                    padding: "8px",
                    border: "1px solid #ddd",
                    borderRadius: "4px",
                    fontSize: "14px",
                    backgroundColor: "white"
                  }}
                />
                {selectedFile && (
                  <div style={{ marginTop: "8px", padding: "8px", backgroundColor: "#e8f5e9", borderRadius: "4px", fontSize: "13px" }}>
                    ✓ Wybrano: <strong>{selectedFile.name}</strong> ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                  </div>
                )}
                {uploadingFile && (
                  <div style={{ marginTop: "8px", color: "#666", fontSize: "13px" }}>
                    ⏳ Uploadowanie pliku...
                  </div>
                )}
              </div>
            </>
          )}

          <div style={{ marginBottom: "15px" }}>
            <label style={{ display: "block", marginBottom: "6px", fontWeight: 600 }}>
              Kolejność
            </label>
            <input
              type="number"
              value={formOrder}
              onChange={(e) => setFormOrder(parseInt(e.target.value) || 0)}
              style={{
                width: "120px",
                padding: "8px",
                border: "1px solid #ddd",
                borderRadius: "4px",
                fontSize: "14px"
              }}
            />
          </div>

          <div style={{ display: "flex", gap: "10px" }}>
            <button
              onClick={editingMaterial ? () => handleUpdate(editingMaterial) : handleAdd}
              disabled={uploadingFile}
              style={{
                padding: "10px 20px",
                backgroundColor: uploadingFile ? "#ccc" : "#2196f3",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: uploadingFile ? "not-allowed" : "pointer",
                fontWeight: 600
              }}
            >
              {uploadingFile ? "Uploadowanie..." : editingMaterial ? "Zapisz zmiany" : "Dodaj"}
            </button>
            <button
              onClick={resetForm}
              style={{
                padding: "10px 20px",
                backgroundColor: "#6c757d",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer"
              }}
            >
              Anuluj
            </button>
          </div>
        </div>
      )}

      {materials.length === 0 && !showAddForm ? (
        <div style={{ 
          padding: "20px", 
          backgroundColor: "#f8f9fa", 
          borderRadius: "8px", 
          textAlign: "center",
          border: "2px dashed #ddd"
        }}>
          <p style={{ color: "#666", fontStyle: "italic", marginBottom: "15px" }}>
            Brak materiałów. Dodaj pierwszy materiał klikając przycisk powyżej.
          </p>
          <button
            onClick={() => setShowAddForm(true)}
            style={{
              padding: "10px 20px",
              backgroundColor: "#4caf50",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: "14px"
            }}
          >
            + Dodaj pierwszy materiał
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {materials.map((material) => (
            <div
              key={material.id}
              style={{
                padding: "15px",
                border: "1px solid #ddd",
                borderRadius: "6px",
                backgroundColor: material.isActive ? "white" : "#f8f9fa",
                opacity: material.isActive ? 1 : 0.7
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "8px" }}>
                    <strong>{material.name}</strong>
                    <span
                      style={{
                        padding: "2px 8px",
                        backgroundColor: material.type === "LINK" ? "#e3f2fd" : "#fff3e0",
                        color: material.type === "LINK" ? "#1976d2" : "#f57c00",
                        borderRadius: "4px",
                        fontSize: "12px",
                        fontWeight: 600
                      }}
                    >
                      {material.type === "LINK" ? "Link" : "Załącznik"}
                    </span>
                    {!material.isActive && (
                      <span style={{ color: "#999", fontSize: "12px" }}>(nieaktywny)</span>
                    )}
                  </div>
                  {material.type === "LINK" && material.url && (
                    <div style={{ fontSize: "13px", color: "#666", marginBottom: "4px" }}>
                      <a href={material.url} target="_blank" rel="noopener noreferrer" style={{ color: "#1976d2" }}>
                        {material.url}
                      </a>
                    </div>
                  )}
                  {material.type === "ATTACHMENT" && (
                    <div style={{ fontSize: "13px", color: "#666" }}>
                      {material.fileName || material.filePath || "brak nazwy"}
                    </div>
                  )}
                  <div style={{ fontSize: "12px", color: "#999", marginTop: "4px" }}>
                    Kolejność: {material.order}
                  </div>
                </div>
                <div style={{ display: "flex", gap: "6px" }}>
                  <button
                    onClick={() => handleToggleActive(material)}
                    style={{
                      padding: "6px 12px",
                      backgroundColor: material.isActive ? "#ff9800" : "#4caf50",
                      color: "white",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                      fontSize: "12px"
                    }}
                  >
                    {material.isActive ? "Deaktywuj" : "Aktywuj"}
                  </button>
                  <button
                    onClick={() => startEdit(material)}
                    style={{
                      padding: "6px 12px",
                      backgroundColor: "#2196f3",
                      color: "white",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                      fontSize: "12px"
                    }}
                  >
                    Edytuj
                  </button>
                  <button
                    onClick={() => handleDelete(material.id)}
                    style={{
                      padding: "6px 12px",
                      backgroundColor: "#f44336",
                      color: "white",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                      fontSize: "12px"
                    }}
                  >
                    Usuń
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

