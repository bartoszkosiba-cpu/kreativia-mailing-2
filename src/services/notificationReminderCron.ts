import * as cron from 'node-cron';
import { db } from '@/lib/db';
import nodemailer from 'nodemailer';

let reminderCronJob: cron.ScheduledTask | null = null;
let isReminderCronTaskRunning = false;

/**
 * Wysyła przypomnienia o niepotwierdzonych powiadomieniach
 */
export async function sendReminders(): Promise<void> {
  try {
    console.log('[REMINDER CRON] Sprawdzam powiadomienia do przypomnienia...');
    
    // Pobierz ustawienia firmy
    const settings = await db.companySettings.findFirst();
    if (!settings) {
      console.log('[REMINDER CRON] Brak ustawień firmy');
      return;
    }
    
    const reminderIntervalDays = settings.reminderIntervalDays || 3;
    const maxReminderCount = settings.maxReminderCount || 2;
    
    // Pobierz powiadomienia do przypomnienia
    // ✅ ZABEZPIECZENIE: Wyklucz powiadomienia które były przetwarzane w ostatnich 5 minutach (zapobiega duplikatom)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const reminderIntervalDate = new Date(Date.now() - reminderIntervalDays * 24 * 60 * 60 * 1000);
    
    const notifications = await db.interestedLeadNotification.findMany({
      where: {
        status: 'PENDING',
        confirmedAt: null, // Jeszcze nie potwierdzone
        reminderCount: {
          lt: maxReminderCount // Mniej niż maksymalna liczba przypomnień
        },
        // ✅ Warunki dla lastReminderAt:
        // 1. Albo null (nigdy nie przypomniane)
        // 2. Albo starsze niż reminderIntervalDays (czas na kolejne przypomnienie)
        // 3. I jednocześnie NIE było przetwarzane w ostatnich 5 minutach (zapobiega duplikatom)
        AND: [
          {
            OR: [
              { lastReminderAt: null }, // Nigdy nie przypomniane
              {
                lastReminderAt: {
                  lte: reminderIntervalDate // Starsze niż X dni (czas na kolejne przypomnienie)
                }
              }
            ]
          },
          {
            OR: [
              { lastReminderAt: null }, // Null = OK (nigdy nie przetwarzane)
              { lastReminderAt: { lt: fiveMinutesAgo } } // NIE było przetwarzane w ostatnich 5 minutach
            ]
          }
        ]
      },
      include: {
        reply: { include: { lead: true, campaign: { include: { virtualSalesperson: true } } } },
        lead: true,
        campaign: { include: { virtualSalesperson: true } }
      }
    });
    
    if (notifications.length === 0) {
      console.log('[REMINDER CRON] Brak powiadomień do przypomnienia');
      return;
    }
    
    console.log(`[REMINDER CRON] Znaleziono ${notifications.length} powiadomień do przypomnienia`);
    
    // ✅ Wysyłaj przypomnienia z opóźnieniem (2 sekundy między każdym) - zapobiega masowej wysyłce
    for (let i = 0; i < notifications.length; i++) {
      try {
        await sendSingleReminder(notifications[i], settings);
        
        // Opóźnienie między mailami (tylko jeśli nie jest to ostatni mail)
        if (i < notifications.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000)); // 2 sekundy
        }
      } catch (error: any) {
        console.error(`[REMINDER CRON] Błąd wysyłki przypomnienia dla notyfikacji ${notifications[i].id}:`, error.message);
      }
    }
    
  } catch (error: any) {
    console.error('[REMINDER CRON] Błąd sprawdzania powiadomień:', error);
  }
}

/**
 * Wysyła pojedyncze przypomnienie
 */
