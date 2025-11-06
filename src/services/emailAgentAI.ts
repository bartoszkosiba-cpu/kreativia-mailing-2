// Email Agent AI - Główny moduł klasyfikacji i zarządzania statusami
import { db } from "@/lib/db";
import { AIRulesManager, type AIRule } from "./aiRulesManager";
import { classifyReply } from "@/integrations/ai/client";
import type { LeadStatus, LeadSubStatus } from "@/types/leadStatus";
import { analyzeMaterialRequest } from "./materialResponseAI";

export interface EmailClassification {
  classification: string;
  confidence: number;
  matchedRule?: AIRule;
  matchedKeywords: string[];
  matchedPattern?: string;
  extractedEmails: string[];
  extractedData: Record<string, any>;
}

export interface EmailAction {
  type: 'FORWARD' | 'BLOCK' | 'UNSUBSCRIBE' | 'ADD_LEAD' | 'SCHEDULE_FOLLOWUP' | 'AUTO_FOLLOWUP' | 'NOTIFY' | 'NO_ACTION' | 'SEND_MATERIALS' | 'ASK_ADMIN_MATERIALS';
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  description: string;
  data?: any;
}

export interface EmailAnalysis {
  classification: EmailClassification;
  actions: EmailAction[];
  leadStatus: LeadStatus;
  leadSubStatus?: LeadSubStatus;
  shouldBlockCampaigns: number[]; // Campaign IDs to block
  shouldCreateDerivativeLeads: boolean;
  derivativeLeadData?: {
    emails: string[];
    source: string;
    sourceDetails: string;
  };
  materialAnalysis?: {
    isMaterialRequest: boolean;
    confidence: number;
    reasoning: string;
    suggestedAction: "SEND" | "DONT_SEND" | "ASK_ADMIN";
  };
}

/**
 * Email Agent AI - główny moduł klasyfikacji
 */
export class EmailAgentAI {

  /**
   * Klasyfikuje email używając zasad (stałych + dynamicznych)
   */
  static async classifyEmail(
    content: string, 
    language: string = 'pl'
  ): Promise<EmailClassification> {
    console.log(`[EMAIL AGENT AI] Klasyfikuję email (${language}): ${content.substring(0, 100)}...`);

    // 1. Pobierz wszystkie aktywne zasady
    const rules = await AIRulesManager.getActiveRules();
    console.log(`[EMAIL AGENT AI] Znaleziono ${rules.length} aktywnych zasad`);

    // 2. Testuj każdą zasadę
    let bestMatch: {
      rule: AIRule;
      confidence: number;
      matchedKeywords: string[];
      matchedPattern?: string;
    } | null = null;

    for (const rule of rules) {
      const testResult = AIRulesManager.testRule(rule, content);
      
      if (testResult.matches) {
        const finalConfidence = testResult.confidence * rule.priority / 100;
        
        if (!bestMatch || finalConfidence > bestMatch.confidence) {
          bestMatch = {
            rule,
            confidence: finalConfidence,
            matchedKeywords: testResult.matchedKeywords,
            matchedPattern: testResult.matchedPattern
          };
        }
      }
    }

    // 3. Jeśli nie ma dopasowania, użyj fallback AI
    if (!bestMatch) {
      console.log(`[EMAIL AGENT AI] Brak dopasowania w zasadach, używam fallback AI`);
      const aiResult = await classifyReply(content, language);
      
      return {
        classification: aiResult.classification,
        confidence: 0.9, // AI ma wysoką pewność
        matchedKeywords: [],
        extractedEmails: aiResult.extractedEmails || [],
        extractedData: aiResult.extractedData || {}
      };
    }

    // 4. Wyciągnij emaile z treści
    const extractedEmails = this.extractEmailsFromContent(content);

    console.log(`[EMAIL AGENT AI] Najlepsze dopasowanie: ${bestMatch.rule.classification} (confidence: ${bestMatch.confidence})`);

    return {
      classification: bestMatch.rule.classification,
      confidence: bestMatch.confidence,
      matchedRule: bestMatch.rule,
      matchedKeywords: bestMatch.matchedKeywords,
      matchedPattern: bestMatch.matchedPattern,
      extractedEmails,
      extractedData: {}
    };
  }

