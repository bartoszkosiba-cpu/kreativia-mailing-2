// Procesor odpowiedzi - automatyczne akcje na podstawie klasyfikacji AI

import { db } from "@/lib/db";
import { classifyReply } from "@/integrations/ai/client";
import { sendCampaignEmail } from "@/integrations/smtp/client";
import type { ParsedEmail } from "@/integrations/imap/client";

export interface ProcessingResult {
  replyId: number;
  classification: string;
  actionsTaken: string[];
  error?: string;
}

/**
 * Przetwarza pojedynczą odpowiedź z maila
 */
export async function processReply(email: ParsedEmail, toEmail?: string): Promise<ProcessingResult> {
  const actionsTaken: string[] = [];
  
  console.log(`[PROCESSOR] Start przetwarzania: ${email.subject} od ${email.from}`);
  
  try {
    // 1. Wyciągnij email nadawcy
    const fromEmailMatch = email.from.match(/[\w.-]+@[\w.-]+\.\w+/);
    const fromEmail = fromEmailMatch ? fromEmailMatch[0] : email.from;
    
    console.log(`[PROCESSOR] Przetwarzam email od: ${fromEmail}`);
    
    // 2. Sprawdź czy odpowiedź już istnieje (duplikat) - NAJWAŻNIEJSZE!
    const existingReply = await db.inboxReply.findUnique({
      where: { messageId: email.messageId }
    });
    
    if (existingReply) {
      console.log(`[PROCESSOR] ⏭️  Duplikat (już przetworzony): ${email.messageId}`);
      return {
        replyId: existingReply.id,
        classification: existingReply.classification || "DUPLICATE",
        actionsTaken: [],
        error: "Duplikat - już przetworzone"
      };
    }
    
    // 3. Sprawdź czy to mail z naszej wewnętrznej skrzynki
    const isInternalEmail = await isFromOurMailbox(fromEmail);
    if (isInternalEmail) {
      console.log(`[PROCESSOR] 🔥 Wykryto mail WEWNĘTRZNY z ${fromEmail} - zapisuję do inbox (bez przetwarzania)`);
      
      // NOWE: Zapisz mail wewnętrzny do bazy (dla pełnego inbox)
      const savedReply = await db.inboxReply.create({
        data: {
          messageId: email.messageId,
          threadId: email.inReplyTo || null,
          subject: email.subject,
          content: email.text || email.html || "",
          originalMessage: email.html || email.text || "",
          fromEmail: fromEmail,
          toEmail: toEmail || null, // NOWE: Na którą skrzynkę przyszedł
          receivedAt: email.date,
          classification: "INTERNAL_WARMUP", // Nowa klasyfikacja
          sentiment: null,
          aiSummary: "Mail wewnętrzny (warmup) - nie wymaga analizy AI",
          suggestedAction: null,
          extractedEmails: null,
          extractedData: null,
          leadId: null,
          campaignId: null
        }
      });
      
      return {
        replyId: savedReply.id,
        classification: "INTERNAL_WARMUP",
        actionsTaken: ["Zapisano jako mail wewnętrzny"],
        error: undefined
      };
    }
    
    // 3. Sprawdź czy to bounce (systemowa wiadomość o błędzie)
    if (isBounceEmail(email.text, email.subject)) {
      console.log(`[PROCESSOR] 🚨 Wykryto BOUNCE - systemowa wiadomość o błędzie dostarczenia`);
      
      // Wyciągnij prawdziwy email odbiorcy z treści bounce'a
      const bounceRecipient = extractBounceRecipient(email.text);
      
      if (!bounceRecipient) {
        console.log(`[PROCESSOR] Nie udało się wyciągnąć emaila odbiorcy z bounce'a - pomijam`);
        return {
          replyId: 0,
          classification: "BOUNCE",
          actionsTaken: [],
          error: "Nie można wyciągnąć emaila odbiorcy z bounce'a"
        };
      }
      
      console.log(`[PROCESSOR] Bounce dla emaila: ${bounceRecipient}`);
      
      // Znajdź lead z tym emailem i oznacz jako bounced
      const lead = await db.lead.findFirst({
        where: { email: bounceRecipient }
      });

      // Znajdź kampanię jeśli lead istnieje
      let campaignLead = null;
      if (lead) {
        campaignLead = await db.campaignLead.findFirst({
          where: { leadId: lead.id },
          include: { campaign: true },
          orderBy: { createdAt: "desc" }
        });
      }
      
      // Zaloguj bounce w bazie (ZAWSZE - nawet bez leada, dla pełnego inbox)
      const bounceReply = await db.inboxReply.create({
        data: {
          leadId: lead?.id || null, // Może być null
          campaignId: campaignLead?.campaignId || null,
          messageId: email.messageId,
          threadId: email.inReplyTo || email.messageId,
          subject: email.subject,
          content: email.text,
          fromEmail: bounceRecipient, // Użyj prawdziwego emaila odbiorcy
          toEmail: toEmail || null,
          receivedAt: email.date,
          classification: "BOUNCE",
          sentiment: "negative",
          aiSummary: `Email nie został dostarczony do ${bounceRecipient}`,
          suggestedAction: lead ? "Sprawdź adres email i zablokuj dalsze wysyłki" : "Bounce dla nieznanego leada",
          extractedEmails: JSON.stringify([bounceRecipient]),
          extractedData: JSON.stringify({ bounceRecipient }),
        }
      });
      
      // Jeśli lead istnieje - zablokuj go
      if (lead) {
        console.log(`[PROCESSOR] Bounce przypisany do kampanii: ${campaignLead?.campaignId || 'BRAK'}`);
        
        await db.lead.update({
          where: { id: lead.id },
          data: { 
            status: "BLOKADA",
            subStatus: "BLOKADA_BOUNCE",
            blockedReason: "Bounce - nieprawidłowy adres email"
          }
        });
        console.log(`[PROCESSOR] ✅ Oznaczono lead ${lead.email} jako bounced (status: BLOKADA_BOUNCE)`);
        actionsTaken.push(`Zablokowano lead ${bounceRecipient} z powodu bounce`);
      } else {
        console.log(`[PROCESSOR] ⚠️  Bounce dla nieznanego leada ${bounceRecipient} - zapisano do inbox bez blokowania`);
        actionsTaken.push(`Bounce zapisany do inbox (brak leada w bazie)`);
      }

      return {
        replyId: bounceReply.id,
        classification: "BOUNCE",
        actionsTaken: actionsTaken
      };
    }
    
    // 3. Sprawdź czy to jest odpowiedź na naszą kampanię
    const isReplyToOurCampaign = await checkIfReplyToOurCampaign(email);
    if (!isReplyToOurCampaign) {
      console.log(`[PROCESSOR] Email nie jest odpowiedzią na naszą kampanię - pomijam`);
      return {
        replyId: 0,
        classification: "NOT_OUR_CAMPAIGN",
        actionsTaken: [],
        error: "Email nie związany z naszymi kampaniami"
      };
    }
    
    // 4. Znajdź istniejącego leada (jeśli istnieje)
    const existingLead = await db.lead.findFirst({
      where: { email: fromEmail }
    });
    
    if (existingLead?.isBlocked) {
      console.log(`Lead ${existingLead.email} jest już zablokowany`);
      return {
        replyId: 0,
        classification: "ALREADY_BLOCKED",
        actionsTaken: [],
        error: "Lead już zablokowany"
      };
    }
    
    // 4. Klasyfikuj odpowiedź przez AI (zawsze, niezależnie od tego czy lead istnieje)
    console.log(`[PROCESSOR] Klasyfikuję odpowiedź przez AI...`);
    const classification = await classifyReply(email.text || email.html || "", existingLead?.language || 'pl');
    console.log(`[PROCESSOR] Klasyfikacja AI: ${classification.classification} (sentiment: ${classification.sentiment})`);
    
    // 5. Jeśli nie ma leada, ale odpowiedź jest zainteresowana - stwórz nowego leada
    let currentLead = existingLead;
    let campaign = null;
    
    if (!currentLead) {
      console.log(`[PROCESSOR] Brak leada dla ${fromEmail} - sprawdzam czy tworzyć nowego...`);
      
      if (classification.classification === "INTERESTED") {
        console.log(`[PROCESSOR] Tworzę nowego leada dla zainteresowanego kontaktu: ${fromEmail}`);
        
        // Wyciągnij imię i nazwisko z emaila lub treści (podstawowe)
        const nameFromEmail = fromEmail.split('@')[0].replace(/[._-]/g, ' ');
        const nameParts = nameFromEmail.split(' ');
        
        currentLead = await db.lead.create({
          data: {
            email: fromEmail,
            firstName: nameParts[0] || null,
            lastName: nameParts.slice(1).join(' ') || null,
            company: null, // Będzie trzeba wypełnić ręcznie
            language: 'pl'
          }
        });
        
        actionsTaken.push(`Utworzono nowego leada dla zainteresowanego kontaktu: ${fromEmail}`);
        
        // Dodaj tag "Nowy kontakt"
        let newContactTag = await db.tag.findFirst({ where: { name: "Nowy kontakt" } });
        if (!newContactTag) {
          newContactTag = await db.tag.create({
            data: {
              name: "Nowy kontakt",
              color: "#28a745",
              description: "Kontakty dodane automatycznie z zainteresowanych odpowiedzi"
            }
          });
        }
        
        await db.leadTag.create({
          data: {
            leadId: currentLead.id,
            tagId: newContactTag.id
          }
        });
        
        actionsTaken.push(`Dodano tag "Nowy kontakt"`);
      } else {
        console.log(`[PROCESSOR] Odpowiedź nie jest zainteresowana (${classification.classification}) - nie tworzę leada`);
      }
    }
    
    // 6. Jeśli mamy leada, znajdź powiązaną kampanię
    if (currentLead) {
      const campaignLead = await db.campaignLead.findFirst({
        where: { leadId: currentLead.id },
        include: { campaign: true },
        orderBy: { createdAt: "desc" }
      });
      campaign = campaignLead?.campaign;
    }
    
    // 7. Zapisz odpowiedź do bazy (ZAWSZE - nawet bez leada, dla pełnego inbox)
    if (!currentLead) {
      console.log(`[PROCESSOR] ⚠️  Brak leada dla ${fromEmail} - zapisuję bez powiązania z leadem (pełny inbox)`);
    }

    const reply = await db.inboxReply.create({
      data: {
        leadId: currentLead?.id || null, // Może być null (dla pełnego inbox)
        campaignId: campaign?.id || null, // Może być null jeśli nie ma kampanii
        messageId: email.messageId,
        threadId: email.inReplyTo || null,
        subject: email.subject,
        content: email.text || email.html || "",
        fromEmail: fromEmail,
        toEmail: toEmail || null, // NOWE: Na którą skrzynkę przyszedł
        receivedAt: email.date,
        classification: classification.classification,
        sentiment: classification.sentiment,
        aiSummary: classification.aiSummary,
        suggestedAction: classification.suggestedAction,
        extractedEmails: JSON.stringify(classification.extractedEmails),
        extractedData: JSON.stringify(classification.extractedData),
      }
    });
    
    actionsTaken.push("Zapisano odpowiedź do bazy");
    
    // 8. Pobierz ustawienia (forwardEmail)
    const settings = await db.companySettings.findFirst();
    const forwardEmail = settings?.forwardEmail;
    
    // 9. Wykonaj automatyczne akcje na podstawie klasyfikacji (tylko jeśli mamy leada)
    
    if (classification.classification === "UNSUBSCRIBE" && currentLead) {
      // Zablokuj kontakt
      await db.lead.update({
        where: { id: currentLead.id },
        data: {
          status: "BLOCKED",
          blockedReason: "UNSUBSCRIBE",
          blockedAt: new Date(),
          isBlocked: true // Keep in sync for backward compatibility
        }
      });
      
      // Usuń leada ze wszystkich kampanii (aktywnych i przyszłych)
      await db.campaignLead.deleteMany({
        where: { leadId: currentLead.id }
      });
      
      await db.inboxReply.update({
        where: { id: reply.id },
        data: { wasBlocked: true }
      });
      
      actionsTaken.push("Kontakt zablokowany (UNSUBSCRIBE)");
      actionsTaken.push("Lead usunięty ze wszystkich kampanii");
      
      // Wyślij powiadomienie na forwardEmail
      if (forwardEmail) {
        await sendNotificationEmail(
          forwardEmail,
          "ZABLOKOWANY KONTAKT",
          `Kontakt został zablokowany (prośba o wypisanie):\n\nEmail: ${currentLead.email}\nFirma: ${currentLead.company || "-"}\n\nTreść odpowiedzi:\n${email.text}`,
          email
        );
        actionsTaken.push(`Wysłano powiadomienie do ${forwardEmail}`);
        
        await db.inboxReply.update({
          where: { id: reply.id },
          data: { wasForwarded: true, forwardedAt: new Date() }
        });
      }
    }
    
    if (classification.classification === "NOT_INTERESTED" && currentLead) {
      // Zablokuj kontakt - nie jest zainteresowany
      await db.lead.update({
        where: { id: currentLead.id },
        data: {
          status: "BLOCKED",
          blockedReason: "NOT_INTERESTED",
          blockedAt: new Date(),
          isBlocked: true // Keep in sync for backward compatibility
        }
      });
      
      // Usuń leada ze wszystkich kampanii (aktywnych i przyszłych)
      await db.campaignLead.deleteMany({
        where: { leadId: currentLead.id }
      });
      
      await db.inboxReply.update({
        where: { id: reply.id },
        data: { wasBlocked: true }
      });
      
      actionsTaken.push("Kontakt zablokowany (NOT_INTERESTED)");
      actionsTaken.push("Lead usunięty ze wszystkich kampanii");
      
      // Wyślij powiadomienie na forwardEmail
      if (forwardEmail) {
        await sendNotificationEmail(
          forwardEmail,
          "ZABLOKOWANY KONTAKT",
          `Kontakt został zablokowany (nie jest zainteresowany):\n\nEmail: ${currentLead.email}\nFirma: ${currentLead.company || "-"}\n\nTreść odpowiedzi:\n${email.text}`,
          email
        );
        actionsTaken.push(`Wysłano powiadomienie do ${forwardEmail}`);
        
        await db.inboxReply.update({
          where: { id: reply.id },
          data: { wasForwarded: true, forwardedAt: new Date() }
        });
      }
    }
    
    if (classification.classification === "INTERESTED") {
      // Forward zainteresowanej odpowiedzi do użytkownika (zawsze, nawet jeśli nie ma leada)
      if (forwardEmail) {
        let conversationText = `
========================================
ODPOWIEDŹ KLIENTA (${email.date.toLocaleString("pl-PL")}):
========================================
Od: ${email.from}
Temat: ${email.subject}

${email.text || email.html || "(brak treści)"}

========================================
AI ANALIZA:
========================================
Klasyfikacja: ${classification.classification}
Sentiment: ${classification.sentiment}
Podsumowanie: ${classification.aiSummary}
Sugerowana akcja: ${classification.suggestedAction}

========================================
DANE KLIENTA:
========================================
Email: ${fromEmail}`;

        if (currentLead) {
          // Jeśli mamy leada, dodaj jego dane
          const sentLog = await db.sendLog.findFirst({
            where: {
              leadId: currentLead.id,
              campaignId: campaign?.id
            },
            orderBy: { createdAt: "desc" }
          });
          
          conversationText += `
Imię i nazwisko: ${currentLead.firstName || "-"} ${currentLead.lastName || "-"}
Firma: ${currentLead.company || "-"}
Telefon: (sprawdź w bazie)
LinkedIn: ${currentLead.linkedinUrl || "-"}`;

          if (campaign && sentLog) {
            conversationText += `

========================================
ORYGINALNY MAIL (wysłany ${sentLog.createdAt.toLocaleString("pl-PL")}):
========================================
Temat: ${sentLog.subject || campaign.subject}
Do: ${currentLead.email}

${campaign.text || "(brak treści)"}`;
          }
        } else {
          // Jeśli nie ma leada, to nowy kontakt
          conversationText += `
Status: NOWY KONTAKT (nie był w bazie)
Imię i nazwisko: (do uzupełnienia)
Firma: (do uzupełnienia)`;
        }
        
        conversationText += `

Link do szczegółów: http://localhost:3000/inbox/${reply.id}
        `.trim();
        
        const subject = currentLead 
          ? `[ZAINTERESOWANY] ${currentLead.firstName || ""} ${currentLead.lastName || ""} - ${currentLead.company || ""}`
          : `[NOWY KONTAKT - ZAINTERESOWANY] ${fromEmail}`;
        
        await sendNotificationEmail(
          forwardEmail,
          subject,
          conversationText,
          email
        );
        
        actionsTaken.push(`Forward wysłany do ${forwardEmail}`);
        
        await db.inboxReply.update({
          where: { id: reply.id },
          data: { wasForwarded: true, forwardedAt: new Date() }
        });
      }
    }
    
    if (classification.classification === "OOO" && classification.extractedEmails.length > 0 && currentLead) {
      // Dodaj nowe kontakty (zastępcy) - tylko jeśli mamy oryginalnego leada
      let addedCount = 0;
      
      // Pobierz wszystkich wirtualnych handlowców aby nie dodawać ich jako leadów
      const virtualSalespeople = await db.virtualSalesperson.findMany({
        select: { email: true }
      });
      const virtualEmails = virtualSalespeople.map(vs => vs.email.toLowerCase());
      
      // Użyj extractedData.contacts jeśli dostępne (z AI), inaczej fallback na extractedEmails
      const contactsToAdd = classification.extractedData?.contacts || 
        classification.extractedEmails.map(email => ({ email, firstName: null, lastName: null }));
      
      for (const contact of contactsToAdd) {
        const newEmail = contact.email;
        
        // Filtruj wirtualnych handlowców - nie dodawaj ich jako leadów
        if (virtualEmails.includes(newEmail.toLowerCase())) {
          console.log(`[PROCESSOR] Pomijam ${newEmail} - to wirtualny handlowiec`);
          continue;
        }
        
        // Sprawdź czy email już istnieje
        const existing = await db.lead.findFirst({
          where: { email: newEmail }
        });
        
        if (!existing) {
          // Wygeneruj formę grzecznościową dla nowego kontaktu
          let greetingForm: string | null = "Dzień dobry";
          if (contact.firstName) {
            console.log(`[PROCESSOR] Generuję formę grzecznościową dla: ${contact.firstName}`);
            try {
              const { chatgptService } = await import("@/services/chatgptService");
              const results = await chatgptService.batchProcessNames(
                [contact.firstName],
                [contact.lastName || ''],
                [currentLead.language || "pl"]
              );
              console.log(`[PROCESSOR] Results z chatgptService:`, JSON.stringify(results));
              if (results && results.length > 0 && results[0]?.greetingForm) {
                greetingForm = results[0].greetingForm;
                console.log(`[PROCESSOR] ✅ Wygenerowano formę: "${greetingForm}"`);
              } else {
                console.log(`[PROCESSOR] ⚠️  Brak wyników z chatgptService - używam domyślnego`);
              }
            } catch (error) {
              console.error("[PROCESSOR] ❌ Błąd generowania formy grzecznościowej:", error);
              greetingForm = "Dzień dobry"; // Fallback
            }
          } else {
            console.log(`[PROCESSOR] Brak imienia - używam domyślnego powitania bez tytułu`);
            // Generuj domyślne powitanie BEZ "Pan/Pani" w zależności od języka
            const lang = currentLead.language || "pl";
            if (lang === "en") greetingForm = "Hello,";
            else if (lang === "de") greetingForm = "Guten Tag,";
            else if (lang === "fr") greetingForm = "Bonjour,";
            else greetingForm = "Dzień dobry,";
          }
          
          console.log(`[PROCESSOR] 📝 Zapisuję leada z greetingForm: "${greetingForm}"`);
          
          // Dodaj nowy kontakt z danymi z AI (imię, nazwisko) oraz wygenerowaną formą grzecznościową
          // UWAGA: NIE kopiujemy linkedinUrl - to profil osobisty oryginalnego leada
          await db.lead.create({
            data: {
              email: newEmail,
              firstName: contact.firstName || null,
              lastName: contact.lastName || null,
              greetingForm: greetingForm || "Dzień dobry,",
              company: currentLead.company,
              websiteUrl: currentLead.websiteUrl,
              industry: currentLead.industry,
              companyCity: currentLead.companyCity,
              companyCountry: currentLead.companyCountry,
              language: currentLead.language,
              linkedinUrl: null // Profil LinkedIn jest osobisty - nie kopiujemy
            }
          });
          
          // Pobierz nowo utworzonego leada
          const newLead = await db.lead.findFirst({ where: { email: newEmail } });
          
          if (newLead) {
            // 1. Dodaj tag "OOO Zastępca"
            let oooTag = await db.tag.findFirst({ where: { name: "OOO Zastępca" } });
            if (!oooTag) {
              oooTag = await db.tag.create({
                data: {
                  name: "OOO Zastępca",
                  color: "#FFA500",
                  description: "Kontakty dodane automatycznie jako zastępcy osób na urlopie"
                }
              });
            }
            
            await db.leadTag.create({
              data: {
                leadId: newLead.id,
                tagId: oooTag.id
              }
            });
            
            // 2. Skopiuj wszystkie tagi z oryginalnego leada
            const originalLeadTags = await db.leadTag.findMany({
              where: { leadId: currentLead.id },
              include: { tag: true }
            });
            
            console.log(`[PROCESSOR] 🏷️  Kopiuję ${originalLeadTags.length} tagów z leada ${currentLead.email} do ${newEmail}`);
            
            for (const leadTag of originalLeadTags) {
              // Sprawdź czy tag już nie istnieje (np. już dodaliśmy "OOO Zastępca")
              const existingTag = await db.leadTag.findUnique({
                where: {
                  leadId_tagId: {
                    leadId: newLead.id,
                    tagId: leadTag.tagId
                  }
                }
              });
              
              if (!existingTag) {
                await db.leadTag.create({
                  data: {
                    leadId: newLead.id,
                    tagId: leadTag.tagId
                  }
                });
                console.log(`[PROCESSOR]   ✅ Dodano tag: "${leadTag.tag.name}"`);
              } else {
                console.log(`[PROCESSOR]   ⏭️  Tag "${leadTag.tag.name}" już istnieje - pomijam`);
              }
            }
          }
          
          // Dodaj nowego leada do kampanii z wysokim priorytetem
          // UWAGA: Używamy reply.campaignId, nie campaign.id, bo campaign może być null
          try {
            const replyCampaignId = reply.campaignId;
            console.log(`[PROCESSOR] 📋 Sprawdzam dodawanie do kampanii - newLead: ${!!newLead}, replyCampaignId: ${replyCampaignId}`);
            
            if (newLead && replyCampaignId) {
              console.log(`[PROCESSOR] 🎯 Dodaję leada ${newLead.email} (ID: ${newLead.id}) do kampanii ${replyCampaignId}`);
              
              // Pobierz kampanię aby sprawdzić status
              const targetCampaign = await db.campaign.findUnique({
                where: { id: replyCampaignId }
              });
              
              if (targetCampaign) {
                const campaignStatus = targetCampaign.status;
                console.log(`[PROCESSOR] Kampania: "${targetCampaign.name}", Status: ${campaignStatus}`);
                
                // Sprawdź czy lead już nie jest w kampanii
                const existingCampaignLead = await db.campaignLead.findUnique({
                  where: {
                    campaignId_leadId: {
                      campaignId: targetCampaign.id,
                      leadId: newLead.id
                    }
                  }
                });
                
                if (!existingCampaignLead) {
                  console.log(`[PROCESSOR] Lead nie ma rekordu w CampaignLead - dodaję...`);
                  
                  // Dodaj do kampanii głównej (bez względu na status)
                  const createdCL = await db.campaignLead.create({
                    data: {
                      campaignId: targetCampaign.id,
                      leadId: newLead.id,
                      status: 'queued', // Gotowy do wysłania
                      priority: 1 // Wysoki priorytet - wyślij jako pierwszy!
                    }
                  });
                  console.log(`[PROCESSOR] ✅ Dodano OOO leada do kampanii (CampaignLead ID: ${createdCL.id}, priority: 1)`);
                  
                  // Jeśli kampania jest zakończona, wznów ją aby wysłać maila do OOO leada
                  if (campaignStatus === 'COMPLETED') {
                    console.log(`[PROCESSOR] 🔄 Kampania zakończona - wznawiamy ją dla OOO leada`);
                    
                    await db.campaign.update({
                      where: { id: targetCampaign.id },
                      data: {
                        status: 'IN_PROGRESS',
                        sendingStartedAt: new Date() // Zacznij od razu
                      }
                    });
                    
                    console.log(`[PROCESSOR] ✅ Kampania wznowiona (status: IN_PROGRESS)`);
                    actionsTaken.push(`Dodano do kampanii ${targetCampaign.name} (kampania wznowiona)`);
                  } else if (campaignStatus === 'IN_PROGRESS' || campaignStatus === 'SCHEDULED') {
                    actionsTaken.push(`Dodano do kampanii ${targetCampaign.name} (wysoki priorytet)`);
                  } else if (campaignStatus === 'DRAFT') {
                    actionsTaken.push(`Dodano do kampanii ${targetCampaign.name} (wysoki priorytet - wyśle się automatycznie)`);
                  } else {
                    actionsTaken.push(`Dodano do kampanii ${targetCampaign.name} (oczekuje na uruchomienie)`);
                  }
                  
                  // Dodaj OOO leada także do wszystkich zaplanowanych follow-up kampanii
                  const futureFollowUps = await db.campaign.findMany({
                    where: {
                      parentCampaignId: targetCampaign.id,
                      isFollowUp: true,
                      status: { in: ['DRAFT', 'SCHEDULED', 'IN_PROGRESS'] }
                    }
                  });

                  for (const followUp of futureFollowUps) {
                    const existingFollowUpLead = await db.campaignLead.findFirst({
                      where: {
                        campaignId: followUp.id,
                        leadId: newLead.id
                      }
                    });

                    if (!existingFollowUpLead) {
                      await db.campaignLead.create({
                        data: {
                          campaignId: followUp.id,
                          leadId: newLead.id,
                          status: 'planned',
                          priority: 1
                        }
                      });
                      console.log(`[PROCESSOR] ✅ Dodano OOO leada do follow-up kampanii ${followUp.name} (ID: ${followUp.id})`);
                    }
                  }

                  if (futureFollowUps.length > 0) {
                    actionsTaken.push(`Dodano do ${futureFollowUps.length} zaplanowanych follow-up kampanii`);
                  }
                  
                  // 🚀 WYSYŁKA NATYCHMIASTOWA dla kampanii bez harmonogramu (testy manualne)
                  // Obsługuje statusy: DRAFT (przed pierwszą wysyłką), COMPLETED (po wysyłce), IN_PROGRESS (wzno wiona)
                  if (!targetCampaign.scheduledAt) {
                    console.log(`[PROCESSOR] 🚀 Kampania bez harmonogramu (status: ${campaignStatus}) - wysyłam OOO lead natychmiast!`);
                    
                    try {
                      const { sendCampaignEmail } = await import("@/integrations/smtp/client");
                      const companySettings = await db.companySettings.findFirst();
                      
                      // Przygotuj treść z greeting form
                      let content = targetCampaign.text || "";
                      if (newLead.greetingForm && targetCampaign.text) {
                        content = newLead.greetingForm + "\n\n" + targetCampaign.text;
                      }
                      
                      // Pobierz dostępną skrzynkę (round-robin)
                      let mailbox = null;
                      if (targetCampaign.virtualSalespersonId) {
                        const { getNextAvailableMailbox, incrementMailboxCounter } = await import("@/services/mailboxManager");
                        mailbox = await getNextAvailableMailbox(targetCampaign.virtualSalespersonId);
                      }
                      
                      // Wyślij mail
                      const result = await sendCampaignEmail({
                        subject: targetCampaign.subject || "Brak tematu",
                        content: content,
                        leadEmail: newLead.email,
                        leadLanguage: newLead.language || "pl",
                        leadName: newLead.firstName ? `${newLead.firstName} ${newLead.lastName || ''}`.trim() : undefined,
                        leadCompany: newLead.company || undefined,
                        salesperson: targetCampaign.virtualSalespersonId ? { id: targetCampaign.virtualSalespersonId } as any : undefined,
                        mailbox: mailbox || undefined, // NOWE: Dodane mailbox
                        campaign: {
                          jobDescription: targetCampaign.jobDescription,
                          postscript: targetCampaign.postscript,
                          linkText: targetCampaign.linkText,
                          linkUrl: targetCampaign.linkUrl
                        },
                        settings: companySettings || undefined
                      });
                      
                      // Zapisz log wysyłki
                      await db.sendLog.create({
                        data: {
                          campaignId: targetCampaign.id,
                          leadId: newLead.id,
                          mailboxId: mailbox?.id || null, // NOWE: Dodaj mailboxId
                          subject: targetCampaign.subject || "Brak tematu", // NOWE: Zapisz subject
                          content: content, // NOWE: Zapisz content
                          status: "sent",
                          messageId: result.messageId
                        }
                      });
                      
                      // Inkrementuj licznik użycia skrzynki
                      if (mailbox) {
                        const { incrementMailboxCounter } = await import("@/services/mailboxManager");
                        await incrementMailboxCounter(mailbox.id);
                      }
                      
                      console.log(`[PROCESSOR] ✅ OOO lead wysłany natychmiast do ${newLead.email}`);
                      actionsTaken.push(`Wysłano mail OOO natychmiast (test manualny)`);
                      
                      // Jeśli wszystkie leady w kampanii zostały wysłane, oznacz jako COMPLETED
                      const totalLeads = await db.campaignLead.count({
                        where: { 
                          campaignId: targetCampaign.id,
                          lead: { status: { not: "BLOCKED" } }
                        }
                      });
                      const sentLeads = await db.sendLog.count({
                        where: { 
                          campaignId: targetCampaign.id,
                          status: "sent"
                        }
                      });
                      
                      if (sentLeads >= totalLeads) {
                        await db.campaign.update({
                          where: { id: targetCampaign.id },
                          data: {
                            status: 'COMPLETED',
                            sendingCompletedAt: new Date()
                          }
                        });
                        console.log(`[PROCESSOR] ✅ Wszystkie leady wysłane - kampania COMPLETED`);
                      }
                      
                    } catch (sendError: any) {
                      console.error(`[PROCESSOR] ❌ Błąd wysyłki OOO lead:`, sendError);
                      
                      // Zapisz log błędu
                      await db.sendLog.create({
                        data: {
                          campaignId: targetCampaign.id,
                          leadId: newLead.id,
                          status: "error",
                          error: sendError.message || "Nieznany błąd"
                        }
                      });
                      
                      actionsTaken.push(`Błąd wysyłki OOO: ${sendError.message}`);
                    }
                  } else if (targetCampaign.scheduledAt) {
                    console.log(`[PROCESSOR] ⏰ Kampania z harmonogramem - OOO lead wyśle się automatycznie w cronie`);
                    actionsTaken.push(`OOO lead wyśle się według harmonogramu (${targetCampaign.startHour}:00-${targetCampaign.endHour}:00)`);
                  }
                  
                } else {
                  console.log(`[PROCESSOR] ℹ️  Lead już jest w kampanii (CampaignLead ID: ${existingCampaignLead.id}) - pomijam`);
                }
              } else {
                console.log(`[PROCESSOR] ⚠️  Nie znaleziono kampanii ${replyCampaignId}`);
              }
            } else {
              console.log(`[PROCESSOR] ⚠️  Pomijam dodawanie do kampanii - brak wymaganych danych`);
            }
          } catch (error) {
            console.error(`[PROCESSOR] ❌ BŁĄD dodawania do CampaignLead:`, error);
          }
          
          addedCount++;
          const contactName = contact.firstName && contact.lastName 
            ? `${contact.firstName} ${contact.lastName} (${newEmail})`
            : newEmail;
          actionsTaken.push(`Dodano nowy kontakt: ${contactName}`);
        }
      }
      
      await db.inboxReply.update({
        where: { id: reply.id },
        data: { newContactsAdded: addedCount }
      });
      
      // Wyślij powiadomienie o nowych kontaktach
      if (forwardEmail && addedCount > 0) {
        // Pobierz tagi oryginalnego leada dla komunikatu
        const originalTags = await db.leadTag.findMany({
          where: { leadId: currentLead.id },
          include: { tag: true }
        });
        const tagsInfo = originalTags.length > 0 
          ? `\n\nSkopiowane tagi: ${originalTags.map(lt => lt.tag.name).join(", ")}`
          : "";
        
        await sendNotificationEmail(
          forwardEmail,
          `NOWE KONTAKTY (${addedCount}) - OOO Zastępcy`,
          `Automatycznie dodano ${addedCount} nowych kontaktów jako zastępców osoby na urlopie:\n\nOryginalny kontakt: ${currentLead.email} (${currentLead.company})\n\nNowe kontakty:\n${classification.extractedEmails.join("\n")}\n\nKontakty zostały oznaczone tagiem "OOO Zastępca" i skopiowały dane firmy.${tagsInfo}`,
          email
        );
        actionsTaken.push(`Wysłano powiadomienie o ${addedCount} nowych kontaktach`);
      }
    }
    
    return {
      replyId: reply.id,
      classification: classification.classification,
      actionsTaken
    };
    
  } catch (error: any) {
    console.error("Błąd przetwarzania odpowiedzi:", error);
    return {
      replyId: 0,
      classification: "ERROR",
      actionsTaken: [],
      error: error.message
    };
  }
}

