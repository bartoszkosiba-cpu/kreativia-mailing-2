import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { markAllEmailsAsSeen } from "@/integrations/imap/client";

export async function POST(req: NextRequest) {
  try {
    const { confirmationCode } = await req.json();
    
    // Wymagaj kodu potwierdzenia
    if (confirmationCode !== "RESET") {
      return NextResponse.json({ 
        error: "Nieprawidłowy kod potwierdzenia. Wpisz 'RESET' aby potwierdzić." 
      }, { status: 400 });
    }
    
    console.log("[RESET DATABASE] 🚨 Rozpoczynam resetowanie bazy danych...");
    
    // KROK 0: Oznacz wszystkie maile na serwerze IMAP jako przeczytane
    let markedEmailsCount = 0;
    try {
      console.log("[RESET DATABASE] Oznaczam wszystkie maile na serwerze jako przeczytane...");
      const result = await markAllEmailsAsSeen();
      markedEmailsCount = result.marked;
      console.log(`[RESET DATABASE] ✓ Oznaczono ${markedEmailsCount} maili jako przeczytane na serwerze IMAP`);
    } catch (imapError) {
      console.error("[RESET DATABASE] ⚠️ Błąd oznaczania maili na serwerze IMAP:", imapError);
      console.log("[RESET DATABASE] Kontynuuję reset bazy mimo błędu IMAP...");
    }
    
    // TODO: Przywrócić SystemState table w przyszłości dla śledzenia timestampu resetu
    console.log(`[RESET DATABASE] ✓ Reset zakończony pomyślnie`);
    
    // Kolejność usuwania jest KRYTYCZNA ze względu na foreign keys
    
    // 1. InboxReply (zależy od Lead i Campaign)
    const deletedReplies = await db.inboxReply.deleteMany();
    console.log(`[RESET DATABASE] ✓ Usunięto ${deletedReplies.count} odpowiedzi z inbox`);
    
    // 2. SendLog (zależy od Lead i Campaign)
    const deletedSendLogs = await db.sendLog.deleteMany();
    console.log(`[RESET DATABASE] ✓ Usunięto ${deletedSendLogs.count} logów wysyłek`);
    
    // 3. CampaignLead (zależy od Lead i Campaign)
    const deletedCampaignLeads = await db.campaignLead.deleteMany();
    console.log(`[RESET DATABASE] ✓ Usunięto ${deletedCampaignLeads.count} powiązań leadów z kampaniami`);
    
    // 4. LeadTag (zależy od Lead i Tag)
    const deletedLeadTags = await db.leadTag.deleteMany();
    console.log(`[RESET DATABASE] ✓ Usunięto ${deletedLeadTags.count} powiązań leadów z tagami`);
    
    // 5. Lead (teraz można bezpiecznie usunąć WSZYSTKIE, także spam i zablokowane)
    const deletedLeads = await db.lead.deleteMany();
    console.log(`[RESET DATABASE] ✓ Usunięto ${deletedLeads.count} leadów (w tym spam i zablokowane)`);
    
    // 6. Campaign (teraz można bezpiecznie usunąć, zaktualizuj parent references)
    await db.campaign.updateMany({
      where: { parentCampaignId: { not: null } },
      data: { parentCampaignId: null }
    });
    
    const deletedCampaigns = await db.campaign.deleteMany();
    console.log(`[RESET DATABASE] ✓ Usunięto ${deletedCampaigns.count} kampanii`);
    
    // 7. Usuń wszystkie tagi
    const deletedTags = await db.tag.deleteMany();
    console.log(`[RESET DATABASE] ✓ Usunięto ${deletedTags.count} tagów`);
    
    // 8. Zresetuj liczniki campaign (warmup zostaje!)
    await db.mailbox.updateMany({
      data: {
        currentDailySent: 0  // Tylko campaign, warmupTodaySent zostaje
      }
    });
    console.log(`[RESET DATABASE] ✓ Zresetowano liczniki campaign (warmup zachowany)`);
    
    console.log("[RESET DATABASE] 🎉 Resetowanie bazy zakończone pomyślnie!");
    
    return NextResponse.json({ 
      success: true,
      message: "Baza danych została zresetowana (warmup zachowany)",
      stats: {
        markedEmailsOnServer: markedEmailsCount,
        deletedReplies: deletedReplies.count,
        deletedSendLogs: deletedSendLogs.count,
        deletedCampaignLeads: deletedCampaignLeads.count,
        deletedLeadTags: deletedLeadTags.count,
        deletedLeads: deletedLeads.count,
        deletedCampaigns: deletedCampaigns.count,
        deletedTags: deletedTags.count
      },
      kept: {
        mailboxes: "Zachowane (z warmup)",
        salespeople: "Zachowane",
        warmupProgress: "Zachowany"
      }
    }, { status: 200 });
    
  } catch (error) {
    console.error("[RESET DATABASE] ❌ Błąd resetowania bazy:", error);
    return NextResponse.json({ 
      error: "Wystąpił błąd podczas resetowania bazy danych",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
}