  /**
   * Przetwarza odpowiedź emailową i określa akcje
   */
  static async processEmailReply(replyId: number): Promise<EmailAnalysis> {
    console.log(`[EMAIL AGENT AI] Przetwarzam odpowiedź ID: ${replyId}`);

    // 1. Pobierz odpowiedź z bazy
    const reply = await db.inboxReply.findUnique({
      where: { id: replyId },
      include: {
        lead: true,
        campaign: {
          include: {
            virtualSalesperson: true
          }
        }
      }
    });

    if (!reply) {
      throw new Error(`Nie znaleziono odpowiedzi o ID: ${replyId}`);
    }

    // 2. Klasyfikuj email
    const classification = await this.classifyEmail(
      reply.content || '',
      reply.lead?.language || 'pl'
    );

    // 3. Określ akcje na podstawie klasyfikacji
    const analysis = await this.determineActions(classification, reply);

    console.log(`[EMAIL AGENT AI] Analiza zakończona: ${analysis.leadStatus}/${analysis.leadSubStatus}`);

    return analysis;
  }

  /**
   * Określa akcje na podstawie klasyfikacji
   */
  private static async determineActions(
    classification: EmailClassification,
    reply: any
  ): Promise<EmailAnalysis> {
    const { classification: classType, extractedEmails } = classification;
    const campaignId = reply.campaign?.id;

    switch (classType) {
      case 'INTERESTED':
        // ✅ Zawsze sprawdzaj czy to prośba o materiały (niezależnie od autoReplyEnabled)
        // autoReplyEnabled wpływa tylko na automatyczną wysyłkę, nie na kolejkę decyzji administratora
        const campaign = reply.campaign;
        if (campaignId) {
          // Sprawdź czy to prośba o materiały
          const materialAnalysis = await this.checkMaterialRequest(reply, campaign);
          
          // Jeśli to prośba o materiały - zawsze dodaj do kolejki administratora
          // (niezależnie od autoReplyEnabled - to jest kolejka decyzji, nie automatyczna wysyłka)
          if (materialAnalysis.isMaterialRequest && materialAnalysis.confidence >= 0.6) {
            // Dodaj do kolejki administratora - zawsze wymagaj akceptacji
            return {
              classification,
              actions: [
                {
                  type: 'ASK_ADMIN_MATERIALS',
                  priority: 'HIGH',
                  description: `Wymaga decyzji administratora - prośba o materiały (pewność AI: ${(materialAnalysis.confidence * 100).toFixed(0)}%)`
                },
                {
                  type: 'FORWARD',
                  priority: 'HIGH',
                  description: 'Przekaż do handlowca - lead zainteresowany'
                }
              ],
              leadStatus: 'ZAINTERESOWANY',
              leadSubStatus: 'ZAINTERESOWANY_CAMPAIGN',
              shouldBlockCampaigns: [campaignId],
              shouldCreateDerivativeLeads: false,
              materialAnalysis
            };
          }
          // Jeśli nie rozpoznano jako prośba o materiały - normalne forward
        }
        
        // Normalny flow - forward do handlowca
        return {
          classification,
          actions: [
            {
              type: 'FORWARD',
              priority: 'HIGH',
              description: 'Przekaż do handlowca - lead zainteresowany'
            },
            {
              type: 'NOTIFY',
              priority: 'HIGH',
              description: 'Wyślij powiadomienia o zainteresowanym leadzie'
            }
          ],
          leadStatus: 'ZAINTERESOWANY',
          leadSubStatus: campaignId ? 'ZAINTERESOWANY_CAMPAIGN' : 'ZAINTERESOWANY_NEW',
          shouldBlockCampaigns: campaignId ? [campaignId] : [],
          shouldCreateDerivativeLeads: false
        };

      case 'NOT_INTERESTED':
        return {
          classification,
          actions: [{
            type: 'BLOCK',
            priority: 'HIGH',
            description: 'Zablokuj lead - jasna odmowa'
          }],
          leadStatus: 'BLOKADA',
          leadSubStatus: 'BLOKADA_REFUSAL',
          shouldBlockCampaigns: [],
          shouldCreateDerivativeLeads: false
        };

      case 'MAYBE_LATER':
        return {
          classification,
          actions: [{
            type: 'NO_ACTION',
            priority: 'LOW',
            description: 'Zostaw lead - może w przyszłości'
          }],
          leadStatus: 'CZEKAJ',
          leadSubStatus: 'CZEKAJ_MAYBE',
          shouldBlockCampaigns: campaignId ? [campaignId] : [],
          shouldCreateDerivativeLeads: false
        };

      case 'REDIRECT':
        if (extractedEmails.length > 0) {
          // REDIRECT z emailem - utwórz nowe leady, zablokuj oryginalny
          return {
            classification,
            actions: [
              {
                type: 'ADD_LEAD',
                priority: 'HIGH',
                description: 'Utwórz nowe leady z podanych emaili'
              },
              {
                type: 'BLOCK',
                priority: 'MEDIUM',
                description: 'Zablokuj oryginalny lead - przekazał kontakt'
              }
            ],
            leadStatus: 'BLOKADA',
            leadSubStatus: 'BLOKADA_REDIRECT_COMPLETED',
            shouldBlockCampaigns: [],
            shouldCreateDerivativeLeads: true,
            derivativeLeadData: {
              emails: extractedEmails,
              source: 'REDIRECT_RESPONSE',
              sourceDetails: JSON.stringify({ originalLeadId: reply.lead?.id })
            }
          };
        } else {
          // REDIRECT bez emaila - wyślij AUTO_FOLLOWUP
          return {
            classification,
            actions: [{
              type: 'AUTO_FOLLOWUP',
              priority: 'MEDIUM',
              description: 'Wyślij AUTO_FOLLOWUP z prośbą o kontakt'
            }],
            leadStatus: 'CZEKAJ',
            leadSubStatus: 'CZEKAJ_REDIRECT_AWAITING_CONTACT',
            shouldBlockCampaigns: campaignId ? [campaignId] : [],
            shouldCreateDerivativeLeads: false
          };
        }

      case 'OOO':
        if (extractedEmails.length > 0) {
          // OOO z kontaktami zastępczymi
          return {
            classification,
            actions: [{
              type: 'ADD_LEAD',
              priority: 'HIGH',
              description: 'Utwórz nowe leady z kontaktów zastępczych'
            }],
            leadStatus: 'CZEKAJ',
            leadSubStatus: 'CZEKAJ_OOO_WITH_CONTACTS',
            shouldBlockCampaigns: campaignId ? [campaignId] : [],
            shouldCreateDerivativeLeads: true,
            derivativeLeadData: {
              emails: extractedEmails,
              source: 'OOO_RESPONSE',
              sourceDetails: JSON.stringify({ originalLeadId: reply.lead?.id })
            }
          };
        } else {
          // OOO bez kontaktów
          return {
            classification,
            actions: [{
              type: 'NO_ACTION',
              priority: 'LOW',
              description: 'Zostaw lead - OOO bez kontaktów'
            }],
            leadStatus: 'CZEKAJ',
            leadSubStatus: 'CZEKAJ_OOO',
            shouldBlockCampaigns: campaignId ? [campaignId] : [],
            shouldCreateDerivativeLeads: false
          };
        }

      case 'UNSUBSCRIBE':
        return {
          classification,
          actions: [{
            type: 'UNSUBSCRIBE',
            priority: 'HIGH',
            description: 'Wypisz lead - prośba o usunięcie'
          }],
          leadStatus: 'BLOKADA',
          leadSubStatus: 'BLOKADA_UNSUBSCRIBE',
          shouldBlockCampaigns: [],
          shouldCreateDerivativeLeads: false
        };

      case 'BOUNCE':
        return {
          classification,
          actions: [{
            type: 'BLOCK',
            priority: 'HIGH',
            description: 'Zablokuj lead - email odbity'
          }],
          leadStatus: 'BLOKADA',
          leadSubStatus: 'BLOKADA_BOUNCE',
          shouldBlockCampaigns: [],
          shouldCreateDerivativeLeads: false
        };

      default:
        return {
          classification,
          actions: [{
            type: 'NO_ACTION',
            priority: 'LOW',
            description: 'Nieznana klasyfikacja - brak akcji'
          }],
          leadStatus: 'AKTYWNY',
          shouldBlockCampaigns: [],
          shouldCreateDerivativeLeads: false
        };
    }
  }

