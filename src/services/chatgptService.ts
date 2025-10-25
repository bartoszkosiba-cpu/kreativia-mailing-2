import OpenAI from 'openai';
import { trackTokenUsage } from './tokenTracker';

function getSystemPrompt(language: string): string {
  switch (language.toLowerCase()) {
    case 'de':
      return "Jesteś ekspertem od niemieckich imion i nazwisk. Rozpoznajesz płeć imion i tworzysz powitania: 'Guten Tag Herr [Nazwisko]' dla mężczyzn, 'Guten Tag Frau [Nazwisko]' dla kobiet. Zwracasz tylko JSON bez dodatkowych komentarzy.";
    case 'en':
      return "You are an expert in English names. Create simple greetings in format 'Hello [First Name]' for all names. Return only JSON without additional comments.";
    case 'fr':
      return "Vous êtes un expert des noms français. Reconnaissez le genre des prénoms et créez des salutations: 'Bonjour Monsieur [Nom]' pour les hommes, 'Bonjour Madame [Nom]' pour les femmes. Retournez uniquement JSON sans commentaires supplémentaires.";
    case 'pl':
    default:
      return "Jesteś ekspertem od polskich imion i ich odmiany w WOŁACZU (vocative case). Tworzysz powitania w formacie 'Dzień dobry Panie/Pani [imię w odmianie]'. Przykłady: Jan → Panie Janie, Anna → Pani Anno, Paweł → Panie Pawle. Zwracasz tylko JSON bez dodatkowych komentarzy.";
  }
}

function getDefaultGreeting(language: string): string {
  switch (language.toLowerCase()) {
    case 'de':
      return 'Guten Tag';
    case 'en':
      return 'Hello';
    case 'fr':
      return 'Bonjour';
    case 'pl':
    default:
      return 'Dzień dobry';
  }
}

function getExamplesByLanguage(language: string): { originalName: string; correctedName: string; greetingForm: string } {
  switch (language.toLowerCase()) {
    case 'de':
      return {
        originalName: "Hans",
        correctedName: "Hans",
        greetingForm: "Guten Tag Herr Müller"
      };
    case 'en':
      return {
        originalName: "John",
        correctedName: "John",
        greetingForm: "Hello John"
      };
    case 'fr':
      return {
        originalName: "Marie",
        correctedName: "Marie",
        greetingForm: "Bonjour Madame Dubois"
      };
    case 'pl':
    default:
      return {
        originalName: "Jan",
        correctedName: "Jan",
        greetingForm: "Dzień dobry Panie Janie"
      };
  }
}

const openai = process.env.OPENAI_API_KEY ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
}) : null;

export interface NameDeclensionResult {
  originalName: string;
  correctedName: string;
  greetingForm: string;
  confidence: number;
}

