interface MorfeuszResponse {
  vocative: string;
  gender: string;
  greeting: string;
  confidence: number;
}

interface MorfeuszRequest {
  firstName: string;
  language: string;
}

class MorfeuszService {
  private baseUrl = "http://localhost:8001";

  async getGreetingForm(firstName: string, language: string = "pl"): Promise<string> {
    try {
      if (!firstName || firstName.trim() === "") {
        return "Dzień dobry";
      }

      console.log(`[Morfeusz] Sprawdzanie odmiany dla: ${firstName} (${language})`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

      const response = await fetch(`${this.baseUrl}/vocative`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          firstName: firstName.trim(),
          language: language
        } as MorfeuszRequest),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.warn(`[Morfeusz] API error: ${response.status} - ${response.statusText}`);
        return "Dzień dobry";
      }

      const data: MorfeuszResponse = await response.json();
      console.log(`[Morfeusz] Odpowiedź: ${data.greeting}`);
      
      // Zwróć wygenerowane powitanie
      return data.greeting || "Dzień dobry";

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.error("[Morfeusz] Timeout - serwis nie odpowiada");
      } else {
        console.error("[Morfeusz] Błąd komunikacji:", error);
      }
      return "Dzień dobry";
    }
  }

  async batchGetGreetingForms(leads: Array<{firstName: string, language?: string}>): Promise<string[]> {
    try {
      // Dla dużych batchów, możemy robić równolegle (max 10 na raz)
      const batchSize = 10;
      const results: string[] = [];
      
      for (let i = 0; i < leads.length; i += batchSize) {
        const batch = leads.slice(i, i + batchSize);
        
        const batchPromises = batch.map(lead => 
          this.getGreetingForm(lead.firstName, lead.language || "pl")
        );
        
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
        
        // Małe opóźnienie między batchami żeby nie przeciążyć API
        if (i + batchSize < leads.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      return results;
    } catch (error) {
      console.error("Błąd batch processing:", error);
      // Fallback - zwróć "Dzień dobry" dla wszystkich
      return leads.map(() => "Dzień dobry");
    }
  }

  async isServiceHealthy(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: "GET",
        timeout: 5000
      } as any);
      return response.ok;
    } catch (error) {
      return false;
    }
  }
}

export const morfeuszService = new MorfeuszService();
export type { MorfeuszResponse, MorfeuszRequest };