  /**
   * Wykonuje akcje na podstawie analizy
   */
  static async executeActions(analysis: EmailAnalysis, replyId: number): Promise<void> {
    console.log(`[EMAIL AGENT AI] Wykonuję ${analysis.actions.length} akcji`);

    for (const action of analysis.actions) {
      try {
        await this.executeAction(action, analysis, replyId);
      } catch (error) {
        console.error(`[EMAIL AGENT AI] Błąd wykonania akcji ${action.type}:`, error);
      }
    }
  }

  /**
   * Wykonuje pojedynczą akcję
   */
  private static async executeAction(
    action: EmailAction, 
    analysis: EmailAnalysis, 
    replyId: number
  ): Promise<void> {
    const reply = await db.inboxReply.findUnique({
      where: { id: replyId },
      include: { 
        lead: true, 
        campaign: { 
          include: { 
            virtualSalesperson: true 
          } 
        } 
      }
    });

    if (!reply || !reply.lead) return;

    switch (action.type) {
      case 'FORWARD':
        // TODO: Implementuj przekazywanie do handlowca
        console.log(`[EMAIL AGENT AI] FORWARD: Przekazuję lead ${reply.lead.id} do handlowca`);
        // ✅ INTERESTED zawsze aktualizuje status leada (z reaktywacją jeśli był zablokowany)
        await this.updateLeadStatus(reply.lead.id, analysis.leadStatus, analysis.leadSubStatus, reply.campaignId, analysis.shouldBlockCampaigns);
        break;

      case 'BLOCK':
        await this.updateLeadStatus(reply.lead.id, analysis.leadStatus, analysis.leadSubStatus, reply.campaignId, analysis.shouldBlockCampaigns);
        break;

      case 'UNSUBSCRIBE':
        await this.updateLeadStatus(reply.lead.id, analysis.leadStatus, analysis.leadSubStatus, reply.campaignId, analysis.shouldBlockCampaigns);
        break;

      case 'ADD_LEAD':
        if (analysis.shouldCreateDerivativeLeads && analysis.derivativeLeadData) {
          await this.createDerivativeLeads(analysis.derivativeLeadData, reply.lead);
        }
        break;

      case 'AUTO_FOLLOWUP':
        // AUTO_FOLLOWUP jest obsługiwany przez cron job
        await this.updateLeadStatus(reply.lead.id, analysis.leadStatus, analysis.leadSubStatus, reply.campaignId, analysis.shouldBlockCampaigns);
        console.log(`[EMAIL AGENT AI] AUTO_FOLLOWUP: Lead ${reply.lead.id} będzie obsłużony przez cron job`);
        break;

      case 'NOTIFY':
        // Wyślij powiadomienie o zainteresowanym leadzie
        await this.sendInterestedNotification(reply);
        break;

      case 'SEND_MATERIALS':
        // Automatyczna odpowiedź z materiałami
        if (analysis.materialAnalysis) {
          const { scheduleMaterialResponse } = await import('./materialResponseSender');
          await scheduleMaterialResponse(replyId, analysis.materialAnalysis);
          console.log(`[EMAIL AGENT AI] SEND_MATERIALS: Zaplanowano wysyłkę materiałów dla lead ${reply.lead.id}`);
        }
        break;

      case 'ASK_ADMIN_MATERIALS':
        // Kolejka decyzji administratora
        if (analysis.materialAnalysis) {
          const { createPendingMaterialDecision } = await import('./materialResponseSender');
          await createPendingMaterialDecision(replyId, analysis.materialAnalysis);
          console.log(`[EMAIL AGENT AI] ASK_ADMIN_MATERIALS: Utworzono kolejkę decyzji dla lead ${reply.lead.id}`);
        }
        break;

      case 'NO_ACTION':
        console.log(`[EMAIL AGENT AI] NO_ACTION: Brak akcji dla lead ${reply.lead.id}`);
        break;
    }
  }