/**
 * Wysyła powiadomienie email
 */
async function sendNotificationEmail(
  to: string,
  subject: string,
  message: string,
  originalEmail: ParsedEmail
) {
  try {
    await sendCampaignEmail({
      subject: `[Kreativia Mailing] ${subject}`,
      content: message,
      leadEmail: to,
      leadLanguage: 'pl',
    });
  } catch (error) {
    console.error("Błąd wysyłki powiadomienia:", error);
  }
}

/**
 * Sprawdza czy email jest związany z naszymi kampaniami
 * Używa TYLKO bazy danych (bez AI dla oszczędności requestów)
 */
async function checkIfReplyToOurCampaign(email: ParsedEmail): Promise<boolean> {
  try {
    console.log(`[PROCESSOR] Sprawdzam czy email jest związany z naszymi kampaniami...`);
    
    // 1. Sprawdź czy nadawca jest w naszej bazie leadów
    const fromEmailMatch = email.from.match(/[\w.-]+@[\w.-]+\.\w+/);
    const fromEmail = fromEmailMatch ? fromEmailMatch[0] : email.from;
    
    const existingLead = await db.lead.findFirst({
      where: { email: fromEmail }
    });
    
    // 2. Sprawdź czy mamy wysłane emaile do tego leada
    if (existingLead) {
      const sentEmails = await db.sendLog.count({
        where: { 
          leadId: existingLead.id,
          status: "sent"
        }
      });
      
      if (sentEmails > 0) {
        console.log(`[PROCESSOR] ✅ Lead ${fromEmail} jest w bazie i otrzymał ${sentEmails} emaili - to nasza kampania`);
        return true;
      } else {
        console.log(`[PROCESSOR] ⚠️ Lead ${fromEmail} jest w bazie ale nie otrzymał emaili - prawdopodobnie ręcznie dodany`);
        // Jeśli lead jest w bazie ale nie wysłaliśmy mu emaila, uznajemy że może być związane
        return true;
      }
    }
    
    // 3. Jeśli nie ma w bazie - używamy heurystyki bez AI
    console.log(`[PROCESSOR] ℹ️ Lead ${fromEmail} nie jest w bazie - używam heurystyki...`);
    
    const emailContent = (email.text || email.html || "").toLowerCase();
    const emailSubject = (email.subject || "").toLowerCase();
    
    // Proste sprawdzenie czy to może być zapytanie (heurystyka)
    const inquiryKeywords = [
      "proszę o ofertę", "interesuje mnie", "chciałbym zapytać", "potrzebuję",
      "czy możecie", "jakie są koszty", "ile kosztuje", "wycena", "termin realizacji",
      "materiały pos", "materiały vm", "podwieszenia", "stoiska", "zainteresowany"
    ];
    
    const hasInquiryKeywords = inquiryKeywords.some(keyword => 
      emailContent.includes(keyword) || emailSubject.includes(keyword)
    );
    
    if (hasInquiryKeywords) {
      console.log(`[PROCESSOR] ✅ Wykryto słowa kluczowe zapytania - prawdopodobnie związane`);
      return true;
    }
    
    // 4. Jeśli nie pasuje do żadnej kategorii - domyślnie przyjmij że może być związane
    // (bezpieczniejsze niż odrzucanie potencjalnych leadów)
    console.log(`[PROCESSOR] ⚠️ Brak wyraźnych wskaźników - zakładam że może być związane (bezpieczniej)`);
    return true;
    
  } catch (error) {
    console.error("[PROCESSOR] Błąd sprawdzania emaila:", error);
    // W razie błędu, zakładamy że to może być związane (bezpieczniejsze)
    return true;
  }
}

