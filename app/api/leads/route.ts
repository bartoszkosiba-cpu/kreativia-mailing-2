import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { morfeuszService } from "@/services/morfeuszService";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;

    // Filtry
    const search = searchParams.get('search') || '';
    const language = searchParams.get('language') || '';
    const country = searchParams.get('country') || '';
    const status = searchParams.get('status') || '';
    const tagId = searchParams.get('tagId') || '';
    const industry = searchParams.get('industry') || '';

    // Pobierz całkowitą liczbę leadów
    const total = await db.lead.count();

    // Pobierz leady z paginacją
    const leads = await db.lead.findMany({
      orderBy: { createdAt: "desc" },
      skip: offset,
      take: limit
    });

    // Uproszczone - bez filtrowania tagów
    const filteredLeads = leads;

    const totalPages = Math.ceil(total / limit);

    // Pobierz statystyki (uproszczone)
    const stats = {
      total,
      countries: [],
      languages: [],
      statuses: [],
      industries: [],
      greetings: { with: 0, without: 0 }
    };

    return NextResponse.json({
      leads: filteredLeads,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      },
      stats
    });
  } catch (error) {
    console.error("Błąd pobierania leadów:", error);
    return NextResponse.json({ error: "Wystąpił błąd podczas pobierania leadów" }, { status: 500 });
  }
}

// Funkcja do pobierania statystyk leadów - usunięta

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
