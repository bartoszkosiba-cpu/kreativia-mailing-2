import { NextRequest } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const leadId = Number(params.id);
    if (Number.isNaN(leadId)) {
      return new Response(JSON.stringify({ error: "Invalid lead ID" }), { status: 400 });
    }

    const formData = await req.formData();
    const tagIds = formData.getAll("tagIds").map(id => Number(id));

    // Usuń wszystkie istniejące tagi dla tego leada
    await db.leadTag.deleteMany({
      where: { leadId }
    });

    // Dodaj nowe tagi
    if (tagIds.length > 0) {
      await db.leadTag.createMany({
        data: tagIds.map(tagId => ({
          leadId,
          tagId
        }))
      });
    }

    return new Response(null, { 
      status: 302, 
      headers: { Location: `/leads/${leadId}` }
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { 
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

