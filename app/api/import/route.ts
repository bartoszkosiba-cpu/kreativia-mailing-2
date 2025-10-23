import { NextRequest } from "next/server";
import { z } from "zod";

// Mapowanie krajów na języki
function getLanguageFromCountry(country: string | null | undefined): string {
  if (!country) return 'pl';
  
  const countryLower = country.toLowerCase().trim();
  
  // Kraje niemieckojęzyczne
  if (['germany', 'deutschland', 'niemcy', 'austria', 'österreich', 'austria', 'switzerland', 'schweiz', 'suisse', 'szwajcaria'].includes(countryLower)) {
    return 'de';
  }
  
  // Kraje francuskojęzyczne
  if (['france', 'frankreich', 'francja', 'belgium', 'belgique', 'belgia', 'switzerland', 'schweiz', 'suisse', 'szwajcaria'].includes(countryLower)) {
    return 'fr';
  }
  
  // Kraje anglojęzyczne
  if (['united kingdom', 'uk', 'great britain', 'britain', 'wielka brytania', 'brytania', 'united states', 'usa', 'us', 'america', 'stany zjednoczone', 'usa', 'canada', 'kanada', 'australia', 'australia'].includes(countryLower)) {
    return 'en';
  }
  
  // Kraje używające angielskiego w B2B (nowe)
  if (['netherlands', 'holland', 'holandia', 'belgium', 'belgique', 'belgia', 'switzerland', 'schweiz', 'suisse', 'szwajcaria', 'sweden', 'szwecja', 'denmark', 'dania', 'norway', 'norwegia', 'finland', 'finlandia'].includes(countryLower)) {
    return 'en';
  }
  
  // Kraje polskojęzyczne
  if (['poland', 'polska', 'polen'].includes(countryLower)) {
    return 'pl';
  }
  
  // Domyślnie polski
  return 'pl';
}

function getGreetingByLanguage(language: string): string {
  switch (language.toLowerCase()) {
    case 'de':
      return 'Guten Tag';
    case 'en':
      return 'Hello';
    case 'fr':
      return 'Bonjour';
    case 'pl':
    default:
      return 'Dzień dobry';
  }
}

const LeadSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  title: z.string().optional(),
  company: z.string().optional(),
  email: z.string().email(),
  industry: z.string().optional(),
  keywords: z.string().optional(),
  linkedinUrl: z.string().optional(),
  website: z.string().optional(),
  companyCity: z.string().optional(),
  companyCountry: z.string().optional()
});

const BodySchema = z.object({
  campaignName: z.string().min(1),
  template: z.string().min(1),
  rows: z.array(LeadSchema).min(1)
});

export async function POST(req: NextRequest) {
  try {
    const { db } = await import("@/lib/db");
    const body = BodySchema.parse(await req.json());
    const campaign = await db.campaign.create({
      data: { name: body.campaignName, description: null, gmailLabel: null, dailyLimit: 200 }
    });

    const { normalizeUrl } = await import("@/lib/url");
    // UPSERT leads, następnie powiąż z kampanią
    const upsertedLeadIds: number[] = [];
    for (const r of body.rows) {
      const language = getLanguageFromCountry(r.companyCountry);
      
      const existing = await db.lead.findFirst({ where: { email: r.email } });
      if (existing) {
        const updated = await db.lead.update({
          where: { id: existing.id },
          data: {
            firstName: r.firstName ?? null,
            lastName: r.lastName ?? null,
            title: r.title ?? null,
            company: r.company ?? null,
            industry: r.industry ?? null,
            keywords: r.keywords ?? null,
            linkedinUrl: normalizeUrl(r.linkedinUrl),
            websiteUrl: normalizeUrl(r.website),
            companyCity: r.companyCity ?? null,
            companyCountry: r.companyCountry ?? null,
            language: language
          }
        });
        upsertedLeadIds.push(updated.id);
      } else {
        const created = await db.lead.create({
          data: {
            firstName: r.firstName ?? null,
            lastName: r.lastName ?? null,
            title: r.title ?? null,
            company: r.company ?? null,
            email: r.email,
            industry: r.industry ?? null,
            keywords: r.keywords ?? null,
            linkedinUrl: normalizeUrl(r.linkedinUrl),
            websiteUrl: normalizeUrl(r.website),
            companyCity: r.companyCity ?? null,
            companyCountry: r.companyCountry ?? null,
            language: language,
            greetingForm: getGreetingByLanguage(language) // Greeting w odpowiednim języku
          }
        });
        upsertedLeadIds.push(created.id);
      }
    }

    // powiązanie z kampanią (CampaignLead)
    for (const leadId of upsertedLeadIds) {
      await db.campaignLead.upsert({
        where: { campaignId_leadId: { campaignId: campaign.id, leadId } },
        create: { campaignId: campaign.id, leadId },
        update: {}
      });
    }

    return new Response(JSON.stringify({ campaignId: campaign.id, leads: upsertedLeadIds.length }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (e: any) {
    const message = e?.issues ? JSON.stringify(e.issues) : e?.message || "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }
}

export async function GET() {
  return new Response(JSON.stringify({ ok: true, route: "api/import" }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}

