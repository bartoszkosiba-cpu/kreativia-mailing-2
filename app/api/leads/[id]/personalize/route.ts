import { NextRequest } from "next/server";
import { generatePersonalization } from "@/integrations/ai/client";
import { db } from "@/lib/db";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const leadId = Number(params.id);
    if (Number.isNaN(leadId)) {
      return new Response(JSON.stringify({ error: "Invalid lead ID" }), { status: 400 });
    }

    const { campaignText } = await req.json();

    const lead = await db.lead.findUnique({
      where: { id: leadId },
      select: { 
        firstName: true, 
        lastName: true,
        company: true, 
        industry: true, 
        title: true,
        companyCity: true,
        companyCountry: true,
        language: true
      }
    });

    if (!lead) {
      return new Response(JSON.stringify({ error: "Lead not found" }), { status: 404 });
    }

    // Jeśli mamy tekst kampanii, personalizuj go
    if (campaignText) {
      const personalizedText = await generatePersonalization(
        lead.firstName,
        lead.lastName,
        lead.company,
        lead.industry,
        lead.title,
        lead.companyCity,
        lead.companyCountry,
        campaignText,
        lead.language || 'pl'
      );

      return new Response(JSON.stringify({ personalizedText }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Stara logika - tylko personalizacja
    const personalization = await generatePersonalization(
      lead.firstName,
      lead.lastName,
      lead.company,
      lead.industry,
      lead.title,
      lead.companyCity,
      lead.companyCountry
    );

    await db.lead.update({
      where: { id: leadId },
      data: { personalization }
    });

    return new Response(JSON.stringify({ personalization }), {
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

