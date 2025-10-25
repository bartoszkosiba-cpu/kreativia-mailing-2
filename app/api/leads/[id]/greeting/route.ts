import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const leadId = Number(params.id);
    
    if (Number.isNaN(leadId)) {
      return NextResponse.json({ error: "Invalid lead ID" }, { status: 400 });
    }

    const { greetingForm } = await request.json();

    // Walidacja danych
    if (greetingForm !== null && typeof greetingForm !== "string") {
      return NextResponse.json({ error: "Greeting form must be a string or null" }, { status: 400 });
    }

    // Sprawdź czy lead istnieje
    const existingLead = await db.lead.findUnique({
      where: { id: leadId }
    });

    if (!existingLead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    // Aktualizuj powitanie
    const updatedLead = await db.lead.update({
      where: { id: leadId },
      data: { 
        greetingForm: greetingForm?.trim() || null 
      },
      select: {
        id: true,
        greetingForm: true
      }
    });

    return NextResponse.json({
      message: "Powitanie zaktualizowane pomyślnie",
      greetingForm: updatedLead.greetingForm
    });

  } catch (error) {
    console.error("Error updating greeting:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
