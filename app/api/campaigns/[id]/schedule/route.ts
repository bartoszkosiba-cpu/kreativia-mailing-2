import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// PUT - Zaktualizuj harmonogram kampanii
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const campaignId = Number(params.id);
    const data = await req.json();

    // Zaktualizuj kampanię
    const campaign = await db.campaign.update({
      where: { id: campaignId },
      data: {
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
        allowedDays: data.allowedDays,
        startHour: data.startHour,
        startMinute: data.startMinute || 0,
        endHour: data.endHour,
        endMinute: data.endMinute || 0,
        delayBetweenEmails: data.delayBetweenEmails,
        maxEmailsPerHour: data.maxEmailsPerHour,
        respectHolidays: data.respectHolidays,
        targetCountries: data.targetCountries || null,
        status: data.scheduledAt ? "SCHEDULED" : "DRAFT"
      }
    });

    return NextResponse.json(campaign);
  } catch (error: any) {
    console.error("Błąd aktualizacji harmonogramu:", error);
    return NextResponse.json(
      { error: error.message || "Wystąpił błąd" },
      { status: 500 }
    );
  }
}

