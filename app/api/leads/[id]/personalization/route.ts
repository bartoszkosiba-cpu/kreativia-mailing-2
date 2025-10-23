import { NextRequest } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const leadId = Number(params.id);
    if (Number.isNaN(leadId)) {
      return new Response(JSON.stringify({ error: "Invalid lead ID" }), { status: 400 });
    }

    const { personalization } = await req.json();
    if (!personalization || typeof personalization !== "string") {
      return new Response(JSON.stringify({ error: "Personalization text required" }), { status: 400 });
    }

    await db.lead.update({
      where: { id: leadId },
      data: { personalization }
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { 
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

