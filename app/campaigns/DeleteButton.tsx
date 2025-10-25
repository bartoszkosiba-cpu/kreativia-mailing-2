"use client";

import { useState } from "react";

interface Props {
  campaignId: number;
  campaignName: string;
  onDeleted: () => void;
}

export default function DeleteButton({ campaignId, campaignName, onDeleted }: Props) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const confirmed = confirm(
      `Czy na pewno chcesz usunąć kampanię "${campaignName}"?\n\nTa operacja jest nieodwracalna!`
    );

    if (!confirmed) return;

    try {
      setIsDeleting(true);

      const response = await fetch(`/api/campaigns/${campaignId}`, {
        method: "DELETE"
      });

      const data = await response.json();

      if (response.ok) {
        alert("✅ Kampania została usunięta");
        onDeleted();
      } else {
        alert(`❌ Błąd: ${data.error}`);
      }
    } catch (error: any) {
      alert(`❌ Błąd: ${error.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <button
      onClick={handleDelete}
      disabled={isDeleting}
      style={{
        padding: "4px 8px",
        backgroundColor: "var(--danger)",
        color: "white",
        border: "none",
        borderRadius: "4px",
        cursor: isDeleting ? "not-allowed" : "pointer",
        fontSize: "0.85rem",
        fontWeight: "600",
        opacity: isDeleting ? 0.6 : 1
      }}
      title="Usuń kampanię"
    >
      {isDeleting ? "..." : "Usuń"}
    </button>
  );
}

