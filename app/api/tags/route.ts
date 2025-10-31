import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

const TagSchema = z.object({
  name: z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  description: z.string().optional()
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    
    // Jeśli jest parametr count, zwróć tylko liczbę użyć dla tagu
    const countTagId = searchParams.get("count");
    if (countTagId) {
      const tagId = parseInt(countTagId);
      if (!isNaN(tagId)) {
        const count = await db.leadTag.count({
          where: { tagId }
        });
        return new Response(JSON.stringify({ count }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
    }

    const tags = await db.tag.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: { LeadTag: true }
        }
      }
    });

    return new Response(JSON.stringify(tags), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Błąd pobierania tagów:", error);
    return new Response(JSON.stringify({ error: "Wystąpił błąd podczas pobierania tagów" }), { 
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const data = TagSchema.parse({
      name: formData.get("name"),
      color: formData.get("color"),
      description: formData.get("description") || undefined
    });

    const tag = await db.tag.create({
      data: {
        name: data.name,
        color: data.color,
        description: data.description
      }
    });

    // Sprawdź czy to request z AJAX (import CSV) czy zwykły formularz
    const contentType = req.headers.get("content-type");
    const isAjaxRequest = contentType && contentType.includes("multipart/form-data");

    if (isAjaxRequest) {
      // Zwróć JSON dla AJAX requests (import CSV)
      return new Response(JSON.stringify(tag), { 
        status: 201,
        headers: { "Content-Type": "application/json" }
      });
    } else {
      // Redirect dla zwykłych formularzy
      return new Response(null, { 
        status: 302, 
        headers: { Location: "/tags" }
      });
    }
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { 
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tagId = searchParams.get("id");

    if (!tagId) {
      return new Response(JSON.stringify({ error: "Brak ID tagu" }), { 
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const tagIdNum = parseInt(tagId);
    if (isNaN(tagIdNum)) {
      return new Response(JSON.stringify({ error: "Nieprawidłowe ID tagu" }), { 
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Sprawdź czy tag istnieje
    const tag = await db.tag.findUnique({
      where: { id: tagIdNum },
      include: {
        _count: {
          select: { LeadTag: true }
        }
      }
    });

    if (!tag) {
      return new Response(JSON.stringify({ error: "Tag nie został znaleziony" }), { 
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Sprawdź czy tag jest używany przez leadów
    const usageCount = tag._count.LeadTag;
    if (usageCount > 0) {
      return new Response(JSON.stringify({ 
        error: "Nie można usunąć tagu",
        message: `Tag jest używany przez ${usageCount} ${usageCount === 1 ? 'leada' : usageCount < 5 ? 'leadów' : 'leadów'}. Najpierw usuń tag z leadów.`
      }), { 
        status: 409, // Conflict
        headers: { "Content-Type": "application/json" }
      });
    }

    // Usuń tag (najpierw relacje LeadTag - na wszelki wypadek, choć nie powinno być żadnych)
    await db.leadTag.deleteMany({
      where: { tagId: tagIdNum }
    });

    await db.tag.delete({
      where: { id: tagIdNum }
    });

    return new Response(JSON.stringify({ 
      success: true,
      message: "Tag został usunięty"
    }), { 
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (e: any) {
    console.error("Błąd usuwania tagu:", e);
    return new Response(JSON.stringify({ error: e.message || "Wystąpił błąd podczas usuwania tagu" }), { 
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

