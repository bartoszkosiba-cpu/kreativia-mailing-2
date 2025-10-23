import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { morfeuszService } from "@/services/morfeuszService";

export async function GET() {
  try {
    const leads = await db.lead.findMany({
      include: {
        LeadTag: {
          include: {
            tag: true
          }
        },
        CampaignLead: {
          select: {
            id: true,
            campaignId: true,
            status: true,
            priority: true,
            createdAt: true
          }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    return NextResponse.json(leads);
  } catch (error) {
    console.error("Błąd pobierania leadów:", error);
    return NextResponse.json({ error: "Wystąpił błąd podczas pobierania leadów" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();

    if (!data.email) {
      return NextResponse.json({ error: "Email jest wymagany" }, { status: 400 });
    }

    // Sprawdź czy email już istnieje
    const existing = await db.lead.findFirst({
      where: { email: data.email }
    });

    if (existing) {
      return NextResponse.json({ error: "Lead z tym emailem już istnieje" }, { status: 400 });
    }

    // Pobierz odmianę imienia
    const greetingForm = data.firstName 
      ? await morfeuszService.getGreetingForm(data.firstName, data.language || "pl")
      : "Dzień dobry";

    const lead = await db.lead.create({
      data: {
        firstName: data.firstName || null,
        lastName: data.lastName || null,
        title: data.title || null,
        company: data.company || null,
        email: data.email,
        industry: data.industry || null,
        websiteUrl: data.websiteUrl || null,
        linkedinUrl: data.linkedinUrl || null,
        companyCity: data.companyCity || null,
        companyCountry: data.companyCountry || null,
        language: data.language || "pl",
        greetingForm: greetingForm
      }
    });

    return NextResponse.json(lead, { status: 201 });
  } catch (error) {
    console.error("Błąd dodawania leada:", error);
    return NextResponse.json({ error: "Wystąpił błąd podczas dodawania leada" }, { status: 500 });
  }
}
