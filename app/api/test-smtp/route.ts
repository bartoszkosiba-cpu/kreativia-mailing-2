import { NextRequest } from "next/server";
import { sendTestEmail } from "@/integrations/smtp/client";

export async function POST(req: NextRequest) {
  try {
    const { to } = await req.json();
    if (!to || typeof to !== "string") {
      return new Response(JSON.stringify({ error: "Brak prawidłowego adresu e-mail" }), { status: 400 });
    }
    const { messageId, accepted } = await sendTestEmail(to);
    return new Response(JSON.stringify({ messageId, accepted }), { status: 200 });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message ?? "Unknown error" }), { status: 500 });
  }
}