export class ChatGPTService {
  async batchProcessNames(firstNames: string[], lastNames: string[], languages: string[] = []): Promise<NameDeclensionResult[]> {
    console.log('[ChatGPT] Sprawdzanie API key...', {
      openai: !!openai,
      apiKey: process.env.OPENAI_API_KEY ? `SET (length: ${process.env.OPENAI_API_KEY.length})` : 'NOT SET'
    });
    
    if (!openai || !process.env.OPENAI_API_KEY) {
      console.error('[ChatGPT] ❌ Brak API key - NIE MOGĘ ODMIENIĆ IMION!');
      throw new Error('Brak OPENAI_API_KEY - odmiany imion niemożliwe');
    }

    // Jeśli jest więcej niż 50 imion, podziel na batche po 50 (większe batche = szybciej)
    const BATCH_SIZE = 50;
    if (firstNames.length > BATCH_SIZE) {
      console.log(`[ChatGPT] Dużo imion (${firstNames.length}) - dzielę na batche po ${BATCH_SIZE}...`);
      
      const results: NameDeclensionResult[] = [];
      const totalBatches = Math.ceil(firstNames.length / BATCH_SIZE);
      
      // Przetwarzaj batche sekwencyjnie (zachowaj kolejność!)
      for (let i = 0; i < firstNames.length; i += BATCH_SIZE) {
        const batchFirstNames = firstNames.slice(i, i + BATCH_SIZE);
        const batchLastNames = lastNames.slice(i, i + BATCH_SIZE);
        const batchLanguages = languages.slice(i, i + BATCH_SIZE);
        const batchNum = Math.floor(i / BATCH_SIZE) + 1;
        
        console.log(`[ChatGPT] Batch ${batchNum}/${totalBatches}: ${batchFirstNames.length} imion`);
        const batchResult = await this.processSingleBatch(batchFirstNames, batchLastNames, batchLanguages);
        results.push(...batchResult);
        
        console.log(`[ChatGPT] Postęp: ${results.length}/${firstNames.length} (${Math.round(results.length / firstNames.length * 100)}%)`);
      }
      
      console.log(`[ChatGPT] ✅ Wszystkie batche przetworzone: ${results.length} odmian`);
      return results;
    }

    // Dla małych list - przetwórz od razu
    return this.processSingleBatch(firstNames, lastNames, languages);
  }

