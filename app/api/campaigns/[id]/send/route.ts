import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendCampaignEmail } from "@/integrations/smtp/client";
import { generatePersonalization } from "@/integrations/ai/client";
import { getNextAvailableMailbox, incrementMailboxCounter } from "@/services/mailboxManager";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const campaignId = Number(params.id);
    if (Number.isNaN(campaignId)) {
      return NextResponse.json({ error: "Nieprawidłowe ID kampanii" }, { status: 400 });
    }

    const { testEmail, forceResend } = await req.json();

    // Pobierz kampanię z handlowcem i leadami
    const campaign = await db.campaign.findUnique({
      where: { id: campaignId },
      include: {
        virtualSalesperson: {
          include: {
            mainMailbox: {
              select: {
                id: true,
                email: true,
                displayName: true,
                smtpHost: true,
                smtpPort: true,
                smtpUser: true,
                smtpPass: true,
                smtpSecure: true
              }
            }
          }
        },
        CampaignLead: {
          where: {
            lead: {
              status: {
                not: "BLOCKED" // Pomijaj zablokowane leady
              }
            }
          },
          include: {
            lead: true
          },
          orderBy: {
            priority: "asc" // Wysoki priorytet (1) najpierw - np. OOO leady
          }
        }
      }
    });

    // Pobierz ustawienia firmowe
    const companySettings = await db.companySettings.findFirst();

    if (!campaign) {
      return NextResponse.json({ error: "Kampania nie została znaleziona" }, { status: 404 });
    }

    if (!campaign.subject) {
      return NextResponse.json({ error: "Kampania nie ma tematu maila" }, { status: 400 });
    }

    if (!campaign.text) {
      return NextResponse.json({ error: "Kampania nie ma treści" }, { status: 400 });
    }

    if (campaign.CampaignLead.length === 0) {
      return NextResponse.json({ error: "Kampania nie ma leadów" }, { status: 400 });
    }

    // Jeśli to test, wyślij tylko do testowego emaila
    if (testEmail) {
      try {
        if (campaign.CampaignLead.length === 0) {
          throw new Error('Brak leadów w kampanii po filtrowaniu');
        }
        const testLead = campaign.CampaignLead[0].lead;
        
        // NOWE: Pobierz dostępną skrzynkę mailową (round-robin) - TAK JAK W NORMALNEJ WYSYŁCE
        let mailbox = null;
        if (campaign.virtualSalespersonId) {
          mailbox = await getNextAvailableMailbox(campaign.virtualSalespersonId);
          
          if (!mailbox) {
            throw new Error('Brak dostępnych skrzynek mailowych dla handlowca');
          }
          
          console.log(`[TEST MAILBOX] Używam skrzynki: ${mailbox.email}`);
        }
        
        // Użyj greetingForm z bazy danych lub wygeneruj personalizację
        let personalizedContent;
        
        if (testLead.greetingForm && campaign.text) {
          // Użyj istniejącej odmiany z bazy danych
          personalizedContent = testLead.greetingForm + "\n\n" + campaign.text;
        } else {
          // Fallback - wygeneruj personalizację
          personalizedContent = await generatePersonalization(
            testLead.firstName,
            testLead.lastName,
            testLead.company,
            testLead.industry,
            testLead.title,
            testLead.companyCity,
            testLead.companyCountry,
            campaign.text,
            testLead.language || 'pl'
          );
        }

        const result = await sendCampaignEmail({
          subject: campaign.subject,
          content: personalizedContent,
          leadEmail: testEmail,
          leadName: testLead.firstName || undefined,
          leadCompany: testLead.company || undefined,
          leadLanguage: testLead.language || 'pl',
          salesperson: campaign.virtualSalesperson ? {
            name: campaign.virtualSalesperson.name,
            email: campaign.virtualSalesperson.email,
            phone: campaign.virtualSalesperson.phone,
            language: campaign.virtualSalesperson.language,
            mainMailbox: campaign.virtualSalesperson.mainMailbox ? {
              email: campaign.virtualSalesperson.mainMailbox.email,
              displayName: campaign.virtualSalesperson.mainMailbox.displayName || undefined
            } : undefined
          } : undefined,
          mailbox: mailbox || undefined, // NOWE: Dodane mailbox z round-robin
          campaign: {
            jobDescription: campaign.jobDescription,
            postscript: campaign.postscript,
            linkText: campaign.linkText,
            linkUrl: campaign.linkUrl
          },
          settings: companySettings || undefined
        });

        return NextResponse.json({
          message: "Test mail wysłany pomyślnie",
          result
        });
      } catch (error) {
        console.error("Błąd wysyłki testowego maila:", error);
        return NextResponse.json({ 
          error: "Błąd wysyłki testowego maila", 
          details: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        }, { status: 500 });
      }
    }

    // Wysyłka do wszystkich leadów
    const results = [];
    let successCount = 0;
    let errorCount = 0;

    for (const campaignLead of campaign.CampaignLead) {
      const lead = campaignLead.lead;
      const priority = campaignLead.priority;
      
      // Sprawdź czy lead jest zablokowany
      if (lead.status === "BLOCKED" || lead.isBlocked) {
        console.log(`Pomijam leada ${lead.email} - zablokowany (status: ${lead.status})`);
        continue;
      }
      
      // Sprawdź czy mail już został wysłany (zapobieganie duplikatom)
      // SKIP jeśli forceResend = true
      if (!forceResend) {
        const alreadySent = await db.sendLog.findFirst({
          where: {
            campaignId: campaignId,
            leadId: lead.id,
            status: "sent"
          }
        });

        if (alreadySent) {
          console.log(`Pomijam leada ${lead.email} - mail już wysłany (${alreadySent.createdAt.toLocaleString()})`);
          continue;
        }
      } else {
        console.log(`[FORCE RESEND] Wysyłam ponownie do ${lead.email}`);
      }
      
      // Log priorytetu (1 = wysoki priorytet, np. OOO lead)
      if (priority === 1) {
        console.log(`[WYSOKI PRIORYTET] Wysyłam do ${lead.email} (priority: ${priority}) - prawdopodobnie OOO lead`);
      }
      
      try {
        // NOWE: Pobierz dostępną skrzynkę mailową (round-robin)
        let mailbox = null;
        if (campaign.virtualSalespersonId) {
          mailbox = await getNextAvailableMailbox(campaign.virtualSalespersonId);
          
          if (!mailbox) {
            console.log(`❌ Brak dostępnych skrzynek dla handlowca - przerywam wysyłkę`);
            errorCount++;
            results.push({
              leadEmail: lead.email,
              status: "error",
              error: "Brak dostępnych skrzynek mailowych"
            });
            continue; // Przejdź do następnego leada
          }
          
          console.log(`[MAILBOX] Używam skrzynki: ${mailbox.email} (pozostało: ${mailbox.remainingToday})`);
        }
        
        // Użyj greetingForm z bazy danych lub wygeneruj personalizację
        let personalizedContent;
        
        if (lead.greetingForm && campaign.text) {
          // Użyj istniejącej odmiany z bazy danych
          personalizedContent = lead.greetingForm + "\n\n" + campaign.text;
        } else {
          // Fallback - wygeneruj personalizację
          personalizedContent = await generatePersonalization(
            lead.firstName,
            lead.lastName,
            lead.company,
            lead.industry,
            lead.title,
            lead.companyCity,
            lead.companyCountry,
            campaign.text,
            lead.language || 'pl'
          );
        }

        // Wyślij mail - NOWE: Przekaż mailbox
        const result = await sendCampaignEmail({
          subject: campaign.subject,
          content: personalizedContent,
          leadEmail: lead.email,
          leadName: lead.firstName || undefined,
          leadCompany: lead.company || undefined,
          leadLanguage: lead.language || 'pl',
          salesperson: campaign.virtualSalesperson ? {
            name: campaign.virtualSalesperson.name,
            email: campaign.virtualSalesperson.email,
            phone: campaign.virtualSalesperson.phone,
            language: campaign.virtualSalesperson.language,
            mainMailbox: campaign.virtualSalesperson.mainMailbox ? {
              email: campaign.virtualSalesperson.mainMailbox.email,
              displayName: campaign.virtualSalesperson.mainMailbox.displayName || undefined
            } : undefined
          } : undefined,
          mailbox: mailbox || undefined, // NOWE: Konkretna skrzynka
          campaign: {
            jobDescription: campaign.jobDescription,
            postscript: campaign.postscript,
            linkText: campaign.linkText,
            linkUrl: campaign.linkUrl
          },
          settings: companySettings || undefined
        });

        // Zapisz log wysyłki - NOWE: Dodaj mailboxId, subject i content
        await db.sendLog.create({
          data: {
            campaignId: campaignId,
            leadId: lead.id,
            mailboxId: mailbox?.id || null, // NOWE: Z której skrzynki wysłano
            subject: campaign.subject, // NOWE: Temat
            content: personalizedContent, // NOWE: Treść
            status: "sent",
            messageId: result.messageId
          }
        });

        // NOWE: Zwiększ licznik dla użytej skrzynki
        if (mailbox) {
          await incrementMailboxCounter(mailbox.id);
        }

        successCount++;
        results.push({
          leadId: lead.id,
          email: lead.email,
          status: "success",
          messageId: result.messageId,
          sentFromMailbox: mailbox?.email // NOWE: Informacja z jakiej skrzynki
        });

        // Małe opóźnienie między mailami
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.error(`Błąd wysyłki do ${lead.email}:`, error);
        
        // Zapisz log błędu - NOWE: Dodaj mailboxId, subject i content
        await db.sendLog.create({
          data: {
            campaignId: campaignId,
            leadId: lead.id,
            mailboxId: null, // Nie ma dostępu do mailbox w catch
            subject: campaign.subject, // NOWE
            content: null, // Nie ma dostępu do personalizedContent w catch
            status: "error",
            error: error instanceof Error ? error.message : "Nieznany błąd"
          }
        });

        errorCount++;
        results.push({
          leadId: lead.id,
          email: lead.email,
          status: "error",
          error: error instanceof Error ? error.message : "Nieznany błąd"
        });
      }
    }

    return NextResponse.json({
      message: `Wysyłka zakończona. Sukces: ${successCount}, Błędy: ${errorCount}`,
      summary: {
        total: campaign.CampaignLead.length,
        success: successCount,
        errors: errorCount
      },
      results
    });

  } catch (error) {
    console.error("Błąd wysyłki kampanii:", error);
    return NextResponse.json({ error: "Wystąpił błąd podczas wysyłki kampanii" }, { status: 500 });
  }
}
