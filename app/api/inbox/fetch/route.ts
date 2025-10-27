import { NextResponse } from "next/server";
import { fetchUnreadEmails } from "@/integrations/imap/client";
import { processReply } from "@/integrations/inbox/processor";

/**
 * Endpoint do ręcznego pobierania nowych maili z IMAP
 * POST /api/inbox/fetch
 */
export async function POST() {
  try {
    console.log("[FETCH] Rozpoczynam pobieranie maili ze wszystkich skrzynek...");
    
    // Pobierz wszystkie aktywne mailboxy
    const { db } = await import('@/lib/db');
    const allMailboxes = await db.mailbox.findMany({
      where: {
        isActive: true
      },
      include: {
        virtualSalesperson: true
      }
    });
    
    // Filtruj mailboxy które mają IMAP skonfigurowane
    const mailboxes = allMailboxes.filter(mb => 
      mb.imapHost && mb.imapUser && mb.imapPass
    );

    console.log(`[FETCH] 📬 Znaleziono ${mailboxes.length} aktywnych skrzynek z IMAP`);

    let totalEmailsCount = 0;
    const allResults = [];

    // Iteruj po każdym mailbox i pobierz maile
    for (const mailbox of mailboxes) {
      console.log(`[FETCH] 📥 Sprawdzam skrzynkę: ${mailbox.email}...`);
      
      try {
        // Konfiguracja IMAP dla tego mailbox
        const imapConfig = {
          imapHost: mailbox.imapHost!,
          imapPort: mailbox.imapPort!,
          imapUser: mailbox.imapUser!,
          imapPass: mailbox.imapPass!,
          imapSecure: mailbox.imapSecure ?? true,
          createdAt: mailbox.createdAt // Przekaż datę utworzenia skrzynki jako filtr
        };

        // Pobierz nowe maile z tego mailbox
        const emails = await fetchUnreadEmails(imapConfig);
        console.log(`[FETCH] ✓ Pobrano ${emails.length} maili z ${mailbox.email}`);
        
        totalEmailsCount += emails.length;

        // Przetwórz każdy mail
        for (let i = 0; i < emails.length; i++) {
          const email = emails[i];
          console.log(`[FETCH] Przetwarzam mail ${i + 1}/${emails.length}: ${email.subject} (z ${mailbox.email})`);
          try {
            const result = await processReply(email, mailbox.email); // Przekaż toEmail
            console.log(`[FETCH] ✓ Mail ${i + 1} przetworzony: ${result.classification}`);
            allResults.push({
              ...result,
              mailbox: mailbox.email
            });
            
            // Automatycznie uruchom AI Agent dla nowej odpowiedzi
            if (result.replyId) {
              try {
                const { EmailAgentAI } = await import('@/services/emailAgentAI');
                const analysis = await EmailAgentAI.processEmailReply(result.replyId);
                await EmailAgentAI.executeActions(analysis, result.replyId);
                console.log(`[FETCH] 🤖 AI Agent przetworzył odpowiedź ID: ${result.replyId}`);
              } catch (aiError: any) {
                console.error(`[FETCH] ⚠ Błąd AI Agent dla odpowiedzi ${result.replyId}:`, aiError.message);
              }
            }
          } catch (error: any) {
            console.error(`[FETCH] ✗ Błąd przetwarzania maila ${i + 1}:`, error.message);
            allResults.push({ 
              error: error.message, 
              replyId: 0, 
              classification: "ERROR", 
              actionsTaken: [],
              mailbox: mailbox.email
            });
          }
        }
      } catch (error: any) {
        console.error(`[FETCH] ✗ Błąd pobierania maili z ${mailbox.email}:`, error.message);
        allResults.push({
          error: `Błąd pobierania z ${mailbox.email}: ${error.message}`,
          replyId: 0,
          classification: "ERROR",
          actionsTaken: [],
          mailbox: mailbox.email
        });
      }
    }
    
    if (totalEmailsCount === 0) {
      return NextResponse.json({
        message: "Brak nowych maili",
        count: 0,
        mailboxCount: mailboxes.length,
        results: []
      });
    }
    
    const successCount = allResults.filter(r => !r.error).length;
    const errorCount = allResults.filter(r => r.error).length;
    
    console.log(`[FETCH] 🎉 Zakończono: ${totalEmailsCount} maili, ${successCount} sukcesów, ${errorCount} błędów`);
    
    return NextResponse.json({
      message: `Przetworzono ${successCount} nowych odpowiedzi (błędów: ${errorCount})`,
      count: totalEmailsCount,
      mailboxCount: mailboxes.length,
      success: successCount,
      errors: errorCount,
      results: allResults
    });
    
  } catch (error: any) {
    console.error("[FETCH] Błąd pobierania maili:", error);
    return NextResponse.json(
      { error: "Błąd pobierania maili", details: error.message },
      { status: 500 }
    );
  }
}

