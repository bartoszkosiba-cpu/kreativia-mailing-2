import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logger } from "@/services/logger";
import { enrichPerson } from "@/services/apolloService";

/**
 * POST /api/company-selection/personas/fetch-single-email
 * Pobiera email dla jednego leada z Apollo (zużywa 1 kredyt)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { leadId } = body;

    if (!leadId) {
      return NextResponse.json(
        { success: false, error: "Brak leadId" },
        { status: 400 }
      );
    }

    // Pobierz lead z bazy
    const lead = await (db as any).apolloEmployee.findUnique({
      where: { id: parseInt(leadId) },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            website: true,
          },
        },
      },
    });

    if (!lead) {
      return NextResponse.json(
        { success: false, error: "Lead nie został znaleziony" },
        { status: 404 }
      );
    }

    if (!lead.apolloPersonId) {
      return NextResponse.json(
        { success: false, error: "Brak Apollo Person ID dla tego leada" },
        { status: 400 }
      );
    }

    // Pobierz email z Apollo (zużywa 1 kredyt)
    logger.info("apollo-fetch-single-email", `Pobieranie emaila dla leada ${leadId} (ZUŻYWA 1 KREDYT!)`, {
      leadId,
      apolloPersonId: lead.apolloPersonId,
    });

    // Przygotuj dane organizacji z bazy (jeśli dostępne) - przyspieszy fallback
    const organizationInfo = lead.company?.website 
      ? { domain: lead.company.website.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0] }
      : undefined;

    let enrichedPerson;
    try {
      enrichedPerson = await enrichPerson(lead.apolloPersonId, organizationInfo);
    } catch (error: any) {
      logger.error("apollo-fetch-single-email", "Błąd wywołania enrichPerson", { leadId, apolloPersonId: lead.apolloPersonId }, error);
      return NextResponse.json(
        { 
          success: false, 
          error: "Nie udało się pobrać emaila z Apollo",
          details: error.message || String(error)
        },
        { status: 500 }
      );
    }

    // Sprawdź, czy email został pobrany (może być null jeśli Apollo nie ma dostępu)
    if (!enrichedPerson) {
      return NextResponse.json(
        { success: false, error: "Apollo nie zwróciło danych osoby" },
        { status: 500 }
      );
    }

    // Email może być null/undefined jeśli Apollo nie ma dostępu do emaila
    const email = enrichedPerson.email;
    const emailStatus = enrichedPerson.email_status || enrichedPerson.contact_email_status;
    
    if (!email || email === "email_not_unlocked@domain.com") {
      logger.warn("apollo-fetch-single-email", `Email nie jest dostępny dla leada ${leadId}`, {
        leadId,
        apolloPersonId: lead.apolloPersonId,
        emailStatus,
        hasEmail: !!email,
      });
      
      return NextResponse.json(
        { 
          success: false, 
          error: emailStatus === "unavailable" 
            ? "Email nie jest dostępny w bazie Apollo dla tej osoby"
            : "Email nie został odblokowany w Apollo. Może wymagać dodatkowych uprawnień API lub kredytów.",
          emailStatus: emailStatus || "unknown",
          details: "Apollo zwróciło dane osoby, ale bez adresu email. Sprawdź uprawnienia API i dostępne kredyty."
        },
        { status: 400 }
      );
    }

    // Zaktualizuj lead w bazie
    await (db as any).apolloEmployee.update({
      where: { id: lead.id },
      data: {
        email: email,
        emailStatus: enrichedPerson.email_status || enrichedPerson.contact_email_status || "verified",
        emailUnlocked: true,
        apolloFetchedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    logger.info("apollo-fetch-single-email", `Pobrano email dla leada ${leadId}`, {
      leadId,
      email: email,
      emailStatus: enrichedPerson.email_status || enrichedPerson.contact_email_status,
    });

    return NextResponse.json({
      success: true,
      email: email,
      emailStatus: enrichedPerson.email_status || enrichedPerson.contact_email_status || "verified",
      creditsUsed: 1,
      message: "Email został pobrany. Zużyto 1 kredyt Apollo.",
    });
  } catch (error: any) {
    logger.error("apollo-fetch-single-email", "Błąd pobierania emaila", {}, error);
    return NextResponse.json(
      {
        success: false,
        error: "Błąd pobierania emaila",
        details: error.message,
      },
      { status: 500 }
    );
  }
}

