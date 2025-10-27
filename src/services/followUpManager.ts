// Serwis do zarządzania automatycznymi follow-upami
import { db } from "@/lib/db";

/**
 * Tworzy automatyczną kampanię follow-up
 */
export async function createFollowUpCampaign(
  parentCampaignId: number,
  followUpDays: number,
  followUpText: string,
  followUpSubject: string
): Promise<number> {
  // Pobierz kampanię nadrzędną
  const parentCampaign = await db.campaign.findUnique({
    where: { id: parentCampaignId },
    include: {
      CampaignLead: {
        include: { lead: true }
      },
      virtualSalesperson: true
    }
  });

  if (!parentCampaign) {
    throw new Error("Nie znaleziono kampanii nadrzędnej");
  }

  // Oblicz datę wysyłki follow-up (po zakończeniu nadrzędnej + X dni)
  const scheduledDate = parentCampaign.sendingCompletedAt
    ? new Date(parentCampaign.sendingCompletedAt)
    : new Date();
  scheduledDate.setDate(scheduledDate.getDate() + followUpDays);

  // Stwórz nową kampanię follow-up
  const followUpCampaign = await db.campaign.create({
    data: {
      name: `${parentCampaign.name} - Follow-up`,
      description: `Automatyczny follow-up po ${followUpDays} dniach`,
      subject: followUpSubject,
      text: followUpText,
      jobDescription: parentCampaign.jobDescription,
      postscript: parentCampaign.postscript,
      linkText: parentCampaign.linkText,
      linkUrl: parentCampaign.linkUrl,
      virtualSalespersonId: parentCampaign.virtualSalespersonId,
      isFollowUp: true,
      parentCampaignId: parentCampaignId,
      followUpDays: followUpDays,
      status: "SCHEDULED",
      scheduledAt: scheduledDate,
      allowedDays: parentCampaign.allowedDays,
      startHour: parentCampaign.startHour,
      endHour: parentCampaign.endHour,
      delayBetweenEmails: parentCampaign.delayBetweenEmails,
      maxEmailsPerDay: parentCampaign.maxEmailsPerDay,
      respectHolidays: parentCampaign.respectHolidays,
      targetCountries: parentCampaign.targetCountries
    }
  });

  console.log(`[FOLLOW-UP] Utworzono kampanię follow-up ${followUpCampaign.id} dla kampanii ${parentCampaignId}`);

  // Dodaj leady, którzy NIE odpowiedzieli
  const leadsWithoutResponse = await getLeadsWithoutResponse(parentCampaignId);

  if (leadsWithoutResponse.length > 0) {
    await db.campaignLead.createMany({
      data: leadsWithoutResponse.map(lead => ({
        campaignId: followUpCampaign.id,
        leadId: lead.id
      }))
    });

    console.log(`[FOLLOW-UP] Dodano ${leadsWithoutResponse.length} leadów do follow-up`);
  }

  return followUpCampaign.id;
}

/**
 * Pobiera leady, którzy nie odpowiedzieli na kampanię
 */
export async function getLeadsWithoutResponse(campaignId: number) {
  const campaign = await db.campaign.findUnique({
    where: { id: campaignId },
    include: {
      CampaignLead: {
        include: {
          lead: {
            include: {
              replies: {
                where: {
                  campaignId: campaignId
                }
              }
            }
          }
        }
      }
    }
  });

  if (!campaign) return [];

  // Filtruj leady: nie zablokowani + bez odpowiedzi
  return campaign.CampaignLead
    .map(cl => cl.lead)
    .filter(lead => 
      !lead.isBlocked && 
      lead.replies.length === 0
    );
}

/**
 * Sprawdza czy kampania może mieć follow-up
 */
export async function canCreateFollowUp(campaignId: number): Promise<boolean> {
  const campaign = await db.campaign.findUnique({
    where: { id: campaignId },
    include: {
      followUpCampaigns: true
    }
  });

  if (!campaign) return false;

  // Nie można tworzyć follow-up jeśli:
  // - kampania nie jest zakończona
  // - kampania sama jest follow-upem
  // - już ma follow-up
  return (
    campaign.status === "COMPLETED" &&
    !campaign.isFollowUp &&
    campaign.followUpCampaigns.length === 0
  );
}

/**
 * Automatycznie tworzy follow-upy dla zakończonych kampanii
 */
export async function autoCreateFollowUps(): Promise<void> {
  console.log('[FOLLOW-UP] Sprawdzam kampanie do follow-up...');

  // Znajdź zakończone kampanie bez follow-upów
  const completedCampaigns = await db.campaign.findMany({
    where: {
      status: "COMPLETED",
      isFollowUp: false,
      sendingCompletedAt: {
        not: null,
        // Zakończone co najmniej followUpDays dni temu
        lte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      }
    },
    include: {
      followUpCampaigns: true
    }
  });

  const campaignsNeedingFollowUp = completedCampaigns.filter(c => c.followUpCampaigns.length === 0);

  console.log(`[FOLLOW-UP] Znaleziono ${campaignsNeedingFollowUp.length} kampanii do follow-up`);

  for (const campaign of campaignsNeedingFollowUp) {
    try {
      // Sprawdź czy są leady bez odpowiedzi
      const leadsWithoutResponse = await getLeadsWithoutResponse(campaign.id);

      if (leadsWithoutResponse.length === 0) {
        console.log(`[FOLLOW-UP] Kampania ${campaign.id}: wszyscy odpowiedzieli, pomijam`);
        continue;
      }

      // Utwórz follow-up z domyślną treścią
      const followUpSubject = `Re: ${campaign.subject || ""}`;
      const followUpText = `Witam ponownie,\n\nZastanawiam się, czy miał/miała Pan/Pani okazję zapoznać się z moją poprzednią wiadomością?\n\n${campaign.text || ""}`;

      await createFollowUpCampaign(
        campaign.id,
        campaign.followUpDays,
        followUpText,
        followUpSubject
      );

      console.log(`[FOLLOW-UP] ✓ Utworzono follow-up dla kampanii ${campaign.id}`);
    } catch (error: any) {
      console.error(`[FOLLOW-UP] ✗ Błąd dla kampanii ${campaign.id}:`, error.message);
    }
  }
}

