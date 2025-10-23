import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const {
      name,
      description,
      subject,
      text,
      jobDescription,
      postscript,
      linkText,
      linkUrl,
      dailyLimit = 200,
      contentVersionId,
      savedContentId
    } = body;

    // Walidacja
    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Nazwa kampanii jest wymagana" }, { status: 400 });
    }

    // Utwórz kampanię
    const campaign = await db.campaign.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        subject: subject?.trim() || null,
        text: text?.trim() || null,
        jobDescription: jobDescription?.trim() || null,
        postscript: postscript?.trim() || null,
        linkText: linkText?.trim() || null,
        linkUrl: linkUrl?.trim() || null,
        dailyLimit: parseInt(dailyLimit) || 200,
        contentVersionId: contentVersionId ? parseInt(contentVersionId) : null, // DEPRECATED
        savedContentId: savedContentId ? parseInt(savedContentId) : null, // NOWE
        status: "DRAFT"
      }
    });

    // Zwiększ licznik użycia dla SavedContent
    if (savedContentId) {
      await db.savedContent.update({
        where: { id: parseInt(savedContentId) },
        data: {
          usageCount: { increment: 1 },
          lastUsedAt: new Date()
        }
      });
    }

    return NextResponse.json({ 
      message: "Kampania utworzona pomyślnie",
      id: campaign.id,
      name: campaign.name
    });

  } catch (error: any) {
    console.error("Error creating campaign:", error);
    return NextResponse.json({ 
      error: "Błąd tworzenia kampanii", 
      details: error.message 
    }, { status: 500 });
  }
}