/**
 * Wyciąga prawdziwy email odbiorcy z treści bounce'a
 */
function extractBounceRecipient(content: string): string | null {
  // Typowe pola z emailem odbiorcy w bounce'ach
  const patterns = [
    /Final-Recipient:\s*RFC822;\s*([\w.-]+@[\w.-]+\.\w+)/i,
    /X-Actual-Recipient:\s*rfc822;\s*([\w.-]+@[\w.-]+\.\w+)/i,
    /Original-Recipient:\s*rfc822;\s*([\w.-]+@[\w.-]+\.\w+)/i,
    /<([\w.-]+@[\w.-]+\.\w+)>/,
    /permanent fatal errors.*?<([\w.-]+@[\w.-]+\.\w+)>/is,
    /user unknown.*?([\w.-]+@[\w.-]+\.\w+)/i,
    /mailbox unavailable.*?([\w.-]+@[\w.-]+\.\w+)/i,
    /address not found.*?([\w.-]+@[\w.-]+\.\w+)/i
  ];

  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match && match[1]) {
      return match[1].toLowerCase();
    }
  }

  return null;
}

/**
 * Sprawdza czy email to bounce (systemowa wiadomość o błędzie dostarczenia)
 */
function isBounceEmail(content: string, subject: string): boolean {
  // Sprawdź czy to prawdziwy bounce - tylko bardzo specyficzne frazy
  const bounceIndicators = [
    // Typowe frazy w bounce'ach - tylko bardzo specyficzne
    'permanent fatal errors',
    'hop count exceeded',
    'mail loop',
    'service unavailable',
    'final-recipient: rfc822',
    'diagnostic-code: smtp',
    'reporting-mta:',
    'received-from-mta:',
    'action: failed',
    'status: 5.',
    'remote-mta:',
    'last-attempt-date:',
    'delivery failure',
    'undeliverable',
    'mailbox unavailable',
    'user unknown',
    'address not found',
    'recipient address rejected',
    'message rejected',
    'bounce',
    'returned mail',
    'mail delivery subsystem',
    'postmaster',
    'mailer-daemon',
    'noreply',
    'no-reply',
    // Usunięto problematyczne frazy które mogą występować w normalnych mailach
    '<<< 554',
    '554 5.4.14',
    '554 5.0.0',
    'mail delivery subsystem',
    'postmaster@',
    'mailer-daemon@',
    'noreply@',
    'no-reply@',
    'bounce@',
    'returned-mail@',
    'delivery-failure@',
    'undeliverable@',
    'mailbox-unavailable@',
    'user-unknown@',
    'address-not-found@',
    'recipient-address-rejected@',
    'message-rejected@',
    'system-message@',
    'delivery-notification@',
    'failure-notice@',
    'error-report@',
    'delivery-status-notification@',
    'dsn@',
    'message-id@',
    'original-message-id@',
    'original-recipient@',
    'reporting-mta@',
    'arrival-date@',
    'final-recipient@',
    'x-actual-recipient@',
    'action@',
    'status@',
    'remote-mta@',
    'diagnostic-code@',
    'last-attempt-date@'
  ];

  const text = (content + ' ' + subject).toLowerCase();
  
  // Sprawdź czy zawiera typowe frazy bounce'ów
  const hasBounceIndicators = bounceIndicators.some(indicator => 
    text.includes(indicator.toLowerCase())
  );

  // Sprawdź czy to typowy format bounce'a (wiele linii z ":", "---", itp.)
  const hasBounceFormat = (
    text.includes('-----') && 
    text.includes('status:') && 
    text.includes('action:') &&
    text.includes('diagnostic-code:')
  );

  // Sprawdź czy to email od systemu (postmaster, mailer-daemon, itp.)
  const isSystemEmail = text.includes('postmaster') || 
                       text.includes('mailer-daemon') || 
                       text.includes('noreply') || 
                       text.includes('no-reply') ||
                       text.includes('bounce') ||
                       text.includes('returned-mail') ||
                       text.includes('delivery-failure') ||
                       text.includes('undeliverable') ||
                       text.includes('mailbox-unavailable') ||
                       text.includes('user-unknown') ||
                       text.includes('address-not-found') ||
                       text.includes('recipient-address-rejected') ||
                       text.includes('message-rejected') ||
                       text.includes('system-message') ||
                       text.includes('delivery-notification') ||
                       text.includes('failure-notice') ||
                       text.includes('error-report') ||
                       text.includes('delivery-status-notification') ||
                       text.includes('dsn') ||
                       text.includes('message-id') ||
                       text.includes('original-message-id') ||
                       text.includes('original-recipient') ||
                       text.includes('reporting-mta') ||
                       text.includes('arrival-date') ||
                       text.includes('final-recipient') ||
                       text.includes('x-actual-recipient') ||
                       text.includes('action') ||
                       text.includes('status') ||
                       text.includes('remote-mta') ||
                       text.includes('diagnostic-code') ||
                       text.includes('last-attempt-date');

  return hasBounceIndicators || hasBounceFormat || isSystemEmail;
}

