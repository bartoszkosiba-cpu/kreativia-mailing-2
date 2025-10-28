import { db } from "@/lib/db";
import nodemailer from "nodemailer";

interface NotificationData {
  replyId: number;
  leadId: number;
  campaignId?: number;
  salespersonEmail?: string; // Email handlowca (jeśli jest)
}

/**
 * Główna funkcja do wysyłki powiadomień o zainteresowanych leadach
 */
export async function sendInterestedLeadNotification(data: NotificationData): Promise<void> {
  try {
    console.log(`[NOTIFIER] Przygotowuję powiadomienie dla lead ${data.leadId}`);
    
    // Pobierz dane
    const reply = await db.inboxReply.findUnique({
      where: { id: data.replyId },
      include: { lead: true, campaign: { include: { virtualSalesperson: true } } }
    });
    
    if (!reply || !reply.lead) {
      console.error(`[NOTIFIER] Brak danych reply lub lead`);
      return;
    }
    
    // Pobierz ustawienia firmy
    const settings = await db.companySettings.findFirst();
    if (!settings) {
      console.error(`[NOTIFIER] Brak ustawień firmy`);
      return;
    }
    
    // Określ kto ma dostać powiadomienie
    const recipients: string[] = [];
    
    // 1. Handlowiec (jeśli jest przypisany)
    if (data.salespersonEmail) {
      recipients.push(data.salespersonEmail);
      console.log(`[NOTIFIER] Dodaję handlowca: ${data.salespersonEmail}`);
    }
    
    // 2. Email do powiadomień (ty) - zawsze
    if (settings.forwardEmail) {
      recipients.push(settings.forwardEmail);
      console.log(`[NOTIFIER] Dodaję email powiadomień: ${settings.forwardEmail}`);
    }
    
    if (recipients.length === 0) {
      console.log(`[NOTIFIER] Brak odbiorców powiadomienia`);
      return;
    }
    
    // Pobierz główną skrzynkę do wysyłki
    const mailbox = await getNotificationMailbox(reply.campaign);
    
    if (!mailbox) {
      console.error(`[NOTIFIER] Brak dostępnej skrzynki do wysyłki powiadomienia`);
      return;
    }
    
    console.log(`[NOTIFIER] Używam skrzynki: ${mailbox.email}`);
    
    // Określ czy to nowy lead (poza kampanią)
    const isNewLead = !data.campaignId || !reply.campaign;
    const isOnlyToMe = !data.salespersonEmail && isNewLead;
    
    // Zapisz powiadomienie do bazy NAJPIERW (żeby mieć ID)
    const notification = await db.interestedLeadNotification.create({
      data: {
        replyId: data.replyId,
        leadId: data.leadId,
        campaignId: data.campaignId || null,
        salespersonEmail: data.salespersonEmail || null,
        status: "PENDING"
      }
    });
    
    // Przygotuj treść emaila (z ID powiadomienia)
    const emailContent = prepareNotificationEmail(
      reply,
      data.salespersonEmail ? 'salesperson' : 'owner',
      isOnlyToMe,
      notification.id
    );
    
    // Wyślij powiadomienie do każdego odbiorcy
    for (const recipient of recipients) {
      const isForSalesperson = recipient === data.salespersonEmail;
      
      try {
        const transporter = nodemailer.createTransport({
          host: mailbox.smtpHost,
          port: mailbox.smtpPort || 587,
          secure: mailbox.smtpSecure,
          auth: {
            user: mailbox.smtpUser,
            pass: mailbox.smtpPass
          }
        });
        
        await transporter.sendMail({
          from: `"${reply.campaign?.virtualSalesperson?.name || 'Kreativia Mailing'}" <${mailbox.email}>`,
          to: recipient,
          subject: emailContent.subject,
          html: isForSalesperson ? emailContent.bodyWithButton : emailContent.body,
          replyTo: reply.lead.email // Odpowiedz bezpośrednio do leada
        });
        
        // Zapisz do SendLog dla archiwum
        try {
          await db.sendLog.create({
            data: {
              mailboxId: mailbox.id,
              leadId: reply.leadId,
              campaignId: reply.campaignId,
              toEmail: recipient, // NOWE: Zapisz odbiorcę powiadomienia
              subject: emailContent.subject,
              content: isForSalesperson ? emailContent.bodyWithButton : emailContent.body,
              status: "sent"
            }
          });
          console.log(`[NOTIFIER] ✅ Mail zapisany do archiwum`);
        } catch (logError) {
          console.error(`[NOTIFIER] ⚠️ Błąd zapisu do archiwum:`, logError);
          // Nie przerywamy procesu - mail został wysłany
        }
        
        console.log(`[NOTIFIER] ✅ Powiadomienie wysłane do: ${recipient}`);
        
      } catch (error) {
        console.error(`[NOTIFIER] ❌ Błąd wysyłki do ${recipient}:`, error);
      }
    }
    
    console.log(`[NOTIFIER] ✅ Powiadomienie zapisane do bazy`);
    
  } catch (error) {
    console.error(`[NOTIFIER] ❌ Błąd przygotowania powiadomienia:`, error);
  }
}

/**
 * Pobiera główną skrzynkę do wysyłki powiadomień
 */
