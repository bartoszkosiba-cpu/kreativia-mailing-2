/**
 * CAMPAIGN EMAIL SENDER - Wysyłanie zaplanowanych maili kampanii z kolejki
 * 
 * Odpowiedzialny za:
 * - Wysyłanie maili z CampaignEmailQueue (precyzyjne planowanie)
 * - Atomic updates (przeciw race conditions)
 * - Sprawdzanie limitów przed wysłaniem
 * - Automatyczne dodawanie następnych maili do kolejki
 */

import { db } from "@/lib/db";
import { getNextAvailableMailbox, incrementMailboxCounter } from "./mailboxManager";
import { scheduleNextEmail } from "./campaignEmailQueue";
import { sendSingleEmail } from "./scheduledSender";
import { addMinutes } from "date-fns";

/**
 * Wysyła JEDEN zaplanowany mail z kolejki (najbliższy w czasie)
 * 
 * Używa transakcji atomic aby zapobiec race conditions
 */
export async function sendNextScheduledCampaignEmail(): Promise<{
  success: boolean;
  mailSent?: boolean;
  campaignId?: number;
  error?: string;
}> {
  try {
    const now = new Date();
    // ✅ WAŻNE: scheduledAt już zawiera delay (obliczony w calculateNextEmailTime)
    // Jeśli scheduledAt <= now, to delay minął - wysyłaj
    // Tolerancja 5 min tylko dla maili w przyszłości (jeśli cron jest opóźniony)
    const toleranceWindow = addMinutes(now, 5); // Maksymalnie 5 minut w przyszłość

    // ✅ AUTOMATYCZNE ODBLOKOWANIE: Odblokuj maile w statusie "sending" które są zbyt stare (>10 min)
    // To naprawia sytuacje gdy proces się crashnął podczas wysyłki
    const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);
    await db.campaignEmailQueue.updateMany({
      where: {
        status: "sending",
        updatedAt: {
          lt: tenMinutesAgo // Zaktualizowane >10 min temu
        }
      },
      data: {
        status: "pending" // Przywróć do pending
      }
    });

    // KROK 1: Znajdź najbliższy mail do wysłania
    // ✅ scheduledAt <= now oznacza że delay minął - wysyłaj
    // ✅ scheduledAt <= toleranceWindow (dla maili w przyszłości, jeśli cron jest opóźniony)
    // ✅ WAŻNE: Najpierw szukaj maili w przeszłości (catch-up), potem w przyszłości
    const nextEmail = await db.campaignEmailQueue.findFirst({
      where: {
        status: "pending",
        scheduledAt: {
          lte: toleranceWindow // scheduledAt już zawiera delay! (now + 5 min dla tolerancji)
        }
      },
      orderBy: {
        scheduledAt: "asc" // Najstarszy pierwszy
      },
      include: {
        campaign: {
          include: {
            virtualSalesperson: true
          }
        },
        campaignLead: {
          include: {
            lead: true
          }
        }
      }
    });

    if (!nextEmail) {
      // Brak maili do wysłania - to OK
      return { success: true, mailSent: false };
    }

    // ✅ DEBUG: Loguj szczegóły znalezionego maila
    const scheduledAt = new Date(nextEmail.scheduledAt);
    const isPastDue = scheduledAt < now;
    const minutesPast = isPastDue ? Math.floor((now.getTime() - scheduledAt.getTime()) / 1000 / 60) : 0;
    const minutesFuture = !isPastDue ? Math.floor((scheduledAt.getTime() - now.getTime()) / 1000 / 60) : 0;

    console.log(`[CAMPAIGN SENDER] 📧 Znaleziono mail do wysłania:`);
    console.log(`[CAMPAIGN SENDER]   → ID: ${nextEmail.id}`);
    console.log(`[CAMPAIGN SENDER]   → Kampania: ${nextEmail.campaign.name} (ID: ${nextEmail.campaignId})`);
    console.log(`[CAMPAIGN SENDER]   → Zaplanowane: ${nextEmail.scheduledAt.toISOString()}`);
    console.log(`[CAMPAIGN SENDER]   → Do: ${nextEmail.campaignLead.lead?.email}`);

    // KROK 2: Sprawdź czy kampania jest nadal aktywna
    if (nextEmail.campaign.status !== "IN_PROGRESS") {
      console.log(`[CAMPAIGN SENDER] ⏭️  Kampania ${nextEmail.campaign.name} nie jest już aktywna (status: ${nextEmail.campaign.status}) - pomijam`);

      // Oznacz jako cancelled
      await db.campaignEmailQueue.update({
        where: { id: nextEmail.id },
        data: { status: "cancelled" }
      });

      return { success: true, mailSent: false };
    }

    // KROK 3: Sprawdź okno czasowe kampanii
    // ✅ WAŻNE: Jeśli mail jest w przeszłości (opóźniony), sprawdź czy delay minął od ostatniego wysłanego
    // Jeśli delay minął - wysyłaj nawet jeśli teraz jest poza oknem czasowym (catch-up)
    // (scheduledAt i isPastDue już obliczone wyżej)
    
    const allowedDays = nextEmail.campaign.allowedDays ? nextEmail.campaign.allowedDays.split(",") : [];
    const targetCountries = nextEmail.campaign.targetCountries ? nextEmail.campaign.targetCountries.split(",") : [];

    const { isValidSendTime } = await import("./campaignScheduler");
    const validation = await isValidSendTime(
      now,
      allowedDays,
      nextEmail.campaign.startHour,
      nextEmail.campaign.startMinute ?? 0,
      nextEmail.campaign.endHour,
      nextEmail.campaign.endMinute ?? 0,
      nextEmail.campaign.respectHolidays ?? false,
      targetCountries
    );

    // ✅ WAŻNE: ZAWSZE sprawdź delay od ostatniego wysłanego maila (dla wszystkich maili)
    const lastSentLog = await db.sendLog.findFirst({
      where: {
        campaignId: nextEmail.campaignId,
        status: 'sent'
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    const baseDelay = nextEmail.campaign.delayBetweenEmails || 90;
    const minRequiredDelay = Math.floor(baseDelay * 0.8); // 80% bazowego

    if (lastSentLog) {
      const lastSentTime = new Date(lastSentLog.createdAt);
      const timeSinceLastMail = Math.floor((now.getTime() - lastSentTime.getTime()) / 1000);

      if (timeSinceLastMail < minRequiredDelay) {
        // Delay jeszcze nie minął - poczekaj
        const remainingDelay = minRequiredDelay - timeSinceLastMail;
        console.log(`[CAMPAIGN SENDER] ⏰ Delay jeszcze nie minął (minęło: ${timeSinceLastMail}s, wymagane minimum: ${minRequiredDelay}s, pozostało: ${remainingDelay}s) - odkładam`);
        return { success: true, mailSent: false };
      }
    }

    // ✅ NOWE: Jeśli mail jest opóźniony (w przeszłości), wysyłaj catch-up (pomijamy okno czasowe)
    // ✅ Delay minął (sprawdzony wyżej) - wysyłaj
    if (isPastDue) {
      // Mail opóźniony - delay minął, więc wysyłaj catch-up
      // Pomijamy okno czasowe dla opóźnionych maili (catch-up)
      const minutesPast = Math.floor((now.getTime() - scheduledAt.getTime()) / 1000 / 60);
      console.log(`[CAMPAIGN SENDER] ⚠️ Mail opóźniony (zaplanowany ${minutesPast} min temu, delay minął) - wysyłam catch-up (pomijam okno czasowe)`);
      // Kontynuuj wysyłkę (pomijamy sprawdzanie okna czasowego dla catch-up)
    } else if (!validation.isValid) {
      // Mail w przyszłości, ale poza oknem czasowym - poczekaj
      console.log(`[CAMPAIGN SENDER] ⏰ Teraz nie jest okno czasowe: ${validation.reason} - odkładam na później`);
      return { success: true, mailSent: false };
    }

    // KROK 4: ATOMOWA BLOKADA - zmień status na "sending"
    const lockUpdate = await db.campaignEmailQueue.updateMany({
      where: {
        id: nextEmail.id,
        status: "pending" // Tylko jeśli nadal jest pending
      },
      data: {
        status: "sending"
      }
    });

    if (lockUpdate.count === 0) {
      // Inny proces już zajął ten mail - koniec
      console.log(`[CAMPAIGN SENDER] ⚠️ Mail ${nextEmail.id} został już zajęty przez inny proces`);
      return { success: true, mailSent: false };
    }

    console.log(`[CAMPAIGN SENDER] 🔒 Mail zablokowany (sending)`);

    // KROK 5: Sprawdź dostępność skrzynki
    if (!nextEmail.campaign.virtualSalesperson) {
      console.error(`[CAMPAIGN SENDER] ❌ Kampania ${nextEmail.campaignId} nie ma przypisanego handlowca`);
      
      await db.campaignEmailQueue.update({
        where: { id: nextEmail.id },
        data: {
          status: "failed",
          error: "Brak handlowca"
        }
      });

      return { success: false, error: "Brak handlowca" };
    }

    const availableMailbox = await getNextAvailableMailbox(
      nextEmail.campaign.virtualSalesperson.id
    );

    if (!availableMailbox) {
      const leadEmail = nextEmail.campaignLead.lead?.email || 'unknown';
      const scheduledAtTime = new Date(nextEmail.scheduledAt);
      const minutesPast = Math.floor((now.getTime() - scheduledAtTime.getTime()) / 1000 / 60);
      
      console.log(`[CAMPAIGN SENDER] ⏸️  Brak dostępnych skrzynek dla kampanii ${nextEmail.campaignId} - odkładam`);
      console.log(`[CAMPAIGN SENDER]   → Mail do: ${leadEmail}`);
      console.log(`[CAMPAIGN SENDER]   → Zaplanowany: ${scheduledAtTime.toISOString()} (${minutesPast} min w przeszłości)`);
      console.log(`[CAMPAIGN SENDER]   ⚠️  Mail będzie próbowany ponownie przy następnym cron (co 1 min)`);

      // Przywróć do pending - zostanie wysłany przy następnym sprawdzeniu
      await db.campaignEmailQueue.update({
        where: { id: nextEmail.id },
        data: { status: "pending" }
      });

      return { success: true, mailSent: false };
    }

    console.log(`[CAMPAIGN SENDER] ✓ Dostępna skrzynka: ${availableMailbox.email}`);

    // KROK 6: Pobierz ustawienia firmy
    const companySettings = await db.companySettings.findFirst();

    // KROK 7: WYŚLIJ MAIL (używając istniejącej funkcji z scheduledSender)
    let sendResult;
    try {
      const lead = nextEmail.campaignLead.lead;
      if (!lead) {
        throw new Error("Lead nie istnieje");
      }

      sendResult = await sendSingleEmail(
        nextEmail.campaign,
        lead,
        companySettings,
        0 // index = 0 dla dynamicznego wyboru wariantu A/B
      );

      if (!sendResult.success) {
        throw new Error(sendResult.error || "Nieznany błąd wysyłki");
      }

      console.log(`[CAMPAIGN SENDER] ✅ Mail wysłany!`);

      // Zaktualizuj licznik skrzynki
      await incrementMailboxCounter(availableMailbox.id);

    } catch (sendError: any) {
      console.error(`[CAMPAIGN SENDER] ❌ Błąd wysyłki SMTP:`, sendError.message);

      // Oznacz jako failed
      await db.campaignEmailQueue.update({
        where: { id: nextEmail.id },
        data: {
          status: "failed",
          error: sendError.message,
          sentAt: new Date()
        }
      });

      // Przywróć CampaignLead do queued (umożliwia ponowną próbę)
      await db.campaignLead.update({
        where: { id: nextEmail.campaignLeadId },
        data: { status: "queued" }
      });

      return {
        success: false,
        error: sendError.message,
        campaignId: nextEmail.campaignId
      };
    }

    // KROK 8: Zaktualizuj status w kolejce i CampaignLead
    const actualSentTime = new Date();
    await db.$transaction(async (tx) => {
      // Zaktualizuj CampaignEmailQueue
      await tx.campaignEmailQueue.update({
        where: { id: nextEmail.id },
        data: {
          status: "sent",
          sentAt: actualSentTime
        }
      });

      // Zaktualizuj CampaignLead
      await tx.campaignLead.update({
        where: { id: nextEmail.campaignLeadId },
        data: {
          status: "sent",
          sentAt: actualSentTime
        }
      });
    });

    // Inkrementuj licznik handlowca
    if (nextEmail.campaign.virtualSalesperson) {
      const { incrementSentCounter } = await import('./queueManager');
      await incrementSentCounter(nextEmail.campaign.virtualSalesperson.id, 1);
    }

    console.log(`[CAMPAIGN SENDER] 💾 Zaktualizowano statusy`);

    // KROK 9: Dodaj następny mail do kolejki (dynamiczne uzupełnianie)
    // Użyj faktycznego czasu wysłania jako bazę dla następnego maila
    try {
      await scheduleNextEmail(
        nextEmail.campaignId,
        actualSentTime,
        nextEmail.campaign.delayBetweenEmails
      );
    } catch (scheduleError: any) {
      console.error(`[CAMPAIGN SENDER] ⚠️ Błąd planowania następnego maila:`, scheduleError.message);
      // Nie przerywamy - mail został wysłany, następny może być dodany później
    }

    console.log(`[CAMPAIGN SENDER] ✅ SUKCES!`);

    return {
      success: true,
      mailSent: true,
      campaignId: nextEmail.campaignId
    };

  } catch (error: any) {
    console.error(`[CAMPAIGN SENDER] ❌ Błąd krytyczny:`, error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Wysyła wszystkie gotowe maile z kolejki (do limitu)
 * Używane przez cron job
 */
export async function sendScheduledCampaignEmails(): Promise<{
  success: boolean;
  sent: number;
  skipped: number;
  failed: number;
  errors: string[];
}> {
  const result = {
    sent: 0,
    skipped: 0,
    failed: 0,
    errors: [] as string[]
  };

  // ✅ AUTOMATYCZNA NAPRAWA: Sprawdź czy są kampanie IN_PROGRESS z pustą kolejką
  try {
    // Prostsze zapytanie - znajdź kampanie IN_PROGRESS
    const activeCampaigns = await db.campaign.findMany({
      where: {
        status: "IN_PROGRESS"
      },
      select: {
        id: true,
        delayBetweenEmails: true
      }
    });

    // Sprawdź każdą kampanię osobno (dokładniej)
    for (const campaign of activeCampaigns) {
      // ✅ NOWE: Najpierw zmień status "planned" → "queued" (dla spójności)
      const plannedUpdated = await db.campaignLead.updateMany({
        where: {
          campaignId: campaign.id,
          status: "planned",
          lead: {
            status: { not: "BLOCKED" },
            isBlocked: false
          }
        },
        data: {
          status: "queued"
        }
      });

      if (plannedUpdated.count > 0) {
        console.log(`[CAMPAIGN SENDER] 🔄 Zmieniono ${plannedUpdated.count} leadów z "planned" na "queued" dla kampanii ${campaign.id}`);
      }

      // Sprawdź czy ma leadów w kolejce
      const queuedLeadsCount = await db.campaignLead.count({
        where: {
          campaignId: campaign.id,
          status: "queued", // ✅ UPROSZCZENIE: Tylko "queued" (już zmienione z "planned")
          lead: {
            status: { not: "BLOCKED" },
            isBlocked: false
          }
        }
      });

      // Sprawdź czy ma maili w kolejce
      const queueCount = await db.campaignEmailQueue.count({
        where: {
          campaignId: campaign.id,
          status: { in: ["pending", "sending"] }
        }
      });

      // Jeśli ma leadów ale brak maili w kolejce - reinicjalizuj
      if (queuedLeadsCount > 0 && queueCount === 0) {
        console.log(`[CAMPAIGN SENDER] ⚠️ Kampania ${campaign.id} ma ${queuedLeadsCount} leadów w kolejce (status: queued), ale 0 maili w CampaignEmailQueue - reinicjalizuję...`);
        
        const { initializeCampaignQueue } = await import("./campaignEmailQueue");
        const initialized = await initializeCampaignQueue(
          campaign.id,
          campaign.delayBetweenEmails || 90,
          10 // Buffer: pierwsze 10 maili
        );
        
        if (initialized > 0) {
          console.log(`[CAMPAIGN SENDER] ✅ Reinicjalizowano kolejkę: ${initialized} maili dla kampanii ${campaign.id}`);
        } else {
          console.log(`[CAMPAIGN SENDER] ⚠️ Reinicjalizacja zwróciła 0 maili - sprawdź logi w campaignEmailQueue`);
        }
      }
    }
  } catch (error: any) {
    console.error(`[CAMPAIGN SENDER] ❌ Błąd automatycznej naprawy kolejki:`, error.message);
    // Nie przerywamy - kontynuujemy wysyłkę
  }

  // ✅ WAŻNE: Wysyłamy tylko 1 mail na wywołanie cron (zachowujemy delay)
  // Delay jest przestrzegany przez:
  // 1. Sprawdzanie delay w sendNextScheduledCampaignEmail (przed wysłaniem)
  // 2. Cron działa co 1 minutę (dodatkowy odstęp między wywołaniami)
  // 3. Delay jest sprawdzany od ostatniego wysłanego maila (72s minimum)
  
  const emailResult = await sendNextScheduledCampaignEmail();

  if (emailResult.success && emailResult.mailSent) {
    result.sent++;
  } else if (emailResult.success && !emailResult.mailSent) {
    result.skipped++;
  } else {
    result.failed++;
    if (emailResult.error) {
      result.errors.push(emailResult.error);
    }
  }

  return {
    success: true,
    ...result
  };
}

