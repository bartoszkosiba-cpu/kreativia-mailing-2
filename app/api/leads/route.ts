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
    const withoutGreetings = searchParams.get('withoutGreetings') === 'true';
    const campaignId = searchParams.get('campaignId');
    const leadIdsParam = searchParams.get('leadIds'); // Parametr do pobierania konkretnych leadów po ID

    // Buduj warunki WHERE
    const whereConditions: any = {};
    
    // ✅ NOWE: Jeśli campaignId, to wyklucz leadów którzy już są w TEJ kampanii
    if (campaignId) {
      const leadsInCampaign = await db.campaignLead.findMany({
        where: { campaignId: parseInt(campaignId) },
        select: { leadId: true }
      });
      
      const excludeLeadIds = leadsInCampaign.map(cl => cl.leadId);
      if (excludeLeadIds.length > 0) {
        whereConditions.id = { notIn: excludeLeadIds };
      }
    }

    // ✅ NIE filtruj zablokowanych - użytkownik może je zobaczyć w liście statusów
    // (tylko w "dodaj leady do kampanii" filtrujemy na status=AKTYWNY)

    // Jeśli podano konkretne ID leadów, użyj ich zamiast innych filtrów
    if (leadIdsParam) {
      const leadIds = leadIdsParam.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
      if (leadIds.length > 0) {
        whereConditions.id = { in: leadIds };
        // Nie stosuj innych filtrów gdy pobieramy konkretne leady
      }
    } else if (search) {
      whereConditions.OR = [
        { firstName: { contains: search } },
        { lastName: { contains: search } },
        { email: { contains: search } },
        { company: { contains: search } },
        { industry: { contains: search } }
      ];
    }

    if (language) {
      whereConditions.language = language;
    }

    if (country) {
      whereConditions.companyCountry = { contains: country };
    }

    if (status) {
      whereConditions.status = status;
    }

    if (industry) {
      whereConditions.industry = { contains: industry };
    }

    if (tagId && tagId !== '') {
      const parsedTagId = parseInt(tagId);
      if (!isNaN(parsedTagId)) {
        whereConditions.LeadTag = {
          some: {
            tagId: parsedTagId
          }
        };
      }
    }

    if (withoutGreetings) {
      whereConditions.OR = [
        { status: "NO_GREETING" },
        { greetingForm: null },
        { greetingForm: "" },
        { greetingForm: "Dzień dobry" },
        { greetingForm: "Hello" },
        { greetingForm: "Guten Tag" },
        { greetingForm: "Bonjour" }
      ];
    }

    // Pobierz całkowitą liczbę leadów z filtrami
    const total = await db.lead.count({ where: whereConditions });

    // Pobierz leady z paginacją i filtrami
    const leads = await db.lead.findMany({
      where: whereConditions,
      include: {
        LeadTag: {
          include: {
            tag: true
          }
        }
      },
      orderBy: { createdAt: "desc" },
      skip: offset,
      take: limit
    });

    const totalPages = Math.ceil(total / limit);

    // Pobierz statystyki
    const stats = await getLeadStats();

    return NextResponse.json({
      leads,
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

// Funkcja do pobierania statystyk leadów
async function getLeadStats() {
  try {
    const total = await db.lead.count();

    // Statystyki krajów
    const countries = await db.lead.groupBy({
      by: ['companyCountry'],
      _count: { companyCountry: true },
      where: {
        companyCountry: { not: null }
      }
    }).then(results => 
      results.map(item => ({
        country: item.companyCountry || 'Nieznany',
        count: item._count.companyCountry
      }))
    );

    // Statystyki języków
    const languages = await db.lead.groupBy({
      by: ['language'],
      _count: { language: true }
    }).then(results => 
      results.map(item => ({
        language: item.language || 'pl',
        count: item._count.language
      }))
    );

    // Statystyki statusów
    const statuses = await db.lead.groupBy({
      by: ['status'],
      _count: { status: true }
    }).then(results => 
      results.map(item => ({
        status: item.status,
        count: item._count.status
      }))
    );

    // Statystyki branż
    const industries = await db.lead.groupBy({
      by: ['industry'],
      _count: { industry: true },
      where: {
        industry: { not: null }
      }
    }).then(results => 
      results.map(item => ({
        industry: item.industry || 'Nieznana',
        count: item._count.industry
      }))
    );

    // Statystyki powitań
    const greetingsWith = await db.lead.count({
      where: {
        greetingForm: { not: null }
      }
    });

    const greetingsWithout = total - greetingsWith;

    return {
      total,
      countries,
      languages,
      statuses,
      industries,
      greetings: {
        with: greetingsWith,
        without: greetingsWithout
      }
    };
  } catch (error) {
    console.error("Błąd pobierania statystyk:", error);
    return {
      total: 0,
      countries: [],
      languages: [],
      statuses: [],
      industries: [],
      greetings: { with: 0, without: 0 }
    };
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

    // Pobierz odmianę imienia - tylko jeśli nie jest NO_GREETING
    let greetingForm: string | null = null;
    
    if (data.status === 'NO_GREETING') {
      greetingForm = null;
    } else if (data.firstName) {
      // Ma imię - wygeneruj pełne powitanie
      greetingForm = await morfeuszService.getGreetingForm(data.firstName, data.language || "pl");
    } else {
      // Nie ma imienia - dodaj domyślne powitanie bez tytułu (Pan/Pani)
      const lang = data.language || "pl";
      if (lang === "en") greetingForm = "Hello,";
      else if (lang === "de") greetingForm = "Guten Tag,";
      else if (lang === "fr") greetingForm = "Bonjour,";
      else greetingForm = "Dzień dobry,";
    }

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
        greetingForm: greetingForm,
        status: data.status || "AKTYWNY"
      }
    });

    return NextResponse.json(lead, { status: 201 });
  } catch (error) {
    console.error("Błąd dodawania leada:", error);
    return NextResponse.json({ error: "Wystąpił błąd podczas dodawania leada" }, { status: 500 });
  }
}
