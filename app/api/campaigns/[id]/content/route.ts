import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const campaignId = Number(params.id);
    if (Number.isNaN(campaignId)) {
      return NextResponse.json({ error: "Nieprawidłowe ID kampanii" }, { status: 400 });
    }

    const { subject, text, jobDescription, postscript, linkText, linkUrl } = await req.json();

    if (typeof subject !== "string" || typeof text !== "string") {
      return NextResponse.json({ error: "Nieprawidłowy format danych" }, { status: 400 });
    }

    const campaign = await db.campaign.update({
      where: { id: campaignId },
      data: {
        subject: subject.trim() || null,
        text: text.trim() || null,
        jobDescription: jobDescription?.trim() || null,
        postscript: postscript?.trim() || null,
        linkText: linkText?.trim() || null,
        linkUrl: linkUrl?.trim() || null,
      },
    });

    return NextResponse.json({ 
      message: "Kampania zaktualizowana pomyślnie",
      campaign
    });

  } catch (error) {
    console.error("Błąd aktualizacji kampanii:", error);
    return NextResponse.json({ error: "Wystąpił błąd podczas aktualizacji kampanii" }, { status: 500 });
  }
}
