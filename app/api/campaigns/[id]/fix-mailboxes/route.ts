import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * Naprawia status skrzynek dla kampanii - zmienia inactive na completed
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const campaignId = parseInt(params.id);
    
    const campaign = await db.campaign.findUnique({
      where: { id: campaignId },
      include: {
        virtualSalesperson: {
          include: {
            mailboxes: {
              where: { isActive: true }
            }
          }
        }
      }
    });

    if (!campaign?.virtualSalesperson) {
      return NextResponse.json({ error: "Kampania lub handlowiec nie znaleziony" }, { status: 404 });
    }

    // Zmień wszystkie skrzynki z 'completed' na 'inactive' (przywróć oryginalny status)
    const updated = await db.mailbox.updateMany({
      where: {
        virtualSalespersonId: campaign.virtualSalesperson.id,
        isActive: true,
        warmupStatus: 'completed'
      },
      data: {
        warmupStatus: 'inactive'
      }
    });

    return NextResponse.json({
      success: true,
      message: `Przywrócono status ${updated.count} skrzynek z 'completed' na 'inactive' (limit: 10 maili/dzień)`,
      updatedCount: updated.count
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