  /**
   * Aktualizuje status leada (z logiką reaktywacji)
   */
  private static async updateLeadStatus(
    leadId: number, 
    status: LeadStatus, 
    subStatus?: LeadSubStatus,
    campaignId?: number | null,
    shouldBlockCampaigns?: number[] // ✅ NOWY: Kampanie do zablokowania
  ): Promise<void> {
    // Sprawdź obecny status leada
    const lead = await db.lead.findUnique({
      where: { id: leadId },
      select: { status: true, isBlocked: true, blockedReason: true, blockedCampaigns: true, inCRM: true }
    });

    const wasBlocked = lead?.isBlocked || lead?.status === 'BLOCKED' || lead?.status === 'BLOKADA';
    const isInterested = status === 'ZAINTERESOWANY';

    // Jeśli lead był zablokowany i teraz jest INTERESTED - to REAKTYWACJA
    const isReactivation = wasBlocked && isInterested;

    // ✅ POŁĄCZ blockedCampaigns (nowe + istniejące, bez duplikatów)
    let blockedCampaignsArray: number[] = [];
    if (lead?.blockedCampaigns) {
      try {
        blockedCampaignsArray = JSON.parse(lead.blockedCampaigns);
      } catch (e) {
        console.warn(`[EMAIL AGENT AI] Błąd parsowania blockedCampaigns dla lead ${leadId}:`, e);
        blockedCampaignsArray = [];
      }
    }
    
    if (shouldBlockCampaigns && shouldBlockCampaigns.length > 0) {
      blockedCampaignsArray = [...new Set([...blockedCampaignsArray, ...shouldBlockCampaigns])];
    }

    await db.lead.update({
      where: { id: leadId },
      data: {
        status,
        subStatus,
        blockedCampaigns: blockedCampaignsArray.length > 0 
          ? JSON.stringify(blockedCampaignsArray) 
          : null, // ✅ ZAPISZ blockedCampaigns
        isBlocked: false, // Odblokuj jeśli był zablokowany
        blockedReason: isReactivation ? null : undefined, // Wyczyść powód blokady przy reaktywacji
        blockedAt: isReactivation ? null : undefined, // Wyczyść datę blokady przy reaktywacji
        reactivatedAt: isReactivation ? new Date() : undefined, // Zapisz datę reaktywacji
        lastReactivation: isReactivation ? (lead?.status || 'BLOCKED') : undefined, // Z jakiego statusu był reaktywowany
        // ✅ CRM: Automatyczne dodawanie do CRM gdy status jest ZAINTERESOWANY
        inCRM: isInterested ? true : undefined, // Dodaj do CRM jeśli zainteresowany
        crmEnteredAt: isInterested && !lead?.inCRM ? new Date() : undefined, // Ustaw datę tylko jeśli nie był już w CRM
        updatedAt: new Date()
      }
    });

    // ✅ REAKTYWACJA: Jeśli lead był zablokowany i teraz jest INTERESTED, dodaj go z powrotem do kampanii
    if (isReactivation && campaignId) {
      // Sprawdź czy lead już nie jest w kampanii
      const existingCampaignLead = await db.campaignLead.findFirst({
        where: {
          leadId: leadId,
          campaignId: campaignId
        }
      });

      if (!existingCampaignLead) {
        // Dodaj leada z powrotem do kampanii
        await db.campaignLead.create({
          data: {
            leadId: leadId,
            campaignId: campaignId,
            status: 'queued' // Dodaj jako gotowy do wysyłki jeśli kampania jest aktywna
          }
        });
        console.log(`[EMAIL AGENT AI] ✅ Dodano reaktywowanego lead ${leadId} z powrotem do kampanii ${campaignId}`);
      }
    }

    // ✅ INTERESTED: Jeśli lead jest ZAINTERESOWANY i kampania jest podana, zaktualizuj CampaignLead.status
    if (isInterested && campaignId) {
      const updatedCampaignLead = await db.campaignLead.updateMany({
        where: {
          leadId: leadId,
          campaignId: campaignId
        },
        data: {
          status: 'INTERESTED'
        }
      });
      
      if (updatedCampaignLead.count > 0) {
        console.log(`[EMAIL AGENT AI] ✅ Zaktualizowano CampaignLead.status → INTERESTED dla lead ${leadId} w kampanii ${campaignId}`);
      }
    }

    if (isReactivation) {
      console.log(`[EMAIL AGENT AI] ✅ REAKTYWACJA lead ${leadId}: ${lead?.status} → ${status}/${subStatus}`);
    } else {
      console.log(`[EMAIL AGENT AI] Zaktualizowano status lead ${leadId}: ${status}/${subStatus}`);
    }
  }

