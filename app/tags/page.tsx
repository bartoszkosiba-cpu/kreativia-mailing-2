import { db } from "@/lib/db";
import Link from "next/link";

export default async function TagsPage() {
  const tags = await db.tag.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { LeadTag: true } } }
  });

  return (
    <main className="container" style={{ paddingTop: "var(--spacing-xl)", paddingBottom: "var(--spacing-2xl)" }}>
      <h1>Zarządzanie tagami</h1>
      <p>System segmentacji kontaktów</p>
      <p>
        <Link href="/">← Strona główna</Link> | <Link href="/leads">Baza kontaktów</Link>
      </p>

      <div style={{ marginBottom: 20 }}>
        <h2>Dodaj nowy tag</h2>
        <form action="/api/tags" method="POST" style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input 
            name="name" 
            placeholder="Nazwa tagu (np. firmy targowe)" 
            required 
            style={{ padding: 8, minWidth: 200 }}
          />
          <input 
            name="color" 
            type="color" 
            defaultValue="#3B82F6" 
            style={{ width: 40, height: 40 }}
          />
          <input 
            name="description" 
            placeholder="Opis (opcjonalnie)" 
            style={{ padding: 8, minWidth: 200 }}
          />
          <button type="submit" style={{ padding: 8 }}>Dodaj tag</button>
        </form>
      </div>

      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>Kolor</th>
            <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>Nazwa</th>
            <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>Opis</th>
            <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>Kontakty</th>
            <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>Utworzono</th>
          </tr>
        </thead>
        <tbody>
          {tags.map((tag) => (
            <tr key={tag.id}>
              <td style={{ padding: 8 }}>
                <div style={{ 
                  width: 20, 
                  height: 20, 
                  backgroundColor: tag.color, 
                  borderRadius: 4,
                  display: "inline-block"
                }}></div>
              </td>
              <td style={{ padding: 8, fontWeight: "bold" }}>{tag.name}</td>
              <td style={{ padding: 8 }}>{tag.description || ""}</td>
              <td style={{ padding: 8 }}>{(tag as any)._count.LeadTag}</td>
              <td style={{ padding: 8 }}>{new Date(tag.createdAt).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {tags.length === 0 && (
        <p style={{ textAlign: "center", color: "#666", marginTop: 40 }}>
          Brak tagów. Dodaj pierwszy tag powyżej.
        </p>
      )}
    </main>
  );
}

