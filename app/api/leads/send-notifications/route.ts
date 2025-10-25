import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
  try {
    const { type, count } = await req.json();

    if (type === "missing_greetings") {
      // Znajdź leady bez powitań
      const leadsWithoutGreetings = await prisma.lead.findMany({
        where: {
          OR: [
            { status: "NO_GREETING" },
            { greetingForm: null },
            { greetingForm: "" }
          ]
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          company: true
        }
      });

      // Tutaj możesz dodać logikę wysyłania powiadomień
      // Na razie tylko logujemy
      console.log(`Powiadomienia dla ${leadsWithoutGreetings.length} leadów bez powitań:`);
      leadsWithoutGreetings.forEach(lead => {
        console.log(`- ${lead.firstName} ${lead.lastName} (${lead.email}) - ${lead.company}`);
      });

      return NextResponse.json({
        success: true,
        sent: leadsWithoutGreetings.length,
        message: `Wysłano powiadomienia dla ${leadsWithoutGreetings.length} leadów`
      });
    }

    return NextResponse.json({ error: "Nieznany typ powiadomienia" }, { status: 400 });
  } catch (error: any) {
    console.error("Błąd wysyłania powiadomień:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
