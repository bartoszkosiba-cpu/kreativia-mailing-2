// API endpoint dla AI Rules Manager
import { NextRequest, NextResponse } from "next/server";
import { AIRulesManager, type CreateAIRuleInput, type UpdateAIRuleInput } from "@/services/aiRulesManager";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const classification = searchParams.get('classification');
    const stats = searchParams.get('stats') === 'true';

    if (stats) {
      const statsData = await AIRulesManager.getRulesStats();
      return NextResponse.json({
        success: true,
        data: statsData
      });
    }

    if (classification) {
      const rules = await AIRulesManager.getRulesForClassification(classification);
      return NextResponse.json({
        success: true,
        data: rules
      });
    }

    const rules = await AIRulesManager.getActiveRules();
    return NextResponse.json({
      success: true,
      data: rules
    });

  } catch (error) {
    console.error('[AI RULES API] Błąd pobierania zasad:', error);
    return NextResponse.json(
      { 
        error: 'Błąd pobierania zasad',
        details: error instanceof Error ? error.message : 'Nieznany błąd'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const ruleData: CreateAIRuleInput = await request.json();

    // Waliduj dane
    const validation = AIRulesManager.validateRule(ruleData);
    if (!validation.isValid) {
      return NextResponse.json(
        { 
          error: 'Nieprawidłowe dane zasady',
          details: validation.errors
        },
        { status: 400 }
      );
    }

    const rule = await AIRulesManager.addRule(ruleData);

    return NextResponse.json({
      success: true,
      data: rule
    });

  } catch (error) {
    console.error('[AI RULES API] Błąd tworzenia zasady:', error);
    return NextResponse.json(
      { 
        error: 'Błąd tworzenia zasady',
        details: error instanceof Error ? error.message : 'Nieznany błąd'
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { id, ...updateData }: { id: string } & UpdateAIRuleInput = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: 'ID zasady jest wymagane' },
        { status: 400 }
      );
    }

    const rule = await AIRulesManager.updateRule(id, updateData);

    return NextResponse.json({
      success: true,
      data: rule
    });

  } catch (error) {
    console.error('[AI RULES API] Błąd aktualizacji zasady:', error);
    return NextResponse.json(
      { 
        error: 'Błąd aktualizacji zasady',
        details: error instanceof Error ? error.message : 'Nieznany błąd'
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const hard = searchParams.get('hard') === 'true';

    if (!id) {
      return NextResponse.json(
        { error: 'ID zasady jest wymagane' },
        { status: 400 }
      );
    }

    if (hard) {
      await AIRulesManager.hardDeleteRule(id);
    } else {
      await AIRulesManager.deleteRule(id);
    }

    return NextResponse.json({
      success: true,
      message: hard ? 'Zasada usunięta trwale' : 'Zasada dezaktywowana'
    });

  } catch (error) {
    console.error('[AI RULES API] Błąd usuwania zasady:', error);
    return NextResponse.json(
      { 
        error: 'Błąd usuwania zasady',
        details: error instanceof Error ? error.message : 'Nieznany błąd'
      },
      { status: 500 }
    );
  }
}
