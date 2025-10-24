// AI Chat Interface - Chat do dodawania zasad klasyfikacji
import { db } from "@/lib/db";
import { AIRulesManager, type CreateAIRuleInput } from "./aiRulesManager";

export interface ChatMessage {
  id: string;
  userMessage: string;
  aiResponse: string;
  rulesCreated: string[];
  createdAt: Date;
  userId?: string;
}

export interface ChatResponse {
  message: string;
  rulesCreated: string[];
  suggestions: string[];
}

/**
 * AI Chat Interface - obsługuje chat do dodawania zasad
 */
export class AIChatInterface {

  /**
   * Przetwarza wiadomość użytkownika i generuje odpowiedź
   */
  static async processChatMessage(
    message: string, 
    userId?: string
  ): Promise<ChatResponse> {
    console.log(`[AI CHAT] Przetwarzam wiadomość: ${message.substring(0, 50)}...`);

    const messageId = `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const rulesCreated: string[] = [];
    let aiResponse = '';

    try {
      // 1. Analizuj wiadomość użytkownika
      const analysis = this.analyzeUserMessage(message);
      
      if (analysis.intent === 'add_rule') {
        // 2. Utwórz zasadę na podstawie wiadomości
        const ruleInput = this.createRuleFromMessage(message, analysis);
        
        if (ruleInput) {
          // 3. Waliduj zasadę
          const validation = AIRulesManager.validateRule(ruleInput);
          
          if (validation.isValid) {
            // 4. Zapisz zasadę
            const rule = await AIRulesManager.addRule({
              ...ruleInput,
              createdBy: userId
            });
            
            rulesCreated.push(rule.id);
            aiResponse = `✅ Utworzyłem zasadę: "${rule.description}"\n\n` +
                        `📊 Klasyfikacja: ${rule.classification}\n` +
                        `🔑 Keywords: ${rule.keywords.join(', ')}\n` +
                        `🎯 Confidence: ${rule.confidence}\n` +
                        `⭐ Priority: ${rule.priority}`;
          } else {
            aiResponse = `❌ Błąd walidacji zasady:\n${validation.errors.join('\n')}`;
          }
        } else {
          aiResponse = `❌ Nie mogę utworzyć zasady z tej wiadomości. Spróbuj:\n` +
                      `"Dodaj zasadę: jeśli lead pisze 'nie teraz' to klasyfikuj jako MAYBE_LATER"`;
        }
      } else if (analysis.intent === 'list_rules') {
        // 5. Pokaż istniejące zasady
        const rules = await AIRulesManager.getActiveRules();
        const classification = analysis.classification;
        
        const filteredRules = classification 
          ? rules.filter(r => r.classification === classification)
          : rules;

        if (filteredRules.length === 0) {
          aiResponse = `📋 Brak zasad${classification ? ` dla klasyfikacji ${classification}` : ''}`;
        } else {
          aiResponse = `📋 Zasady${classification ? ` dla ${classification}` : ''}:\n\n` +
                      filteredRules.map(rule => 
                        `• ${rule.description || 'Brak opisu'}\n` +
                        `  Klasyfikacja: ${rule.classification}\n` +
                        `  Keywords: ${rule.keywords.join(', ')}\n` +
                        `  Confidence: ${rule.confidence}\n`
                      ).join('\n');
        }
      } else if (analysis.intent === 'test_rule') {
        // 6. Testuj zasadę
        aiResponse = await this.testRuleOnMessage(message, analysis);
      } else {
        // 7. Ogólna odpowiedź
        aiResponse = this.generateGeneralResponse(message);
      }

      // 8. Zapisz historię chat
      await this.saveChatHistory(messageId, message, aiResponse, rulesCreated, userId);

      return {
        message: aiResponse,
        rulesCreated,
        suggestions: this.generateSuggestions(analysis.intent)
      };

    } catch (error) {
      console.error('[AI CHAT] Błąd przetwarzania wiadomości:', error);
      
      aiResponse = `❌ Wystąpił błąd podczas przetwarzania wiadomości. Spróbuj ponownie.`;
      
      await this.saveChatHistory(messageId, message, aiResponse, [], userId);
      
      return {
        message: aiResponse,
        rulesCreated: [],
        suggestions: ['Spróbuj ponownie', 'Sprawdź składnię', 'Skontaktuj się z administratorem']
      };
    }
  }

  /**
   * Analizuje wiadomość użytkownika
   */
  private static analyzeUserMessage(message: string): {
    intent: 'add_rule' | 'list_rules' | 'test_rule' | 'general';
    classification?: string;
    keywords?: string[];
  } {
    const lowerMessage = message.toLowerCase();

    // Sprawdź intencje
    if (lowerMessage.includes('dodaj zasadę') || lowerMessage.includes('utwórz zasadę')) {
      return { intent: 'add_rule' };
    }
    
    if (lowerMessage.includes('pokaż zasady') || lowerMessage.includes('lista zasad')) {
      return { intent: 'list_rules' };
    }
    
    if (lowerMessage.includes('testuj') || lowerMessage.includes('sprawdź')) {
      return { intent: 'test_rule' };
    }

    return { intent: 'general' };
  }

  /**
   * Tworzy zasadę na podstawie wiadomości
   */
  private static createRuleFromMessage(
    message: string, 
    analysis: any
  ): CreateAIRuleInput | null {
    try {
      // Przykład: "Dodaj zasadę: jeśli lead pisze 'nie teraz' to klasyfikuj jako MAYBE_LATER"
      const ruleMatch = message.match(/dodaj zasadę:?\s*(.+)/i);
      if (!ruleMatch) return null;

      const ruleText = ruleMatch[1];
      
      // Wyciągnij klasyfikację
      const classificationMatch = ruleText.match(/jako\s+(\w+)/i);
      if (!classificationMatch) return null;

      const classification = classificationMatch[1].toUpperCase();
      
      // Wyciągnij keywords
      const keywordsMatch = ruleText.match(/['"]([^'"]+)['"]/);
      const keywords = keywordsMatch ? [keywordsMatch[1]] : [];

      // Domyślne wartości
      const confidence = 0.8;
      const priority = 50;

      return {
        classification,
        keywords,
        confidence,
        priority,
        description: ruleText
      };
    } catch (error) {
      console.error('[AI CHAT] Błąd tworzenia zasady:', error);
      return null;
    }
  }

  /**
   * Testuje zasadę na wiadomości
   */
  private static async testRuleOnMessage(
    message: string, 
    analysis: any
  ): Promise<string> {
    // TODO: Implementuj testowanie zasad
    return `🧪 Funkcja testowania zasad będzie dostępna wkrótce`;
  }

  /**
   * Generuje ogólną odpowiedź
   */
  private static generateGeneralResponse(message: string): string {
    const responses = [
      `Cześć! Jestem AI Chat Interface. Mogę pomóc Ci z zarządzaniem zasadami klasyfikacji.`,
      `Witaj! Używam AI do zarządzania zasadami klasyfikacji emaili. Jak mogę pomóc?`,
      `Hej! Jestem tutaj, aby pomóc Ci z zasadami AI. Co chcesz zrobić?`
    ];

    return responses[Math.floor(Math.random() * responses.length)] + 
           `\n\n💡 Przykłady komend:\n` +
           `• "Dodaj zasadę: jeśli lead pisze 'nie teraz' to klasyfikuj jako MAYBE_LATER"\n` +
           `• "Pokaż zasady dla INTERESTED"\n` +
           `• "Testuj zasadę na tekście 'proszę o wycenę'"`;
  }

  /**
   * Generuje sugestie na podstawie intencji
   */
  private static generateSuggestions(intent: string): string[] {
    switch (intent) {
      case 'add_rule':
        return [
          'Dodaj więcej keywords',
          'Zwiększ confidence',
          'Sprawdź klasyfikację'
        ];
      case 'list_rules':
        return [
          'Filtruj po klasyfikacji',
          'Sortuj po priority',
          'Pokaż nieaktywne'
        ];
      case 'test_rule':
        return [
          'Testuj na różnych tekstach',
          'Sprawdź confidence',
          'Porównaj z innymi zasadami'
        ];
      default:
        return [
          'Dodaj nową zasadę',
          'Pokaż istniejące zasady',
          'Testuj zasady'
        ];
    }
  }

  /**
   * Zapisuje historię chat
   */
  private static async saveChatHistory(
    messageId: string,
    userMessage: string,
    aiResponse: string,
    rulesCreated: string[],
    userId?: string
  ): Promise<void> {
    try {
      await db.aIChatHistory.create({
        data: {
          id: messageId,
          userMessage,
          aiResponse,
          rulesCreated: JSON.stringify(rulesCreated),
          userId
        }
      });
    } catch (error) {
      console.error('[AI CHAT] Błąd zapisywania historii:', error);
    }
  }

  /**
   * Pobiera historię chat
   */
  static async getChatHistory(
    limit: number = 50,
    userId?: string
  ): Promise<ChatMessage[]> {
    const history = await db.aIChatHistory.findMany({
      where: userId ? { userId } : {},
      orderBy: { createdAt: 'desc' },
      take: limit
    });

    return history.map(msg => ({
      ...msg,
      rulesCreated: JSON.parse(msg.rulesCreated || '[]'),
      createdAt: msg.createdAt
    }));
  }

  /**
   * Pobiera statystyki chat
   */
  static async getChatStats(): Promise<{
    totalMessages: number;
    rulesCreated: number;
    activeUsers: number;
  }> {
    const [totalMessages, rulesCreated, activeUsers] = await Promise.all([
      db.aIChatHistory.count(),
      db.aIChatHistory.count({
        where: {
          rulesCreated: { not: '[]' }
        }
      }),
      db.aIChatHistory.groupBy({
        by: ['userId'],
        where: {
          userId: { not: null }
        }
      }).then(result => result.length)
    ]);

    return {
      totalMessages,
      rulesCreated,
      activeUsers
    };
  }
}
