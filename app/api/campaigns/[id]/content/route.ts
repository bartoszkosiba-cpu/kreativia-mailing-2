import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const campaignId = Number(params.id);
    if (Number.isNaN(campaignId)) {
      return NextResponse.json({ error: "Nieprawidłowe ID kampanii" }, { status: 400 });
    }

    const { 
      subject, text, jobDescription, postscript, linkText, linkUrl,
      abTestEnabled, abTestMode,
      subjectB, textB, jobDescriptionB, postscriptB, linkTextB, linkUrlB
    } = await req.json();

    // Debug payload (dev only)
    try {
      console.log("[API] /campaigns/", campaignId, "/content payload:", {
        subjectType: typeof subject,
        textType: typeof text,
        abTestEnabled,
        abTestMode,
        hasB: {
          subjectB: !!subjectB,
          textB: !!textB,
          jobDescriptionB: !!jobDescriptionB,
          postscriptB: !!postscriptB,
          linkTextB: !!linkTextB,
          linkUrlB: !!linkUrlB
        }
      });
    } catch {}

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
        // A/B Testing
        abTestEnabled: abTestEnabled === true || abTestEnabled === "true" ? true : false,
        abTestMode: abTestMode || null,
        subjectB: subjectB?.trim() || null,
        textB: textB?.trim() || null,
        jobDescriptionB: jobDescriptionB?.trim() || null,
        postscriptB: postscriptB?.trim() || null,
        linkTextB: linkTextB?.trim() || null,
        linkUrlB: linkUrlB?.trim() || null
      },
    });

    return NextResponse.json({ 
      message: "Kampania zaktualizowana pomyślnie",
      campaign
    });

  } catch (error: any) {
    console.error("Błąd aktualizacji kampanii:", error);
    return NextResponse.json({ error: "Wystąpił błąd podczas aktualizacji kampanii", details: error?.message || String(error) }, { status: 500 });
  }
}
