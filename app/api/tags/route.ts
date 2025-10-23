import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

const TagSchema = z.object({
  name: z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  description: z.string().optional()
});

export async function GET() {
  try {
    const tags = await db.tag.findMany({
      orderBy: { name: "asc" }
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

