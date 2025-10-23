"use client";

import { useState } from "react";

interface CampaignSchedulerProps {
  campaignId: number;
  currentStatus: string;
  scheduledAt: string | null;
  allowedDays: string;
  startHour: number;
  endHour: number;
  delayBetweenEmails: number;
  maxEmailsPerHour: number;
  respectHolidays: boolean;
  targetCountries: string | null;
  leadsCount: number;
}

export default function CampaignScheduler({
  campaignId,
  currentStatus,
  scheduledAt,
  allowedDays,
  startHour,
  endHour,
  delayBetweenEmails,
  maxEmailsPerHour,
  respectHolidays,
  targetCountries,
  leadsCount
}: CampaignSchedulerProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [status, setStatus] = useState(currentStatus);
  
  // Funkcja pomocnicza do konwersji Date/string na datetime-local format
  // TRAKTUJEMY UTC jako lokalny czas (bez konwersji timezone)
  const toLocalDateTimeString = (dateValue: string | Date | null) => {
    if (!dateValue) return "";
    
    // Konwertuj na string jeśli to Date object
    const dateString = typeof dateValue === 'string' ? dateValue : dateValue.toISOString();
    
    // Parsuj bezpośrednio ze stringa bez konwersji timezone
    // "2025-12-20T10:00:00.000Z" -> "2025-12-20T10:00"
    return dateString.slice(0, 16);
  };
  
  const [schedule, setSchedule] = useState({
    scheduledAt: toLocalDateTimeString(scheduledAt),
    allowedDays: allowedDays.split(","),
    startHour,
    endHour,
    delayBetweenEmails,
    maxEmailsPerHour,
    respectHolidays,
    targetCountries: targetCountries || ""
  });
  const [isSaving, setIsSaving] = useState(false);

  const dayOptions = [
    { value: "MON", label: "Pon" },
    { value: "TUE", label: "Wt" },
    { value: "WED", label: "Śr" },
    { value: "THU", label: "Czw" },
    { value: "FRI", label: "Pt" },
    { value: "SAT", label: "Sob" },
    { value: "SUN", label: "Ndz" }
  ];

  const toggleDay = (day: string) => {
    const newDays = schedule.allowedDays.includes(day)
      ? schedule.allowedDays.filter(d => d !== day)
      : [...schedule.allowedDays, day];
    setSchedule({ ...schedule, allowedDays: newDays });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Konwertuj lokalny datetime-local na ISO string TRAKTUJĄC GO JAKO UTC
      // aby uniknąć problemów z timezone
      let scheduledAtISO = null;
      if (schedule.scheduledAt) {
        // Parsuj jako string: "2025-12-20T10:00" -> zapisz jako "2025-12-20T10:00:00.000Z"
        // bez konwersji timezone
        const [datePart, timePart] = schedule.scheduledAt.split('T');
        scheduledAtISO = `${datePart}T${timePart}:00.000Z`;
      }
      
      const response = await fetch(`/api/campaigns/${campaignId}/schedule`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...schedule,
          allowedDays: schedule.allowedDays.join(","),
          scheduledAt: scheduledAtISO
        })
      });

      if (!response.ok) throw new Error("Błąd zapisu");

      const data = await response.json();
      setStatus(data.status);
      setIsEditing(false);
      alert("✅ Harmonogram zaktualizowany!");
      
      // Odśwież stronę aby pokazać poprawną datę
      window.location.reload();
    } catch (error) {
      alert("❌ Błąd zapisu harmonogramu");
    } finally {
      setIsSaving(false);
    }
  };

  const estimatedDuration = () => {
    const totalSeconds = leadsCount * schedule.delayBetweenEmails;
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    return `${hours}h ${minutes}min`;
  };

  const getStatusBadge = () => {
    const badges: Record<string, { color: string; bg: string; label: string }> = {
      DRAFT: { color: "#666", bg: "#f0f0f0", label: "Szkic" },
      SCHEDULED: { color: "#0066cc", bg: "#e3f2fd", label: "Zaplanowana" },
      SENDING: { color: "#ff9800", bg: "#fff3e0", label: "Wysyłka..." },
      COMPLETED: { color: "#4caf50", bg: "#e8f5e9", label: "Zakończona" },
      CANCELLED: { color: "#f44336", bg: "#ffebee", label: "Anulowana" },
      PAUSED: { color: "#9c27b0", bg: "#f3e5f5", label: "Wstrzymana" }
    };

    const badge = badges[status] || badges.DRAFT;

    return (
      <span style={{
        padding: "4px 12px",
        borderRadius: 16,
        fontSize: 14,
        fontWeight: "bold",
        color: badge.color,
        backgroundColor: badge.bg
      }}>
        {badge.label}
      </span>
    );
  };

  return (
    <div style={{ marginBottom: 20, padding: 20, backgroundColor: "#f8f9fa", borderRadius: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>📅 Harmonogram wysyłki</h2>
        {getStatusBadge()}
      </div>

      {!isEditing ? (
        <div>
          <div style={{ marginBottom: 12 }}>
            <p style={{ margin: "8px 0" }}>
              <strong>Status:</strong> {getStatusBadge()}
            </p>
            {schedule.scheduledAt && (
              <p style={{ margin: "8px 0" }}>
                <strong>Zaplanowana na:</strong> {new Date(schedule.scheduledAt).toLocaleString("pl-PL")}
              </p>
            )}
            <p style={{ margin: "8px 0" }}>
              <strong>Dni wysyłki:</strong> {schedule.allowedDays.map(d => dayOptions.find(o => o.value === d)?.label).join(", ")}
            </p>
            <p style={{ margin: "8px 0" }}>
              <strong>Okno czasowe:</strong> {schedule.startHour}:00 - {schedule.endHour}:00
            </p>
            <p style={{ margin: "8px 0" }}>
              <strong>Opóźnienie między mailami:</strong> {schedule.delayBetweenEmails}s
            </p>
            <p style={{ margin: "8px 0" }}>
              <strong>Max maili/h:</strong> {schedule.maxEmailsPerHour}
            </p>
            <p style={{ margin: "8px 0" }}>
              <strong>Święta:</strong> {schedule.respectHolidays ? "Uwzględniane" : "Ignorowane"}
              {schedule.respectHolidays && schedule.targetCountries && ` (${schedule.targetCountries})`}
            </p>
            <p style={{ margin: "8px 0", color: "#666" }}>
              <strong>Szacowany czas:</strong> {estimatedDuration()} dla {leadsCount} leadów
            </p>
          </div>

          <button
            onClick={() => setIsEditing(true)}
            disabled={status === "SENDING" || status === "COMPLETED"}
            style={{
              padding: "10px 20px",
              backgroundColor: status === "SENDING" || status === "COMPLETED" ? "#ccc" : "#0066cc",
              color: "white",
              border: "none",
              borderRadius: 4,
              cursor: status === "SENDING" || status === "COMPLETED" ? "not-allowed" : "pointer"
            }}
          >
            ⚙️ Edytuj harmonogram
          </button>
        </div>
      ) : (
        <div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", marginBottom: 4, fontWeight: "bold" }}>
              📆 Data i godzina wysyłki:
            </label>
            <input
              type="datetime-local"
              value={schedule.scheduledAt}
              onChange={(e) => setSchedule({ ...schedule, scheduledAt: e.target.value })}
              style={{ padding: 8, width: "100%", maxWidth: 300, borderRadius: 4, border: "1px solid #ddd" }}
            />
            <p style={{ fontSize: 12, color: "#666", margin: "4px 0" }}>
              Pozostaw puste aby wysłać natychmiast po kliknięciu "Wyślij"
            </p>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", marginBottom: 8, fontWeight: "bold" }}>
              📅 Dozwolone dni tygodnia:
            </label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {dayOptions.map(day => (
                <button
                  key={day.value}
                  onClick={() => toggleDay(day.value)}
                  style={{
                    padding: "8px 16px",
                    backgroundColor: schedule.allowedDays.includes(day.value) ? "#0066cc" : "#f0f0f0",
                    color: schedule.allowedDays.includes(day.value) ? "white" : "#666",
                    border: "none",
                    borderRadius: 4,
                    cursor: "pointer"
                  }}
                >
                  {day.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            <div>
              <label style={{ display: "block", marginBottom: 4, fontWeight: "bold" }}>
                🕐 Początek okna:
              </label>
              <input
                type="number"
                min="0"
                max="23"
                value={schedule.startHour}
                onChange={(e) => setSchedule({ ...schedule, startHour: Number(e.target.value) })}
                style={{ padding: 8, width: "100%", borderRadius: 4, border: "1px solid #ddd" }}
              />
            </div>
            <div>
              <label style={{ display: "block", marginBottom: 4, fontWeight: "bold" }}>
                🕐 Koniec okna:
              </label>
              <input
                type="number"
                min="0"
                max="23"
                value={schedule.endHour}
                onChange={(e) => setSchedule({ ...schedule, endHour: Number(e.target.value) })}
                style={{ padding: 8, width: "100%", borderRadius: 4, border: "1px solid #ddd" }}
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            <div>
              <label style={{ display: "block", marginBottom: 4, fontWeight: "bold" }}>
                ⏱️ Opóźnienie (sekundy):
              </label>
              <input
                type="number"
                min="30"
                max="300"
                value={schedule.delayBetweenEmails}
                onChange={(e) => setSchedule({ ...schedule, delayBetweenEmails: Number(e.target.value) })}
                style={{ padding: 8, width: "100%", borderRadius: 4, border: "1px solid #ddd" }}
              />
            </div>
            <div>
              <label style={{ display: "block", marginBottom: 4, fontWeight: "bold" }}>
                📧 Max maili/h:
              </label>
              <input
                type="number"
                min="10"
                max="200"
                value={schedule.maxEmailsPerHour}
                onChange={(e) => setSchedule({ ...schedule, maxEmailsPerHour: Number(e.target.value) })}
                style={{ padding: 8, width: "100%", borderRadius: 4, border: "1px solid #ddd" }}
              />
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="checkbox"
                checked={schedule.respectHolidays}
                onChange={(e) => setSchedule({ ...schedule, respectHolidays: e.target.checked })}
              />
              <span style={{ fontWeight: "bold" }}>🎄 Uwzględniaj święta</span>
            </label>
          </div>

          {schedule.respectHolidays && (
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", marginBottom: 4, fontWeight: "bold" }}>
                🌍 Kraje (kody, oddzielone przecinkami):
              </label>
              <input
                type="text"
                placeholder="PL,DE,FR,GB"
                value={schedule.targetCountries}
                onChange={(e) => setSchedule({ ...schedule, targetCountries: e.target.value })}
                style={{ padding: 8, width: "100%", borderRadius: 4, border: "1px solid #ddd" }}
              />
              <p style={{ fontSize: 12, color: "#666", margin: "4px 0" }}>
                Przykład: PL (Polska), DE (Niemcy), FR (Francja), GB (Wielka Brytania)
              </p>
            </div>
          )}

          <div style={{ padding: 12, backgroundColor: "#e3f2fd", borderRadius: 4, marginBottom: 16 }}>
            <p style={{ margin: 0, fontSize: 14 }}>
              <strong>⏱️ Szacowany czas wysyłki:</strong> {estimatedDuration()} dla {leadsCount} leadów
            </p>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={handleSave}
              disabled={isSaving}
              style={{
                padding: "10px 20px",
                backgroundColor: "#4caf50",
                color: "white",
                border: "none",
                borderRadius: 4,
                cursor: isSaving ? "wait" : "pointer"
              }}
            >
              {isSaving ? "Zapisuję..." : "💾 Zapisz"}
            </button>
            <button
              onClick={() => setIsEditing(false)}
              disabled={isSaving}
              style={{
                padding: "10px 20px",
                backgroundColor: "#f0f0f0",
                color: "#666",
                border: "none",
                borderRadius: 4,
                cursor: "pointer"
              }}
            >
              Anuluj
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

