// Serwis do zarządzania automatycznymi follow-upami dla nowego systemu statusów
import { db } from "@/lib/db";
import { sendEmail } from "@/integrations/smtp/client";
import { LeadStatus, LeadSubStatus } from "@/types/leadStatus";

// Szablony AUTO_FOLLOWUP w 4 językach
const AUTO_FOLLOWUP_TEMPLATES = {
  PL: {
    subject: "Prośba o kontakt zastępczy",
    text: `Dzień dobry,

Dziękuję za przekazanie mojej wiadomości do odpowiedniego działu. 

Czy mogłbym prosić o adres email osoby, która będzie mogła się ze mną skontaktować w tej sprawie?

Z góry dziękuję za pomoc.

Pozdrawiam`
  },
  EN: {
    subject: "Request for alternative contact",
    text: `Hello,

Thank you for forwarding my message to the appropriate department.

Could I please have the email address of the person who will be able to contact me regarding this matter?

Thank you in advance for your help.

Best regards`
  },
  DE: {
    subject: "Bitte um alternative Kontaktaufnahme",
    text: `Guten Tag,

vielen Dank, dass Sie meine Nachricht an die zuständige Abteilung weitergeleitet haben.

Könnte ich bitte die E-Mail-Adresse der Person erhalten, die mich in dieser Angelegenheit kontaktieren kann?

Vielen Dank im Voraus für Ihre Hilfe.

Mit freundlichen Grüßen`
  },
  FR: {
    subject: "Demande de contact alternatif",
    text: `Bonjour,

Merci d'avoir transmis mon message au service approprié.

Pourrais-je avoir l'adresse e-mail de la personne qui pourra me contacter à ce sujet ?

Merci d'avance pour votre aide.

Cordialement`
  }
};

/**
 * Sprawdza leady z statusem CZEKAJ_REDIRECT_AWAITING_CONTACT i wysyła AUTO_FOLLOWUP
 */