async function sendSingleReminder(notification: any, settings: any): Promise<void> {
  const lead = notification.reply?.lead || notification.lead;
  const campaign = notification.reply?.campaign || notification.campaign;
  
  if (!lead) {
    console.error(`[REMINDER CRON] Brak danych leada dla notyfikacji ${notification.id}`);
    return;
  }
  
  // ✅ ATOMOWE ZABLOKOWANIE: Zaktualizuj lastReminderAt PRZED wysyłką (zapobiega race condition)
  // Sprawdź czy powiadomienie nie zostało już zablokowane przez inny proces
  const now = new Date();
  const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
  
  try {
    // Atomowo sprawdź i zablokuj w transakcji
    const updated = await db.$transaction(async (tx) => {
      const currentNotification = await tx.interestedLeadNotification.findUnique({
        where: { id: notification.id }
      });
      
      if (!currentNotification || currentNotification.status !== 'PENDING') {
        return null; // Nie można przetworzyć
      }
      
      // Jeśli było przetwarzane w ostatnich 5 minutach, pomiń
      if (currentNotification.lastReminderAt && currentNotification.lastReminderAt >= fiveMinutesAgo) {
        return null; // Już przetwarzane
      }
      
      // Atomowo zablokuj przed wysyłką
      return await tx.interestedLeadNotification.update({
        where: { id: notification.id },
        data: {
          lastReminderAt: now // Zablokuj przed wysyłką
        }
      });
    });
    
    if (!updated) {
      console.log(`[REMINDER CRON] ⏭️ Powiadomienie ${notification.id} już jest przetwarzane lub nie jest PENDING - pomijam`);
      return;
    }
    
    console.log(`[REMINDER CRON] 🔒 Zablokowano powiadomienie ${notification.id} przed wysyłką`);
  } catch (error: any) {
    // Jeśli błąd to prawdopodobnie ktoś inny już zaktualizował - pomiń
    console.log(`[REMINDER CRON] ⏭️ Powiadomienie ${notification.id} - błąd blokowania (${error.message}) - pomijam`);
    return; // Nie kontynuuj jeśli nie udało się zablokować
  }
  
  // Pobierz skrzynkę do wysyłki
  const mailbox = await getNotificationMailbox(campaign);
  if (!mailbox) {
    console.error(`[REMINDER CRON] Brak dostępnej skrzynki dla notyfikacji ${notification.id}`);
    // Odblokuj jeśli brak skrzynki
    await db.interestedLeadNotification.update({
      where: { id: notification.id },
      data: { lastReminderAt: null }
    });
    return;
  }
  
  // Określ odbiorców (unikaj duplikatów - jeśli handlowiec i forwardEmail to ten sam email, wyślij tylko raz)
  const recipients: string[] = [];
  const recipientSet = new Set<string>();
  
  if (notification.salespersonEmail && !recipientSet.has(notification.salespersonEmail)) {
    recipients.push(notification.salespersonEmail);
    recipientSet.add(notification.salespersonEmail);
  }
  
  if (settings.forwardEmail && !recipientSet.has(settings.forwardEmail)) {
    recipients.push(settings.forwardEmail);
    recipientSet.add(settings.forwardEmail);
  }
  
  if (recipients.length === 0) {
    console.log(`[REMINDER CRON] Brak odbiorców dla notyfikacji ${notification.id}`);
    // Odblokuj jeśli brak odbiorców
    await db.interestedLeadNotification.update({
      where: { id: notification.id },
      data: { lastReminderAt: null }
    });
    return;
  }
  
  // Przygotuj treść przypomnienia
  const subject = `[PRZYPOMNIENIE] Nie odpowiedziałeś na zainteresowanego leada - ${lead.firstName || ''} ${lead.lastName || ''}`;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  // Link do endpoint API, który obsługuje potwierdzenie
  const confirmUrl = `${baseUrl}/api/confirm-interest/${notification.id}`;
  
  const body = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #ff9800; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
    .content { background: #f8f9fa; padding: 20px; border-radius: 0 0 5px 5px; }
    .lead-info { background: white; padding: 15px; margin: 10px 0; border-radius: 5px; border-left: 4px solid #007bff; }
    .button { display: inline-block; background: #dc3545; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 10px 0; font-weight: bold; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>Przypomnienie: Niepodpotwierdzony lead</h2>
    </div>
    <div class="content">
      <p>Ta wiadomość jest przypomnieniem o niepotwierdzonym leadzie zainteresowanym:</p>
      
      <div class="lead-info">
        <h3>DANE KONTAKTOWE:</h3>
        <p>
          <strong>Imię i nazwisko:</strong> ${lead.firstName || ''} ${lead.lastName || ''}<br>
          <strong>Firma:</strong> ${lead.company || 'N/A'}<br>
          <strong>Email:</strong> <a href="mailto:${lead.email}">${lead.email}</a><br>
          <strong>Kraj:</strong> ${lead.companyCountry || 'N/A'}
        </p>
      </div>
      
      ${campaign ? `
      <div class="lead-info">
        <p><strong>Kampania:</strong> ${campaign.name}</p>
      </div>
      ` : ''}
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${confirmUrl}" class="button">
          POTWIERDZAM
        </a>
      </div>
      
      <div style="background: #fff3cd; padding: 15px; border-radius: 5px; margin-top: 20px;">
        <p style="margin: 0; font-size: 14px; color: #856404;">
          <strong>Przypomnienie:</strong> To jest przypomnienie nr ${notification.reminderCount + 1} z ${settings.maxReminderCount || 2} możliwych.
        </p>
      </div>
      
      <div style="text-align: center; color: #666; font-size: 12px; margin-top: 20px;">
        <p>Wiadomość wysłana automatycznie przez system Kreativia Mailing</p>
        <p><a href="${baseUrl}/inbox">Zobacz w inbox</a></p>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();
  
  // Wyślij przypomnienia
  const transporter = nodemailer.createTransport({
    host: mailbox.smtpHost,
    port: mailbox.smtpPort || 587,
    secure: mailbox.smtpSecure,
    auth: {
      user: mailbox.smtpUser,
      pass: mailbox.smtpPass
    }
  });
  
  for (const recipient of recipients) {
    try {
      await transporter.sendMail({
        from: `"Kreativia Mailing - Przypomnienie" <${mailbox.email}>`,
        to: recipient,
        subject,
        html: body,
        replyTo: lead.email
      });
      
      // Zapisz do SendLog dla archiwum
      try {
        await db.sendLog.create({
          data: {
            mailboxId: mailbox.id,
            leadId: lead.id,
            campaignId: campaign?.id,
            toEmail: recipient, // NOWE: Zapisz odbiorcę przypomnienia
            subject: subject,
            content: body,
            status: "sent"
          }
        });
        console.log(`[REMINDER CRON] ✅ Przypomnienie zapisane do archiwum`);
      } catch (logError) {
        console.error(`[REMINDER CRON] ⚠️ Błąd zapisu do archiwum:`, logError);
      }
      
      console.log(`[REMINDER CRON] ✅ Przypomnienie wysłane do: ${recipient}`);
    } catch (error: any) {
      console.error(`[REMINDER CRON] ❌ Błąd wysyłki do ${recipient}:`, error.message);
    }
  }
  
  // Zaktualizuj powiadomienie (reminderCount już zwiększony, lastReminderAt już ustawiony przy blokowaniu)
  await db.interestedLeadNotification.update({
    where: { id: notification.id },
    data: {
      reminderCount: notification.reminderCount + 1
      // lastReminderAt już został ustawiony przy blokowaniu
    }
  });
  
  console.log(`[REMINDER CRON] ✅ Przypomnienie zakończone dla notyfikacji ${notification.id} (wysłano do ${recipients.length} odbiorców)`);
}

/**
 * Pobiera główną skrzynkę do wysyłki przypomnień
 */
async function getNotificationMailbox(campaign: any): Promise<any | null> {
  if (campaign?.virtualSalesperson?.mainMailboxId) {
    const mailbox = await db.mailbox.findUnique({
      where: { id: campaign.virtualSalesperson.mainMailboxId }
    });
    
    if (mailbox && mailbox.isActive) {
      return mailbox;
    }
  }
  
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
  
  const systemMailbox = await db.mailbox.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: 'asc' }
  });
  
  return systemMailbox;
}

/**
 * Uruchamia cron do przypomnień (codziennie o 12:00)
 */
export function startReminderCron() {
  if (reminderCronJob) {
    console.log('[REMINDER CRON] Cron już uruchomiony - pomijam');
    return;
  }
  
  // Cron: codziennie o 12:00 (polski czas)
  reminderCronJob = cron.schedule('0 12 * * *', async () => {
    if (isReminderCronTaskRunning) {
      console.log('[REMINDER CRON] ⏭️ Cron już działa - pomijam');
      return;
    }
    
    isReminderCronTaskRunning = true;
    try {
      await sendReminders();
    } catch (error: any) {
      console.error('[REMINDER CRON] ❌ Błąd przypomnień:', error.message);
    } finally {
      isReminderCronTaskRunning = false;
    }
  }, {
    timezone: 'Europe/Warsaw'
  });
  
  console.log('[REMINDER CRON] ✓ Cron przypomnień uruchomiony (codziennie o 12:00)');
}

