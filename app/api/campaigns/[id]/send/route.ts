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

        // Pobierz dostępną skrzynkę mailową (round-robin) - jak w normalnej wysyłce
        let mailbox = null;
        if (campaign.virtualSalespersonId) {
          mailbox = await getNextAvailableMailbox(campaign.virtualSalespersonId);
          if (!mailbox) {
            throw new Error('Brak dostępnych skrzynek mailowych dla handlowca');
          }
          console.log(`[TEST MAILBOX] Używam skrzynki: ${mailbox.email}`);
        }

        // Helper: wybór pól dla wariantu
        const getFieldsForVariant = (variant: "A" | "B") => {
          if (!campaign.abTestEnabled || variant === "A") {
            return {
              subject: campaign.subject,
              text: campaign.text,
              jobDescription: campaign.jobDescription,
              postscript: campaign.postscript,
              linkText: campaign.linkText,
              linkUrl: campaign.linkUrl
            };
          }
          return {
            subject: campaign.subjectB || campaign.subject,
            text: campaign.textB || campaign.text,
            jobDescription: campaign.jobDescriptionB || campaign.jobDescription,
            postscript: campaign.postscriptB || campaign.postscript,
            linkText: campaign.linkTextB || campaign.linkText,
            linkUrl: campaign.linkUrlB || campaign.linkUrl
          };
        };

        // Zdecyduj czy wysłać 1 (A) czy 2 (A i B) maile
        const variants: ("A" | "B")[] = campaign.abTestEnabled ? ["A", "B"] : ["A"]; 

        const sendResults: any[] = [];
        for (const variant of variants) {
          const fields = getFieldsForVariant(variant);

          // Personalizacja treści
          let personalizedContent: string;
          if (testLead.greetingForm && fields.text) {
            personalizedContent = testLead.greetingForm + "\n\n" + (fields.text || "");
          } else {
            personalizedContent = await generatePersonalization(
              testLead.firstName,
              testLead.lastName,
              testLead.company,
              testLead.industry,
              testLead.title,
              testLead.companyCity,
              testLead.companyCountry,
              fields.text || "",
              testLead.language || 'pl'
            );
          }

          const subjectWithTest = campaign.abTestEnabled 
            ? `[TEST ${variant}] ${fields.subject || 'Brak tematu'}`
            : `[TEST] ${fields.subject || 'Brak tematu'}`;

          const result = await sendCampaignEmail({
            subject: subjectWithTest,
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
            mailbox: mailbox || undefined,
            campaign: {
              jobDescription: fields.jobDescription,
              postscript: fields.postscript,
              linkText: fields.linkText,
              linkUrl: fields.linkUrl
            },
            settings: companySettings || undefined
          });

          // Log do SendLog (test: zapisuj adres i wariant)
          await db.sendLog.create({
            data: {
              campaignId: campaignId,
              leadId: null, // test nie wiąże twardo z leadem
              mailboxId: mailbox?.id || null,
              toEmail: testEmail,
              subject: subjectWithTest,
              content: personalizedContent,
              variantLetter: campaign.abTestEnabled ? variant : null,
              status: "sent",
              messageId: result.messageId
            }
          });

          if (mailbox) {
            await incrementMailboxCounter(mailbox.id);
          }

          sendResults.push({ variant, messageId: result.messageId });
        }

        return NextResponse.json({
          message: campaign.abTestEnabled
            ? `Wysłano testy A/B na ${testEmail}`
            : `Wysłano test na ${testEmail}`,
          results: sendResults
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
      
      // Sprawdź czy mail już został wysłany (zapobieganie duplikatom TYLKO jeśli sukces)
      const alreadySent = await db.sendLog.findFirst({
        where: {
          campaignId: campaignId,
          leadId: lead.id,
          status: "sent"
        }
      });

      if (alreadySent && !forceResend) {
        console.log(`Pomijam leada ${lead.email} - mail już wysłany (${alreadySent.createdAt.toLocaleString()})`);
        continue;
      } else if (alreadySent && forceResend) {
        console.log(`[FORCE RESEND] Wysyłam ponownie do ${lead.email} (pomimo wcześniejszej wysyłki)`);
      }
      
      // Sprawdź czy był błąd w ciągu ostatnich 60 sekund (zapobieganie retry flood)
      if (!forceResend) {
        const recentError = await db.sendLog.findFirst({
          where: {
            campaignId: campaignId,
            leadId: lead.id,
            status: "error",
            createdAt: {
              gte: new Date(Date.now() - 60000) // Ostatnia minuta
            }
          }
        });

        if (recentError) {
          console.log(`Pomijam leada ${lead.email} - błąd przed chwilą (${recentError.createdAt}), czekam przed retry`);
          continue; // Skip retry flood
        }
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