async function getNotificationMailbox(campaign: any): Promise<any | null> {
  // 1. Spróbuj główną skrzynkę handlowca z kampanii
  if (campaign?.virtualSalesperson?.mainMailboxId) {
    const mailbox = await db.mailbox.findUnique({
      where: { id: campaign.virtualSalesperson.mainMailboxId }
    });
    
    if (mailbox && mailbox.isActive) {
      return mailbox;
    }
  }
  
  // 2. Spróbuj pierwszą aktywną skrzynkę handlowca
  if (campaign?.virtualSalespersonId) {
    const mailboxes = await db.mailbox.findMany({
      where: {
        virtualSalespersonId: campaign.virtualSalespersonId,
        isActive: true
      },
      orderBy: { createdAt: 'asc' }
    });
    
    if (mailboxes.length > 0) {
      return mailboxes[0];
    }
  }
  
  // 3. Fallback: użyj pierwszej aktywnej skrzynki w systemie
  const systemMailbox = await db.mailbox.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: 'asc' }
  });
  
  return systemMailbox;
}

/**
 * Przygotowuje treść emaila powiadomienia
 */
function prepareNotificationEmail(reply: any, recipientType: 'salesperson' | 'owner', isOnlyToMe: boolean, notificationId: number) {
  const lead = reply.lead;
  const campaign = reply.campaign;
  
  const subject = isOnlyToMe
    ? `[NOWY LEAD] ${lead.firstName || ''} ${lead.lastName || ''} - ${lead.company || ''}`
    : `[LEAD ZAINTERESOWANY] ${lead.firstName || ''} ${lead.lastName || ''} - ${lead.company || ''}`;
  
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  
  const confirmUrl = `${baseUrl}/confirm-interest/${notificationId}`;
  
  let bodyBase = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #007bff; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
    .content { background: #f8f9fa; padding: 20px; border-radius: 0 0 5px 5px; }
    .lead-info { background: white; padding: 15px; margin: 10px 0; border-radius: 5px; border-left: 4px solid #007bff; }
    .reply-box { background: white; padding: 15px; margin: 10px 0; border-radius: 5px; border-left: 4px solid #28a745; }
    .button { display: inline-block; background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 10px 0; }
    .summary { background: #fff3cd; padding: 15px; margin: 10px 0; border-radius: 5px; border-left: 4px solid #ffc107; }
    .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>${isOnlyToMe ? '🎯 NOWY ZAINTERESOWANY LEAD' : '🎯 LEAD ZAINTERESOWANY'}</h2>
    </div>
    
    <div class="content">
      ${isOnlyToMe ? `
      <div class="lead-info">
        <p><strong>Ten lead nie jest związany z żadną kampanią</strong> - wymaga Twojej szczególnej uwagi!</p>
      </div>
      ` : ''}
      
      <div class="lead-info">
        <h3>📋 DANE KONTAKTOWE:</h3>
        <p>
          <strong>Imię i nazwisko:</strong> ${lead.firstName || ''} ${lead.lastName || ''}<br>
          <strong>Firma:</strong> ${lead.company || 'N/A'}<br>
          <strong>Email:</strong> <a href="mailto:${lead.email}">${lead.email}</a><br>
          <strong>Stanowisko:</strong> ${lead.title || 'N/A'}<br>
          <strong>Branża:</strong> ${lead.industry || 'N/A'}<br>
          <strong>Kraj:</strong> ${lead.companyCountry || 'N/A'}
        </p>
      </div>
      
      ${campaign ? `
      <div class="lead-info">
        <h3>📊 KAMPANIA:</h3>
        <p><strong>Nazwa:</strong> ${campaign.name}<br>
        <strong>Handlowiec:</strong> ${campaign.virtualSalesperson?.name || 'N/A'}</p>
      </div>
      ` : ''}
      
      ${reply.aiSummary ? `
      <div class="summary">
        <h3>🤖 PODSUMOWANIE AI:</h3>
        <p>${reply.aiSummary}</p>
      </div>
      ` : ''}
      
      <div class="reply-box">
        <h3>💬 ODPOWIEDŹ LEADA:</h3>
        <p><strong>Temat:</strong> ${reply.subject}</p>
        <div style="max-height: 200px; overflow-y: auto; background: #f5f5f5; padding: 10px; border-radius: 5px; margin-top: 10px;">
          ${reply.content}
        </div>
      </div>
      
      <div class="footer">
        <p>Wiadomość wysłana automatycznie przez system Kreativia Mailing</p>
        <p><a href="${baseUrl}/inbox">Zobacz w inbox</a> | <a href="${baseUrl}/leads/${lead.id}">Szczegóły leada</a></p>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();
  
  // Dodaj przycisk tylko dla handlowca
  const buttonHtml = recipientType === 'salesperson' ? `
      <div style="text-align: center; margin: 30px 0;">
        <a href="${confirmUrl}" class="button" style="display: inline-block; background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 10px 0;">
          ✅ OD PIEDZIAŁEM SIĘ TYM
        </a>
      </div>
      
      <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin-top: 20px;">
        <p style="margin: 0; text-align: center; font-size: 14px; color: #666;">
          <strong>Kliknij przycisk powyżej</strong> aby potwierdzić, że odpowiesz leadowi lub się nim zajmiesz.
        </p>
      </div>
  ` : '';
  
  const bodyWithButton = bodyBase.replace('</body>', `      ${buttonHtml}
</body>`);
  
  return { subject, body: bodyBase, bodyWithButton };
}

/**
 * Potwierdza otrzymanie powiadomienia przez handlowca
 */
export async function confirmNotification(notificationId: number): Promise<boolean> {
  try {
    const notification = await db.interestedLeadNotification.update({
      where: { id: notificationId },
      data: {
        confirmedAt: new Date(),
        status: 'CONFIRMED'
      }
    });
    
    console.log(`[NOTIFIER] ✅ Powiadomienie ${notificationId} potwierdzone przez handlowca`);
    return true;
    
  } catch (error) {
    console.error(`[NOTIFIER] ❌ Błąd potwierdzenia:`, error);
    return false;
  }
}

