// Serwis do wysyłki codziennego raportu emailem
import { db } from "@/lib/db";
import { getDailySummaryReport, getCampaignStats } from "./campaignStats";
import { createSmtpTransport } from "@/integrations/smtp/client";

/**
 * Generuje HTML dla dziennego raportu
 */
function generateReportHTML(report: any, campaigns: any[]): string {
  const campaignsHTML = campaigns.map(c => `
    <div style="margin-bottom: 20px; padding: 15px; background: #f8f9fa; border-radius: 8px;">
      <h3 style="margin: 0 0 10px 0;">${c.campaignName}</h3>
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;">
        <div>📧 <strong>Wysłane:</strong> ${c.totalSent} / ${c.totalLeads}</div>
        <div>💬 <strong>Odpowiedzi:</strong> ${c.totalReplies} (${c.replyRate}%)</div>
        <div>😊 <strong>Zainteresowani:</strong> ${c.interested}</div>
      </div>
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 10px;">
        <div>🚫 <strong>Unsubscribe:</strong> ${c.unsubscribe}</div>
        <div>🏖️ <strong>OOO:</strong> ${c.outOfOffice}</div>
        <div>🆕 <strong>Nowe leady:</strong> ${c.newLeadsCreated}</div>
      </div>
    </div>
  `).join('');

  const salespeopleHTML = report.salespeople.map((sp: any) => `
    <tr>
      <td style="padding: 10px; border: 1px solid #ddd;">${sp.salespersonName}</td>
      <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${sp.sentToday} / ${sp.dailyLimit}</td>
      <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${sp.remaining}</td>
      <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${sp.repliesToday}</td>
      <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${sp.interestedToday}</td>
      <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${sp.activeCampaigns}</td>
    </tr>
  `).join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Raport dzienny - Kreativia Mailing</title>
</head>
<body style="font-family: Arial, sans-serif; background: #f5f5f5; padding: 20px;">
  <div style="max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px;">
    <h1 style="margin-top: 0; color: #333;">📊 Raport dzienny - ${new Date(report.date).toLocaleDateString("pl-PL")}</h1>
    
    <!-- Podsumowanie -->
    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 30px;">
      <div style="padding: 20px; background: #e8f5e9; border-radius: 8px; text-align: center;">
        <div style="font-size: 14px; color: #666;">📧 Wysłane</div>
        <div style="font-size: 32px; font-weight: bold; color: #4caf50;">${report.totalSent}</div>
      </div>
      <div style="padding: 20px; background: #e3f2fd; border-radius: 8px; text-align: center;">
        <div style="font-size: 14px; color: #666;">💬 Odpowiedzi</div>
        <div style="font-size: 32px; font-weight: bold; color: #2196f3;">${report.totalReplies}</div>
        <div style="font-size: 12px; color: #999;">${report.replyRate}% wskaźnik</div>
      </div>
      <div style="padding: 20px; background: #fff3e0; border-radius: 8px; text-align: center;">
        <div style="font-size: 14px; color: #666;">😊 Zainteresowani</div>
        <div style="font-size: 32px; font-weight: bold; color: #ff9800;">${report.totalInterested}</div>
        <div style="font-size: 12px; color: #999;">${report.interestRate}% konwersja</div>
      </div>
    </div>

    <!-- Kampanie -->
    ${campaigns.length > 0 ? `
      <h2>📋 Kampanie (${campaigns.length})</h2>
      ${campaignsHTML}
    ` : ''}

    <!-- Handlowcy -->
    <h2>👥 Handlowcy (${report.salespeople.length})</h2>
    <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
      <thead>
        <tr style="background: #f5f5f5;">
          <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Handlowiec</th>
          <th style="padding: 10px; border: 1px solid #ddd;">Wysłane</th>
          <th style="padding: 10px; border: 1px solid #ddd;">Pozostało</th>
          <th style="padding: 10px; border: 1px solid #ddd;">Odpowiedzi</th>
          <th style="padding: 10px; border: 1px solid #ddd;">Zainteresowani</th>
          <th style="padding: 10px; border: 1px solid #ddd;">Aktywne</th>
        </tr>
      </thead>
      <tbody>
        ${salespeopleHTML}
      </tbody>
    </table>

    <div style="margin-top: 30px; padding: 15px; background: #f5f5f5; border-radius: 4px; font-size: 12px; color: #666;">
      Raport wygenerowany automatycznie przez Kreativia Mailing<br>
      Data: ${new Date().toLocaleString("pl-PL")}
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Wysyła dzienny raport emailem
 */
export async function sendDailyReportEmail(date?: Date): Promise<void> {
  const targetDate = date || new Date();
  console.log(`[REPORT] Wysyłam raport dzienny za ${targetDate.toLocaleDateString("pl-PL")}...`);

  // Pobierz raport
  const report = await getDailySummaryReport(targetDate);

  // Pobierz statystyki aktywnych kampanii z tego dnia
  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);

  const campaigns = await db.campaign.findMany({
    where: {
      OR: [
        {
          sendingStartedAt: {
            gte: startOfDay,
            lte: endOfDay
          }
        },
        {
          status: "IN_PROGRESS"
        }
      ]
    }
  });

  const campaignStats = await Promise.all(
    campaigns.map(c => getCampaignStats(c.id))
  );

  // Pobierz email do wysyłki z ustawień
  const settings = await db.companySettings.findFirst();
  const recipientEmail = settings?.forwardEmail;

  if (!recipientEmail) {
    console.log('[REPORT] Brak adresu email do wysyłki raportu (forwardEmail w ustawieniach)');
    return;
  }

  // Wygeneruj HTML
  const htmlContent = generateReportHTML(report, campaignStats);

  // Wyślij email
  const transport = createSmtpTransport();

  await transport.sendMail({
    from: settings?.companyName ? `"${settings.companyName}" <${process.env.SMTP_USER}>` : process.env.SMTP_USER,
    to: recipientEmail,
    subject: `📊 Raport dzienny - ${targetDate.toLocaleDateString("pl-PL")} - Kreativia Mailing`,
    html: htmlContent
  });

  console.log(`[REPORT] ✓ Raport wysłany do ${recipientEmail}`);
}

