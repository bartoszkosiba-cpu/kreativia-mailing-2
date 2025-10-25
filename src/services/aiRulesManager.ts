// AI Rules Manager - Zarządzanie zasadami klasyfikacji AI
import { db } from "@/lib/db";

export interface AIRule {
  id: string;
  classification: string;
  pattern?: string;
  keywords: string[];
  confidence: number;
  priority: number;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
  description?: string;
}

export interface CreateAIRuleInput {
  classification: string;
  pattern?: string;
  keywords: string[];
  confidence: number;
  priority?: number;
  createdBy?: string;
  description?: string;
}

export interface UpdateAIRuleInput {
  classification?: string;
  pattern?: string;
  keywords?: string[];
  confidence?: number;
  priority?: number;
  isActive?: boolean;
  description?: string;
}

/**
 * AI Rules Manager - zarządza zasadami klasyfikacji
 */
export class AIRulesManager {
  
  /**
   * Pobiera wszystkie aktywne zasady
   */
  static async getActiveRules(): Promise<AIRule[]> {
    const rules = await db.aIRules.findMany({
      where: { isActive: true },
      orderBy: [
        { priority: 'desc' },
        { confidence: 'desc' },
        { createdAt: 'desc' }
      ]
    });

    return rules.map(rule => ({
      ...rule,
      keywords: JSON.parse(rule.keywords),
      pattern: rule.pattern || undefined,
      createdBy: rule.createdBy || undefined,
      description: rule.description || undefined,
      createdAt: rule.createdAt,
      updatedAt: rule.updatedAt
    }));
  }

  /**
   * Pobiera zasady dla konkretnej klasyfikacji
   */
  static async getRulesForClassification(classification: string): Promise<AIRule[]> {
    const rules = await db.aIRules.findMany({
      where: { 
        classification,
        isActive: true 
      },
      orderBy: [
        { priority: 'desc' },
        { confidence: 'desc' }
      ]
    });

    return rules.map(rule => ({
      ...rule,
      keywords: JSON.parse(rule.keywords),
      pattern: rule.pattern || undefined,
      createdBy: rule.createdBy || undefined,
      description: rule.description || undefined,
      createdAt: rule.createdAt,
      updatedAt: rule.updatedAt
    }));
  }

  /**
   * Dodaje nową zasadę
   */
  static async addRule(input: CreateAIRuleInput): Promise<AIRule> {
    const rule = await db.aIRules.create({
      data: {
        classification: input.classification,
        pattern: input.pattern,
        keywords: JSON.stringify(input.keywords),
        confidence: input.confidence,
        priority: input.priority || 0,
        createdBy: input.createdBy,
        description: input.description
      }
    });

    return {
      ...rule,
      keywords: JSON.parse(rule.keywords),
      pattern: rule.pattern || undefined,
      createdBy: rule.createdBy || undefined,
      description: rule.description || undefined,
      createdAt: rule.createdAt,
      updatedAt: rule.updatedAt
    };
  }

  /**
   * Aktualizuje istniejącą zasadę
   */
  static async updateRule(id: string, input: UpdateAIRuleInput): Promise<AIRule> {
    const updateData: any = { ...input };
    if (input.keywords) {
      updateData.keywords = JSON.stringify(input.keywords);
    }

    const rule = await db.aIRules.update({
      where: { id },
      data: updateData
    });

    return {
      ...rule,
      keywords: JSON.parse(rule.keywords),
      pattern: rule.pattern || undefined,
      createdBy: rule.createdBy || undefined,
      description: rule.description || undefined,
      createdAt: rule.createdAt,
      updatedAt: rule.updatedAt
    };
  }

  /**
   * Usuwa zasadę (soft delete)
   */
  static async deleteRule(id: string): Promise<void> {
    await db.aIRules.update({
      where: { id },
      data: { isActive: false }
    });
  }

  /**
   * Usuwa zasadę trwale
   */
  static async hardDeleteRule(id: string): Promise<void> {
    await db.aIRules.delete({
      where: { id }
    });
  }

  /**
   * Waliduje zasadę przed zapisaniem
   */
  static validateRule(input: CreateAIRuleInput): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Sprawdź klasyfikację
    const validClassifications = [
      'INTERESTED', 'NOT_INTERESTED', 'MAYBE_LATER', 
      'REDIRECT', 'OOO', 'UNSUBSCRIBE', 'BOUNCE', 'OTHER'
    ];
    
    if (!input.classification || !validClassifications.includes(input.classification)) {
      errors.push(`Nieprawidłowa klasyfikacja. Dozwolone: ${validClassifications.join(', ')}`);
    }

    // Sprawdź keywords
    if (!input.keywords || !Array.isArray(input.keywords) || input.keywords.length === 0) {
      errors.push('Keywords muszą być niepustą tablicą');
    }

    // Sprawdź confidence
    if (input.confidence < 0 || input.confidence > 1) {
      errors.push('Confidence musi być między 0.0 a 1.0');
    }

    // Sprawdź pattern (jeśli podany)
    if (input.pattern) {
      try {
        new RegExp(input.pattern);
      } catch (e) {
        errors.push('Nieprawidłowy regex pattern');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Pobiera statystyki zasad
   */
  static async getRulesStats(): Promise<{
    total: number;
    active: number;
    inactive: number;
    byClassification: Record<string, number>;
  }> {
    const [total, active, inactive] = await Promise.all([
      db.aIRules.count(),
      db.aIRules.count({ where: { isActive: true } }),
      db.aIRules.count({ where: { isActive: false } })
    ]);

    const byClassification = await db.aIRules.groupBy({
      by: ['classification'],
      where: { isActive: true },
      _count: { classification: true }
    });

    const classificationMap: Record<string, number> = {};
    byClassification.forEach(item => {
      classificationMap[item.classification] = item._count.classification;
    });

    return {
      total,
      active,
      inactive,
      byClassification: classificationMap
    };
  }

  /**
   * Testuje zasadę na przykładowym tekście
   */
  static testRule(rule: AIRule, testText: string): {
    matches: boolean;
    confidence: number;
    matchedKeywords: string[];
    matchedPattern?: string;
  } {
    const matchedKeywords: string[] = [];
    let patternMatch = false;
    let matchedPattern: string | undefined;

    // Test keywords
    for (const keyword of rule.keywords) {
      if (testText.toLowerCase().includes(keyword.toLowerCase())) {
        matchedKeywords.push(keyword);
      }
    }

    // Test pattern
    if (rule.pattern) {
      try {
        const regex = new RegExp(rule.pattern, 'i');
        if (regex.test(testText)) {
          patternMatch = true;
          matchedPattern = rule.pattern;
        }
      } catch (e) {
        console.error('Błąd regex pattern:', e);
      }
    }

    const matches = matchedKeywords.length > 0 || patternMatch;
    const confidence = matches ? rule.confidence : 0;

    return {
      matches,
      confidence,
      matchedKeywords,
      matchedPattern
    };
  }
}