export async function processAutoFollowUps(): Promise<void> {
  console.log('[AUTO-FOLLOWUP] 🔍 Sprawdzam leady do AUTO_FOLLOWUP...');

  try {
    // Znajdź leady z statusem CZEKAJ_REDIRECT_AWAITING_CONTACT
    const awaitingLeads = await db.lead.findMany({
      where: {
        status: "CZEKAJ",
        subStatus: "CZEKAJ_REDIRECT_AWAITING_CONTACT",
        // Sprawdź czy minęło 7 dni od ostatniej odpowiedzi
        updatedAt: {
          lte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        }
      },
      include: {
        replies: {
          orderBy: { createdAt: 'desc' },
          take: 1
        },
        // Pobierz dane z ostatniej kampanii
        CampaignLead: {
          include: {
            campaign: {
              include: {
                virtualSalesperson: {
                  include: {
                    mainMailbox: true
                  }
                }
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });

    console.log(`[AUTO-FOLLOWUP] Znaleziono ${awaitingLeads.length} leadów do AUTO_FOLLOWUP`);

    for (const lead of awaitingLeads) {
      try {
        await sendAutoFollowUp(lead);
      } catch (error: any) {
        console.error(`[AUTO-FOLLOWUP] ✗ Błąd dla leada ${lead.id}:`, error.message);
      }
    }

    // Sprawdź timeout - przejdź do PARKED po 14 dniach
    await processTimeouts();

  } catch (error: any) {
    console.error('[AUTO-FOLLOWUP] ✗ Błąd przetwarzania:', error.message);
  }
}

/**
 * Wysyła AUTO_FOLLOWUP do konkretnego leada
 */
async function sendAutoFollowUp(lead: any): Promise<void> {
  const lastReply = lead.replies[0];
  const lastCampaign = lead.CampaignLead[0]?.campaign;
  
  if (!lastCampaign || !lastCampaign.virtualSalesperson) {
    console.log(`[AUTO-FOLLOWUP] Pomijam leada ${lead.id} - brak danych kampanii`);
    return;
  }

  const salesperson = lastCampaign.virtualSalesperson;
  const mailbox = salesperson.mainMailbox;
  
  if (!mailbox) {
    console.log(`[AUTO-FOLLOWUP] Pomijam leada ${lead.id} - brak skrzynki głównej`);
    return;
  }

  // Określ język na podstawie kraju leada lub domyślnie PL
  const language = getLanguageFromCountry(lead.companyCountry) || 'PL';
  const template = AUTO_FOLLOWUP_TEMPLATES[language as keyof typeof AUTO_FOLLOWUP_TEMPLATES];

  // Sprawdź czy już wysłano AUTO_FOLLOWUP
  const existingAutoFollowUp = await db.sendLog.findFirst({
    where: {
      leadId: lead.id,
      subject: template.subject,
      createdAt: {
        gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Ostatnie 7 dni
      }
    }
  });

  if (existingAutoFollowUp) {
    console.log(`[AUTO-FOLLOWUP] Pomijam leada ${lead.id} - już wysłano AUTO_FOLLOWUP`);
    return;
  }

  try {
    // Wyślij email
    const emailResult = await sendEmail({
      to: lead.email,
      from: mailbox.email,
      subject: template.subject,
      html: template.text.replace(/\n/g, '<br>'),
      mailboxId: mailbox.id,
      type: "AUTO_FOLLOWUP",
      metadata: {
        leadId: lead.id,
        language: language,
        salespersonName: salesperson.displayName || salesperson.name
      }
    });

    if (emailResult.success) {
      // Zapisz w SendLog
      await db.sendLog.create({
        data: {
          leadId: lead.id,
          campaignId: lastCampaign.id,
          mailboxId: mailbox.id,
          messageId: emailResult.messageId,
          subject: template.subject,
          content: template.text,
          status: "SENT"
        }
      });

      // Zaktualizuj lead - dodaj informację o wysłanym AUTO_FOLLOWUP
      await db.lead.update({
        where: { id: lead.id },
        data: {
          sourceDetails: JSON.stringify({
            ...JSON.parse(lead.sourceDetails || '{}'),
            autoFollowUpSent: new Date().toISOString(),
            autoFollowUpLanguage: language
          })
        }
      });

      console.log(`[AUTO-FOLLOWUP] ✅ Wysłano AUTO_FOLLOWUP do ${lead.email} (${language})`);
    } else {
      console.error(`[AUTO-FOLLOWUP] ✗ Błąd wysyłki do ${lead.email}:`, emailResult.error);
    }

  } catch (error: any) {
    console.error(`[AUTO-FOLLOWUP] ✗ Błąd wysyłki do ${lead.email}:`, error.message);
  }
}

/**
 * Przetwarza timeout - przechodzi leady do PARKED po 14 dniach
 */
async function processTimeouts(): Promise<void> {
  console.log('[AUTO-FOLLOWUP] ⏰ Sprawdzam timeout...');

  const timeoutLeads = await db.lead.findMany({
    where: {
      status: "CZEKAJ",
      subStatus: "CZEKAJ_REDIRECT_AWAITING_CONTACT",
      // 14 dni bez odpowiedzi
      updatedAt: {
        lte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
      }
    }
  });

  console.log(`[AUTO-FOLLOWUP] Znaleziono ${timeoutLeads.length} leadów do timeout`);

  for (const lead of timeoutLeads) {
    try {
      await db.lead.update({
        where: { id: lead.id },
        data: {
          status: "CZEKAJ",
          subStatus: "CZEKAJ_MAYBE", // Przejdź do MAYBE_LATER
          sourceDetails: JSON.stringify({
            ...JSON.parse(lead.sourceDetails || '{}'),
            timeoutAt: new Date().toISOString(),
            timeoutReason: "AUTO_FOLLOWUP_TIMEOUT"
          })
        }
      });

      console.log(`[AUTO-FOLLOWUP] ⏰ Timeout dla leada ${lead.id} - przejście do CZEKAJ_MAYBE`);
    } catch (error: any) {
      console.error(`[AUTO-FOLLOWUP] ✗ Błąd timeout dla leada ${lead.id}:`, error.message);
    }
  }
}

/**
 * Określa język na podstawie kraju firmy
 */
function getLanguageFromCountry(country: string | null): string | null {
  if (!country) return null;
  
  const countryMap: { [key: string]: string } = {
    'Poland': 'PL',
    'Polska': 'PL',
    'PL': 'PL',
    'Germany': 'DE',
    'Deutschland': 'DE',
    'DE': 'DE',
    'France': 'FR',
    'FR': 'FR',
    'United Kingdom': 'EN',
    'UK': 'EN',
    'United States': 'EN',
    'USA': 'EN',
    'US': 'EN'
  };

  return countryMap[country] || null;
}

/**
 * Reaktywuje leada po otrzymaniu odpowiedzi na AUTO_FOLLOWUP
 */
export async function reactivateLeadAfterAutoFollowUp(leadId: number, newEmail: string): Promise<void> {
  try {
    const lead = await db.lead.findUnique({
      where: { id: leadId },
      include: {
        CampaignLead: {
          include: {
            campaign: true
          }
        }
      }
    });

    if (!lead) {
      throw new Error(`Lead ${leadId} nie znaleziony`);
    }

    // Utwórz nowego leada z nowym emailem
    const newLead = await db.lead.create({
      data: {
        email: newEmail,
        firstName: lead.firstName,
        lastName: lead.lastName,
        company: lead.company,
        companyCity: lead.companyCity,
        companyCountry: lead.companyCountry,
        industry: lead.industry,
        language: lead.language,
        status: "AKTYWNY",
        subStatus: null,
        source: "REDIRECT_RESPONSE",
        sourceDetails: JSON.stringify({
          originalLeadId: leadId,
          autoFollowUpResponse: true,
          createdAt: new Date().toISOString()
        }),
        originalLeadId: leadId,
        greetingForm: lead.greetingForm
      }
    });

    // Dodaj do tej samej kampanii co oryginalny lead
    if (lead.CampaignLead.length > 0) {
      const campaignId = lead.CampaignLead[0].campaignId;
      await db.campaignLead.create({
        data: {
          campaignId: campaignId,
          leadId: newLead.id
        }
      });
    }

    // Zaktualizuj oryginalny lead - oznacz jako zakończony
    await db.lead.update({
      where: { id: leadId },
      data: {
        status: "CZEKAJ",
        subStatus: "CZEKAJ_REDIRECT_COMPLETED",
        sourceDetails: JSON.stringify({
          ...JSON.parse(lead.sourceDetails || '{}'),
          completedAt: new Date().toISOString(),
          newLeadId: newLead.id
        })
      }
    });

    console.log(`[AUTO-FOLLOWUP] ✅ Reaktywowano leada ${leadId} jako ${newLead.id} z emailem ${newEmail}`);

  } catch (error: any) {
    console.error(`[AUTO-FOLLOWUP] ✗ Błąd reaktywacji leada ${leadId}:`, error.message);
  }
}
