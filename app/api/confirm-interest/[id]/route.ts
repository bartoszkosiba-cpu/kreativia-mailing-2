import { NextRequest, NextResponse } from "next/server";
import { confirmNotification } from "@/services/interestedLeadNotifier";

/**
 * GET /api/confirm-interest/[id] - potwierdzenie otrzymania powiadomienia
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const notificationId = parseInt(params.id);
    
    if (!notificationId || isNaN(notificationId)) {
      return NextResponse.json({ error: "Invalid notification ID" }, { status: 400 });
    }
    
    const confirmed = await confirmNotification(notificationId);
    
    if (confirmed) {
      // Przekieruj do strony potwierdzenia z sukcesem
      return NextResponse.redirect(new URL(`/confirm-interest/${notificationId}?status=success`, req.url));
    } else {
      return NextResponse.json({ error: "Failed to confirm notification" }, { status: 500 });
    }
    
  } catch (error: any) {
    console.error("Error confirming notification:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}



