// Serwis do statystyk kampanii
import { db } from "@/lib/db";

export interface CampaignStats {
  campaignId: number;
  campaignName: string;
  
  // Leady
  totalLeads: number;
  
  // Wysyłka
  totalSent: number;
  totalErrors: number;
  sentPercentage: number;
  
  // Odpowiedzi
  totalReplies: number;
  replyRate: number;
  
  // Klasyfikacja odpowiedzi
  interested: number;
  notInterested: number;
  unsubscribe: number;
  outOfOffice: number;
  redirect: number;
  bounce: number;
  other: number;
  
  // Akcje
  newLeadsCreated: number; // Nowi leady z zainteresowanych odpowiedzi
  contactsBlocked: number;
  repliesForwarded: number;
  
  // Daty
  startDate: Date | null;
  endDate: Date | null;
  lastActivity: Date | null;
}

/**
 * Pobiera statystyki dla pojedynczej kampanii
 */
export async function getCampaignStats(campaignId: number): Promise<CampaignStats> {
  const campaign = await db.campaign.findUnique({
    where: { id: campaignId },
    include: {
      CampaignLead: {
        where: {
          lead: {
            status: {
              not: "BLOCKED" // Licz tylko aktywne leady
            }
          }
        },
        include: {
          lead: true
        }
      },
      sendLogs: true,
      replies: true
    }
  });

  if (!campaign) {
    throw new Error("Nie znaleziono kampanii");
  }

  const totalLeads = campaign.CampaignLead.length;
  const sentLogs = campaign.sendLogs.filter(log => log.status === "sent");
  const errorLogs = campaign.sendLogs.filter(log => log.status === "error");
  const totalSent = sentLogs.length;
  const totalErrors = errorLogs.length;
  const totalReplies = campaign.replies.length;

  // Klasyfikacja odpowiedzi
  const interested = campaign.replies.filter(r => r.classification === "INTERESTED").length;
  const notInterested = campaign.replies.filter(r => r.classification === "NOT_INTERESTED").length;
  const unsubscribe = campaign.replies.filter(r => r.classification === "UNSUBSCRIBE").length;
  const outOfOffice = campaign.replies.filter(r => r.classification === "OOO").length;
  const redirect = campaign.replies.filter(r => r.classification === "REDIRECT").length;
  const bounce = campaign.replies.filter(r => r.classification === "BOUNCE").length;
  const other = campaign.replies.filter(r => 
    !["INTERESTED", "NOT_INTERESTED", "UNSUBSCRIBE", "OOO", "REDIRECT", "BOUNCE"].includes(r.classification || "")
  ).length;

  // Akcje
  const repliesForwarded = campaign.replies.filter(r => r.wasForwarded).length;
  const contactsBlocked = campaign.replies.filter(r => r.wasBlocked).length;
  const newLeadsCreated = campaign.replies.reduce((sum, r) => sum + (r.newContactsAdded || 0), 0);

  // Daty
  const sentDates = sentLogs.map(log => new Date(log.createdAt)).sort((a, b) => a.getTime() - b.getTime());
  const replyDates = campaign.replies.map(r => new Date(r.receivedAt)).sort((a, b) => a.getTime() - b.getTime());
  
  const startDate = sentDates.length > 0 ? sentDates[0] : null;
  const endDate = campaign.sendingCompletedAt || (sentDates.length > 0 ? sentDates[sentDates.length - 1] : null);
  const lastActivity = replyDates.length > 0 ? replyDates[replyDates.length - 1] : endDate;

  return {
    campaignId: campaign.id,
    campaignName: campaign.name,
    totalLeads,
    totalSent,
    totalErrors,
    sentPercentage: totalLeads > 0 ? Math.round((totalSent / totalLeads) * 100) : 0,
    totalReplies,
    replyRate: totalSent > 0 ? Math.round((totalReplies / totalSent) * 100) : 0,
    interested,
    notInterested,
    unsubscribe,
    outOfOffice,
    redirect,
    bounce,
    other,
    newLeadsCreated,
    contactsBlocked,
    repliesForwarded,
    startDate,
    endDate,
    lastActivity
  };
}

/**
 * Pobiera statystyki dzienne dla handlowca
 */
export async function getSalespersonDailyStats(salespersonId: number, date?: Date) {
  const targetDate = date || new Date();
  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);

  const salesperson = await db.virtualSalesperson.findUnique({
    where: { id: salespersonId },
    include: {
      campaigns: {
        include: {
          sendLogs: {
            where: {
              createdAt: {
                gte: startOfDay,
                lte: endOfDay
              }
            }
          },
          replies: {
            where: {
              receivedAt: {
                gte: startOfDay,
                lte: endOfDay
              }
            }
          }
        }
      }
    }
  });

  if (!salesperson) {
    return null;
  }

  const sentToday = salesperson.campaigns.reduce((sum, c) => 
    sum + c.sendLogs.filter(log => log.status === "sent").length, 0
  );

  const repliesToday = salesperson.campaigns.reduce((sum, c) => 
    sum + c.replies.length, 0
  );

  const interestedToday = salesperson.campaigns.reduce((sum, c) => 
    sum + c.replies.filter(r => r.classification === "INTERESTED").length, 0
  );

  return {
    salespersonId: salesperson.id,
    salespersonName: salesperson.name,
    date: targetDate,
    dailyLimit: salesperson.dailyEmailLimit,
    sentToday,
    remaining: Math.max(0, salesperson.dailyEmailLimit - sentToday),
    repliesToday,
    interestedToday,
    activeCampaigns: salesperson.campaigns.filter(c => 
      ["SCHEDULED", "IN_PROGRESS"].includes(c.status)
    ).length
  };
}

/**
 * Pobiera zbiorczy raport dzienny dla wszystkich handlowców
 */
export async function getDailySummaryReport(date?: Date) {
  const targetDate = date || new Date();
  
  const salespeople = await db.virtualSalesperson.findMany({
    where: { isActive: true }
  });

  const stats = await Promise.all(
    salespeople.map(sp => getSalespersonDailyStats(sp.id, targetDate))
  );

  const totalSent = stats.reduce((sum, s) => sum + (s?.sentToday || 0), 0);
  const totalReplies = stats.reduce((sum, s) => sum + (s?.repliesToday || 0), 0);
  const totalInterested = stats.reduce((sum, s) => sum + (s?.interestedToday || 0), 0);

  return {
    date: targetDate,
    salespeople: stats.filter(s => s !== null),
    totalSent,
    totalReplies,
    totalInterested,
    replyRate: totalSent > 0 ? Math.round((totalReplies / totalSent) * 100) : 0,
    interestRate: totalReplies > 0 ? Math.round((totalInterested / totalReplies) * 100) : 0
  };
}

