"use client";

import { useState, useEffect } from "react";

interface ScheduleItem {
  emailNumber: number;
  time: string;
  delayFromPrevious: number;
  delayMin?: number;
  delayMax?: number;
}

interface NextEmailTimeData {
  isActive: boolean;
  nextEmailTime: string | null;
  delaySeconds: number;
  emailsPerDay: number;
  sentToday: number;
  remainingEmailsToday: number;
  timeRemainingInWindow: number;
  lastSentAt: string;
  message: string;
  reason?: string;
  schedule?: ScheduleItem[];
}

interface Props {
  campaignId: number;
}

export default function NextEmailTime({ campaignId }: Props) {
  const [data, setData] = useState<NextEmailTimeData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(`/api/campaigns/${campaignId}/next-email-time`);
        const result = await response.json();
        setData(result);
      } catch (error) {
        console.error("Błąd pobierania czasu następnego maila:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 30000); // Odświeżaj co 30 sekund

    return () => clearInterval(interval);
  }, [campaignId]);

  if (loading) {
    return (
      <div style={{
        padding: "16px",
        backgroundColor: "#f8f9fa",
        borderRadius: "8px",
        border: "1px solid #dee2e6",
        marginBottom: "20px"
      }}>
        <p style={{ margin: 0, color: "#6c757d" }}>Sprawdzanie...</p>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  if (!data.isActive) {
    return (
      <div style={{
        padding: "16px",
        backgroundColor: "#fff3cd",
        borderRadius: "8px",
        border: "1px solid #ffc107",
        marginBottom: "20px"
      }}>
        <h4 style={{ margin: "0 0 8px 0", fontSize: "16px", fontWeight: 600 }}>
          Status wysyłki
        </h4>
        <p style={{ margin: 0, color: "#856404" }}>
          {data.message || "Kampania nie jest w trakcie wysyłki"}
        </p>
        {data.reason && (
          <p style={{ margin: "8px 0 0 0", fontSize: "14px", color: "#856404" }}>
            Powód: {data.reason}
          </p>
        )}
      </div>
    );
  }

  const nextTime = data.nextEmailTime ? new Date(data.nextEmailTime) : null;

  return (
    <div style={{
      padding: "20px",
      backgroundColor: "#e8f5e9",
      borderRadius: "8px",
      border: "2px solid #4caf50",
      marginBottom: "20px"
    }}>
      <h4 style={{ margin: "0 0 12px 0", fontSize: "18px", fontWeight: 600, color: "#2e7d32" }}>
        Następny mail
      </h4>
      
      {nextTime && (
        <div style={{ marginBottom: "16px" }}>
          <div style={{ fontSize: "24px", fontWeight: 700, color: "#1b5e20", marginBottom: "4px" }}>
            {nextTime.toLocaleTimeString('pl-PL', { 
              hour: '2-digit', 
              minute: '2-digit', 
              second: '2-digit' 
            })}
          </div>
          <div style={{ fontSize: "14px", color: "#2e7d32" }}>
            {nextTime.toLocaleDateString('pl-PL', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric'
            })}
          </div>
        </div>
      )}

      {data.schedule && data.schedule.length > 0 && (
        <div style={{ 
          marginTop: "16px",
          paddingTop: "16px",
          borderTop: "1px solid #c8e6c9"
        }}>
          <h5 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: 600, color: "#2e7d32" }}>
            Harmonogram kolejnych 5 maili
          </h5>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #c8e6c9" }}>
                <th style={{ padding: "8px", textAlign: "left", color: "#2e7d32", fontWeight: 600 }}>Mail</th>
                <th style={{ padding: "8px", textAlign: "left", color: "#2e7d32", fontWeight: 600 }}>Godzina (średnia)</th>
                <th style={{ padding: "8px", textAlign: "right", color: "#2e7d32", fontWeight: 600 }}>Delay</th>
              </tr>
            </thead>
            <tbody>
              {data.schedule.map((item, index) => (
                <tr key={index} style={{ borderBottom: index < data.schedule!.length - 1 ? "1px solid #f1f8e9" : "none" }}>
                  <td style={{ padding: "8px", color: "#1b5e20" }}>#{item.emailNumber}</td>
                  <td style={{ padding: "8px", color: "#1b5e20", fontWeight: 500 }}>{item.time}</td>
                  <td style={{ padding: "8px", textAlign: "right", color: "#2e7d32", fontSize: "12px" }}>
                    {item.delayFromPrevious > 0 ? (
                      item.delayMin && item.delayMax ? (
                        <span title={`Rzeczywisty delay będzie losowy: ${item.delayMin}-${item.delayMax}s (średnio ${item.delayFromPrevious}s)`}>
                          +{item.delayMin}s - +{item.delayMax}s
                          <br />
                          <span style={{ fontSize: "11px", color: "#66bb6a" }}>(średnio +{item.delayFromPrevious}s)</span>
                        </span>
                      ) : `+${item.delayFromPrevious}s`
                    ) : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ 
        display: "grid", 
        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", 
        gap: "12px",
        marginTop: "16px",
        paddingTop: "16px",
        borderTop: "1px solid #c8e6c9"
      }}>
        <div>
          <div style={{ fontSize: "12px", color: "#2e7d32", marginBottom: "4px" }}>Dostępność dzisiaj</div>
          <div style={{ fontSize: "16px", fontWeight: 600, color: "#1b5e20" }}>
            {data.remainingEmailsToday} / {data.emailsPerDay} maili
          </div>
        </div>
        <div>
          <div style={{ fontSize: "12px", color: "#2e7d32", marginBottom: "4px" }}>Wysłano dzisiaj</div>
          <div style={{ fontSize: "16px", fontWeight: 600, color: "#1b5e20" }}>
            {data.sentToday} maili
          </div>
        </div>
        <div>
          <div style={{ fontSize: "12px", color: "#2e7d32", marginBottom: "4px" }}>Pozostało w oknie</div>
          <div style={{ fontSize: "16px", fontWeight: 600, color: "#1b5e20" }}>
            {data.timeRemainingInWindow} min
          </div>
        </div>
      </div>

      <div style={{ 
        marginTop: "12px", 
        paddingTop: "12px", 
        borderTop: "1px solid #c8e6c9",
        fontSize: "12px",
        color: "#2e7d32",
        display: "flex",
        gap: "16px",
        flexWrap: "wrap"
      }}>
        {data.lastSentAt && (
          <div>
            Ostatni mail wysłany: {new Date(data.lastSentAt).toLocaleString('pl-PL')}
          </div>
        )}
        {nextTime && (
          <div style={{ fontWeight: 600 }}>
            Następny mail zaplanowany: {nextTime.toLocaleString('pl-PL')}
          </div>
        )}
      </div>
    </div>
  );
}

