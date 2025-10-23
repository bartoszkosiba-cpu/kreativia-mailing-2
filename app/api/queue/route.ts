import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET - Pobierz globalną kolejkę kampanii
export async function GET() {
  try {
    const campaigns = await db.campaign.findMany({
      where: {
        status: {
          in: ["SCHEDULED", "IN_PROGRESS", "DRAFT"]
        }
      },
      include: {
        virtualSalesperson: {
          select: {
            id: true,
            name: true,
            dailyEmailLimit: true,
            currentDailySent: true
          }
        },
        CampaignLead: true,
        _count: {
          select: {
            sendLogs: {
              where: {
                status: "sent"
              }
            }
          }
        }
      },
      orderBy: [
        { virtualSalespersonId: "asc" },
        { queuePriority: "asc" }
      ]
    });

    const queue = campaigns.map(c => {
      const total = c.CampaignLead.length;
      const sent = c._count.sendLogs;
      const percentage = total > 0 ? Math.round((sent / total) * 100) : 0;
      
      return {
        id: c.id,
        name: c.name,
        status: c.status,
        queuePriority: c.queuePriority,
        scheduledAt: c.scheduledAt,
        estimatedStartDate: c.estimatedStartDate,
        estimatedEndDate: c.estimatedEndDate,
        leadsCount: total,
        sentCount: sent,
        percentage,
        salesperson: c.virtualSalesperson
      };
    });

    return NextResponse.json(queue);
  } catch (error: any) {
    console.error("Błąd pobierania kolejki:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

