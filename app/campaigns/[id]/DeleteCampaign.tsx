"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  campaignId: number;
  campaignName: string;
}

export default function DeleteCampaign({ campaignId, campaignName }: Props) {
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();

  const handleDelete = async () => {
    const confirmed = confirm(
      `CZY NA PEWNO chcesz usunąć kampanię "${campaignName}"?\n\n` +
      `To usunie:\n` +
      `- Wszystkie logi wysyłki\n` +
      `- Wszystkie odpowiedzi\n` +
      `- Wszystkie powiązania z leadami\n\n` +
      `TEJ OPERACJI NIE MOŻNA COFNĄĆ!`
    );

    if (!confirmed) return;

    // Dodatkowe potwierdzenie
    const doubleConfirm = confirm(
      `Ostatnie potwierdzenie!\n\nNapisz OK aby usunąć kampanię "${campaignName}"`
    );

    if (!doubleConfirm) return;

    try {
      setIsDeleting(true);

      const response = await fetch(`/api/campaigns/${campaignId}`, {
        method: "DELETE"
      });

      const data = await response.json();

      if (response.ok) {
        alert("Kampania została usunięta");
        router.push("/campaigns");
      } else {
        alert(`Błąd: ${data.error}`);
      }
    } catch (error: any) {
      alert(`Błąd: ${error.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="card" style={{ 
      marginTop: "var(--spacing-2xl)", 
      borderColor: "var(--danger)",
      backgroundColor: "#fff5f5"
    }}>
      <h3 style={{ color: "var(--danger)", marginBottom: "var(--spacing-md)" }}>
        Strefa niebezpieczna
      </h3>
      <p style={{ marginBottom: "var(--spacing-md)", color: "var(--gray-600)" }}>
        Usunięcie kampanii jest nieodwracalne. Wszystkie dane związane z tą kampanią zostaną trwale usunięte.
      </p>
      <button
        className="btn"
        style={{
          backgroundColor: "#dc3545",
          color: "white",
          fontWeight: "bold",
          borderColor: "#dc3545"
        }}
        onClick={handleDelete}
        disabled={isDeleting}
      >
        {isDeleting ? "Usuwanie..." : "Usuń kampanię"}
      </button>
    </div>
  );
}