  /**
   * Sprawdza czy odpowiedź INTERESTED zawiera prośbę o materiały
   */
  private static async checkMaterialRequest(
    reply: any,
    campaign: any
  ) {
    console.log(`[EMAIL AGENT AI] Sprawdzam czy to prośba o materiały dla kampanii ${campaign.id}`);
    
    const leadResponse = reply.content || '';
    // Język kampanii = język handlowca lub język leada
    const campaignLanguage = campaign.virtualSalesperson?.language || 
                           reply.lead?.language || 
                           'pl';
    
    return await analyzeMaterialRequest(
      leadResponse,
      campaign.autoReplyContext,
      campaignLanguage
    );
  }

  /**
   * Tworzy pochodne leady (z OOO, REDIRECT)
   */
  private static async createDerivativeLeads(
    data: { emails: string[]; source: string; sourceDetails: string },
    originalLead: any
  ): Promise<void> {
    console.log(`[EMAIL AGENT AI] Tworzę ${data.emails.length} pochodnych leadów`);

    for (const email of data.emails) {
      try {
        await db.lead.create({
          data: {
            email,
            firstName: originalLead.firstName,
            lastName: originalLead.lastName,
            company: originalLead.company,
            companyCity: originalLead.companyCity,
            companyCountry: originalLead.companyCountry,
            industry: originalLead.industry,
            language: originalLead.language,
            status: 'AKTYWNY',
            source: data.source,
            sourceDetails: data.sourceDetails,
            originalLeadId: originalLead.id,
            greetingForm: originalLead.greetingForm
          }
        });

        console.log(`[EMAIL AGENT AI] Utworzono pochodny lead: ${email}`);
      } catch (error) {
        console.error(`[EMAIL AGENT AI] Błąd tworzenia pochodnego leada ${email}:`, error);
      }
    }
  }

  /**
   * Wysyła powiadomienia o zainteresowanym leadzie
   */
  private static async sendInterestedNotification(reply: any): Promise<void> {
    try {
      const { sendInterestedLeadNotification } = await import('./interestedLeadNotifier');
      
      await sendInterestedLeadNotification({
        replyId: reply.id,
        leadId: reply.leadId || reply.lead?.id,
        campaignId: reply.campaignId || reply.campaign?.id,
        salespersonEmail: reply.campaign?.virtualSalesperson?.realSalespersonEmail
      });
      
      console.log(`[EMAIL AGENT AI] Wysłano powiadomienia dla lead ${reply.lead?.id}`);
    } catch (error) {
      console.error(`[EMAIL AGENT AI] Błąd wysyłki powiadomień:`, error);
    }
  }

  /**
   * Wyciąga emaile z treści
   */
  private static extractEmailsFromContent(content: string): string[] {
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    const matches = content.match(emailRegex) || [];
    
    // Usuń duplikaty i zwróć unikalne emaile
    return [...new Set(matches)];
  }
}
