import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET - Pobierz statystyki dla dashboardu
export async function GET() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);

    // Aktywne kampanie - liczba
    const activeCampaigns = await db.campaign.count({
      where: {
        status: {
          in: ["SCHEDULED", "IN_PROGRESS"]
        }
      }
    });
    
    // Aktywne kampanie - szczegóły
    const activeCampaignsList = await db.campaign.findMany({
      where: {
        status: {
          in: ["SCHEDULED", "IN_PROGRESS"]
        }
      },
      include: {
        virtualSalesperson: {
          select: {
            name: true
          }
        },
        _count: {
          select: {
            CampaignLead: true,
            sendLogs: {
              where: {
                status: "sent"
              }
            }
          }
        }
      },
      orderBy: {
        scheduledAt: "asc"
      },
      take: 5 // Top 5 aktywnych
    });

    // Wszystkie leady
    const totalLeads = await db.lead.count({
      where: {
        status: {
          not: "BLOCKED"
        }
      }
    });

    // Wysłane dzisiaj
    const sentToday = await db.sendLog.count({
      where: {
        status: "sent",
        createdAt: {
          gte: today,
          lte: endOfDay
        }
      }
    });

    // Odpowiedzi dzisiaj
    const repliesToday = await db.inboxReply.count({
      where: {
        receivedAt: {
          gte: today,
          lte: endOfDay
        }
      }
    });

    // Zainteresowani dzisiaj
    const interestedToday = await db.inboxReply.count({
      where: {
        classification: "INTERESTED",
        receivedAt: {
          gte: today,
          lte: endOfDay
        }
      }
    });

    return NextResponse.json({
      activeCampaigns,
      activeCampaignsList,
      totalLeads,
      sentToday,
      repliesToday,
      interestedToday
    });
  } catch (error: any) {
    console.error("Błąd pobierania statystyk:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

