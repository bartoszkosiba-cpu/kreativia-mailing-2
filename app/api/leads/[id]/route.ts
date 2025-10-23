import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const leadId = Number(params.id);
    
    if (Number.isNaN(leadId)) {
      return NextResponse.json({ error: "Invalid lead ID" }, { status: 400 });
    }

    const lead = await db.lead.findUnique({
      where: { id: leadId },
      include: {
        CampaignLead: {
          include: {
            campaign: true
          }
        },
        LeadTag: {
          include: {
            tag: true
          }
        },
        SendLog: {
          orderBy: { createdAt: "desc" },
          take: 10
        },
        replies: {
          orderBy: { receivedAt: "desc" }
        }
      }
    });

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    return NextResponse.json(lead);
  } catch (error) {
    console.error("Error fetching lead:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
