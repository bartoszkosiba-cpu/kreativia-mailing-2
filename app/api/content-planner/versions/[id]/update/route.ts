import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// PUT - Aktualizuj treść wersji (ręczna edycja)
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const versionId = parseInt(params.id);
    const { subject, content, userFeedback } = await req.json();

    const version = await db.campaignVersion.update({
      where: { id: versionId },
      data: {
        subject,
        content,
        userFeedback: userFeedback || null,
        updatedAt: new Date()
      }
    });

    return NextResponse.json({
      success: true,
      version
    });
  } catch (error: any) {
    console.error("Błąd aktualizacji wersji:", error);
    return NextResponse.json(
      { error: "Błąd aktualizacji wersji", details: error.message },
      { status: 500 }
    );
  }
}

