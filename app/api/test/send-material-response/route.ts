import { NextRequest, NextResponse } from "next/server";
import { sendScheduledMaterialResponses } from "@/services/materialResponseSender";

/**
 * POST /api/test/send-material-response - Ręczne wywołanie wysyłki zaplanowanych odpowiedzi z materiałami
 * Endpoint do testowania - wywołuje sendScheduledMaterialResponses natychmiast
 */
export async function POST(req: NextRequest) {
  try {
    console.log("[TEST API] Ręczne wywołanie sendScheduledMaterialResponses...");
    
    const sentCount = await sendScheduledMaterialResponses();
    
    return NextResponse.json({
      success: true,
      sentCount,
      message: `Wysłano ${sentCount} odpowiedzi z materiałami`
    });
  } catch (error: any) {
    console.error("[TEST API] Błąd:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