  private async processSingleBatch(firstNames: string[], lastNames: string[], languages: string[]): Promise<NameDeclensionResult[]> {
    try {
      // Grupuj według języka
      const namesByLanguage = new Map<string, { firstNames: string[], lastNames: string[], indices: number[] }>();
      
      firstNames.forEach((firstName, index) => {
        const language = languages[index] || 'pl';
        if (!namesByLanguage.has(language)) {
          namesByLanguage.set(language, { firstNames: [], lastNames: [], indices: [] });
        }
        namesByLanguage.get(language)!.firstNames.push(firstName);
        namesByLanguage.get(language)!.lastNames.push(lastNames[index] || '');
        namesByLanguage.get(language)!.indices.push(index);
      });

      const allResults: NameDeclensionResult[] = new Array(firstNames.length);
      
      // Przetwarzaj każdy język osobno
      for (const [language, data] of namesByLanguage) {
        const prompt = this.buildPrompt(data.firstNames, data.lastNames, language);
        
        console.log(`[ChatGPT] Wysyłam ${data.firstNames.length} imion (${language}) do ChatGPT...`);
        console.log(`[ChatGPT] Imiona dla ${language}:`, data.firstNames.map((name, i) => `${name} ${data.lastNames[i] || ''}`).join(', '));
        const startTime = Date.now();
        
        const response = await openai!.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: getSystemPrompt(language)
            },
            {
              role: "user", 
              content: prompt
            }
          ],
          max_tokens: 3000,
          temperature: 0.1
        });

        const endTime = Date.now();
        console.log(`[ChatGPT] Odpowiedź otrzymana w ${endTime - startTime}ms`);

        // Śledź użycie tokenów
        if (response.usage) {
          await trackTokenUsage({
            operation: 'greeting_generation',
            model: 'gpt-4o-mini',
            promptTokens: response.usage.prompt_tokens,
            completionTokens: response.usage.completion_tokens,
            metadata: {
              language,
              namesCount: data.firstNames.length,
              responseTime: endTime - startTime
            }
          });
          console.log(`[ChatGPT] Tokeny: ${response.usage.prompt_tokens} input + ${response.usage.completion_tokens} output = ${response.usage.total_tokens} total`);
        }

        const content = response.choices[0]?.message?.content;
        if (!content) {
          throw new Error('Brak odpowiedzi od ChatGPT');
        }

        const results = this.parseResponse(content, data.firstNames);
        
        // WERYFIKACJA: Sprawdź czy liczba wyników odpowiada liczbie imion
        if (results.length !== data.firstNames.length) {
          console.error(`[ChatGPT] ❌ BŁĄD: Otrzymano ${results.length} wyników, oczekiwano ${data.firstNames.length} dla języka ${language}`);
          console.error(`[ChatGPT] Imiona:`, data.firstNames);
          console.error(`[ChatGPT] Wyniki:`, results.map(r => r.greetingForm));
          
          // Fallback: użyj domyślnego powitania dla brakujących wyników
          while (results.length < data.firstNames.length) {
            results.push({
              originalName: data.firstNames[results.length],
              correctedName: data.firstNames[results.length],
              greetingForm: getDefaultGreeting(language),
              confidence: 0.1
            });
          }
        }
        
        // Przypisz wyniki do właściwych pozycji
        results.forEach((result, index) => {
          const originalIndex = data.indices[index];
          
          // DODATKOWA WERYFIKACJA: Sprawdź czy greetingForm nie jest puste
          if (!result.greetingForm || result.greetingForm.trim() === '') {
            console.warn(`[ChatGPT] ⚠️ Pusty greetingForm dla ${result.originalName}, używam domyślnego`);
            result.greetingForm = getDefaultGreeting(language);
            result.confidence = 0.1;
          }
          
          allResults[originalIndex] = result;
        });
        
        console.log(`[ChatGPT] Wynik (${language}): ${results.length} odmian`);
        console.log(`[ChatGPT] Szczegóły wyników (${language}):`, results.map(r => `${r.originalName} → "${r.greetingForm}"`).join(', '));
      }
      
      // WERYFIKACJA: Sprawdź czy wszystkie wyniki są przypisane
      const undefinedCount = allResults.filter(r => r === undefined).length;
      if (undefinedCount > 0) {
        console.error(`[ChatGPT] ❌ BŁĄD: ${undefinedCount} wyników nie zostało przypisanych!`);
        console.error(`[ChatGPT] allResults:`, allResults.map((r, i) => `${i}: ${r ? r.greetingForm : 'UNDEFINED'}`));
      }
      
      return allResults;
    } catch (error: any) {
      console.error('[ChatGPT] ❌ Błąd przetwarzania batch:', error.message);
      throw error; // Rzuć błąd dalej - NIE używaj fallback!
    }
  }

  private buildPrompt(firstNames: string[], lastNames: string[], language: string): string {
    const fullNames = firstNames.map((firstName, index) => {
      const lastName = lastNames[index] || '';
      return lastName ? `${firstName} ${lastName}` : firstName;
    });
    const namesList = fullNames.join(', ');
    
    const examples = getExamplesByLanguage(language);
    const defaultGreeting = getDefaultGreeting(language);
    
    if (language === 'pl') {
      return `
Przetwórz te imiona i zwróć poprawne odmiany w WOŁACZU (przypadek używany do zwracania się bezpośrednio do osoby):

Imiona i nazwiska: ${namesList}

WAŻNE ZASADY DLA POLSKIEGO WOŁACZA:
1. WOŁACZ to przypadek do zwracania się bezpośrednio do osoby (NIE celownik!)
2. Format: "Dzień dobry Panie/Pani [imię w odmianie]"
3. Imiona męskie: Jan → Panie Janie, Paweł → Panie Pawle, Krystian → Panie Krystianie, Adam → Panie Adamie
4. Imiona żeńskie: Anna → Pani Anno, Maria → Pani Mario, Klaudia → Pani Klaudio, Ewa → Pani Ewo
5. Jeśli imię ma usunięte znaki diakrytyczne, popraw je (Pawel → Paweł)
6. Jeśli imię jest nieznane/nieprawdziwe (np. "Color"), zwróć tylko "Dzień dobry"

PRZYKŁADY POPRAWNYCH WOŁACZY:
- Jan → "Dzień dobry Panie Janie"
- Anna → "Dzień dobry Pani Anno"
- Paweł → "Dzień dobry Panie Pawle"
- Maria → "Dzień dobry Pani Mario"
- Color → "Dzień dobry" (nieznane imię)

Zwróć JSON w formacie:
[
  {
    "originalName": "Klaudia",
    "correctedName": "Klaudia", 
    "greetingForm": "Dzień dobry Pani Klaudio",
    "confidence": 0.95
  }
]

Jeśli confidence < 0.8, używaj tylko "Dzień dobry" bez imienia.
`;
    } else {
      return `
Przetwórz te imiona i nazwiska i zwróć poprawne powitania w języku ${language}:

Imiona i nazwiska: ${namesList}

Zasady dla ${language.toUpperCase()}:
${language === 'en' ? '1. Format: "Hello [First Name]"\n2. Przykłady:\n   - John → "Hello John"\n   - Mark (Holandia) → "Hello Mark"\n   - Sophie (Belgia) → "Hello Sophie"\n   - Martin (Szwajcaria) → "Hello Martin"\n   - Anna (Szwecja) → "Hello Anna"\n   - Lars (Dania) → "Hello Lars"\n   - Erik (Norwegia) → "Hello Erik"\n   - Emma (Finlandia) → "Hello Emma"\n3. Używaj prostego formatu "Hello [Imię]" dla wszystkich imion' : ''}
    ${language === 'de' ? '1. Rozpoznaj płeć imienia i użyj odpowiedniego tytułu:\n   - Mężczyźni: "Guten Tag Herr [Nazwisko]"\n   - Kobiety: "Guten Tag Frau [Nazwisko]"\n2. Przykłady:\n   - Hans Müller → "Guten Tag Herr Müller"\n   - Anna Schmidt → "Guten Tag Frau Schmidt"\n   - Wolf Weber → "Guten Tag Herr Weber"' : ''}
    ${language === 'fr' ? '1. Rozpoznaj płeć imienia i użyj odpowiedniego tytułu:\n   - Mężczyźni: "Bonjour Monsieur [Nom]"\n   - Kobiety: "Bonjour Madame [Nom]"\n2. Przykłady:\n   - Jean Dubois → "Bonjour Monsieur Dubois"\n   - Marie Martin → "Bonjour Madame Martin"\n   - Pierre Bernard → "Bonjour Monsieur Bernard"' : ''}

3. Jeśli imię jest nieznane/nieprawdziwe (np. "Color"), zwróć tylko "${defaultGreeting}"
4. Zwróć JSON w formacie:
[
  {
    "originalName": "${examples.originalName}",
    "correctedName": "${examples.correctedName}", 
    "greetingForm": "${examples.greetingForm}",
    "confidence": 0.95
  }
]

Jeśli confidence < 0.8, używaj tylko "${defaultGreeting}" bez imienia.
`;
    }
  }

  private parseResponse(content: string, originalNames: string[]): NameDeclensionResult[] {
    try {
      // Usuń markdown jeśli istnieje
      const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      
      console.log(`[ChatGPT] Parsowanie odpowiedzi (${cleanContent.length} znaków)...`);
      
      const parsed = JSON.parse(cleanContent);
      
      if (!Array.isArray(parsed)) {
        throw new Error('Odpowiedź nie jest tablicą');
      }

      if (parsed.length !== originalNames.length) {
        console.warn(`[ChatGPT] ⚠️ ChatGPT zwrócił ${parsed.length} wyników, oczekiwano ${originalNames.length}`);
      }

      return parsed;
    } catch (error: any) {
      console.error('[ChatGPT] ❌ Błąd parsowania odpowiedzi:', error.message);
      console.error('[ChatGPT] Otrzymana treść:', content.substring(0, 200));
      throw new Error(`Nie mogę sparsować odpowiedzi ChatGPT: ${error.message}`);
    }
  }

  private fallbackResponse(firstNames: string[], language: string = 'pl'): NameDeclensionResult[] {
    const defaultGreeting = getDefaultGreeting(language);
    return firstNames.map(name => ({
      originalName: name,
      correctedName: name,
      greetingForm: defaultGreeting,
      confidence: 0.1
    }));
  }
}

export const chatgptService = new ChatGPTService();