// ========================================
// FUNKCJE POMOCNICZE USUNIĘTE:
// - analyzeEmailIntent() - używała ChatGPT (duże zużycie API)
// - analyzeEmailIntentHeuristic() - nieużywana
// 
// Teraz checkIfReplyToOurCampaign() używa tylko bazy danych + prostej heurystyki
// ========================================

/**
 * Sprawdza czy email jest z naszej wewnętrznej skrzynki (Mailbox w systemie)
 * Jeśli TAK - ignoruj (warmup, testy, komunikacja wewnętrzna)
 */
async function isFromOurMailbox(fromEmail: string): Promise<boolean> {
  try {
    const mailbox = await db.mailbox.findUnique({
      where: { email: fromEmail.toLowerCase() }
    });
    
    return mailbox !== null;
  } catch (error) {
    console.error('[PROCESSOR] Błąd sprawdzania mailbox:', error);
    return false; // W razie błędu, nie ignoruj (bezpieczniejsze)
  }
}

/**
 * DEPRECATED - Stara funkcja sprawdzania warmup
 * Teraz używamy isFromOurMailbox() - sprawdza czy email jest z naszej skrzynki
 */
function isWarmupEmail(fromEmail: string, subject: string, content: string): boolean {
  // Sprawdź czy nadawca to jedna z naszych skrzynek (warmup maile są między naszymi skrzynkami)
  const ourDomains = ['kreativia.pl', 'kreativia.eu'];
  const fromDomain = fromEmail.split('@')[1]?.toLowerCase() || '';
  
  // Sprawdź czy domena kończy się na jedną z naszych domen
  const isOurDomain = ourDomains.some(domain => 
    fromDomain === domain || fromDomain.endsWith('.' + domain)
  );
  
  if (!isOurDomain) {
    return false; // Nie z naszej domeny = nie warmup
  }
  
  // Sprawdź charakterystyczne frazy z warmup templates
  const warmupIndicators = [
    'Test połączenia',
    'Sprawdzenie połączenia SMTP',
    'Powiadomienie systemowe',
    'Codzienne sprawdzenie systemu',
    'Aktualizacja systemu',
    'Sprawdzenie poczty',
    'Test dostarczenia',
    'Weryfikacja połączenia',
    'Test automatycznego dostarczenia',
    'Test systemu mailowego',
    'system mailowego Kreativia',
    'automatyczny test systemu',
    'rutynowy test w ramach utrzymania'
  ];
  
  const subjectLower = subject.toLowerCase();
  const contentLower = content.toLowerCase();
  
  // Jeśli znaleziono warmup indicator w temacie lub treści
  for (const indicator of warmupIndicators) {
    if (subjectLower.includes(indicator.toLowerCase()) || 
        contentLower.includes(indicator.toLowerCase())) {
      return true;
    }
  }
  
  return false;
}

