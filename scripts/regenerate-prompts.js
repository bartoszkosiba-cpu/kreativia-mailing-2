// Skrypt do regeneracji promptów dla istniejących briefów
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function regeneratePrompts() {
  try {
    // Pobierz wszystkie briefy które nie mają zapisanego promptu
    const briefs = await prisma.personaBrief.findMany({
      where: {
        OR: [
          { generatedPrompt: null },
          { generatedPrompt: '' }
        ],
        summary: {
          not: ''
        }
      },
      include: {
        personaCriteria: true
      }
    });

    console.log(`Znaleziono ${briefs.length} briefów bez promptu`);

    for (const brief of briefs) {
      try {
        const { getFullPromptText } = require('../src/services/personaVerificationAI');
        const { getPersonaCriteriaById } = require('../src/services/personaCriteriaService');
        
        const personaCriteria = await getPersonaCriteriaById(brief.companyCriteriaId);
        if (!personaCriteria) {
          console.log(`⚠️  Pominięto brief ID ${brief.companyCriteriaId} - brak PersonaCriteria`);
          continue;
        }

        const briefContext = {
          summary: brief.summary,
          decisionGuidelines: brief.decisionGuidelines ? JSON.parse(brief.decisionGuidelines) : [],
          targetProfiles: brief.targetProfiles ? JSON.parse(brief.targetProfiles) : [],
          avoidProfiles: brief.avoidProfiles ? JSON.parse(brief.avoidProfiles) : [],
          additionalNotes: brief.additionalNotes,
          aiRole: brief.aiRole,
          positiveThreshold: brief.positiveThreshold || 0.5,
        };

        const promptText = getFullPromptText(personaCriteria, briefContext);

        await prisma.personaBrief.update({
          where: { companyCriteriaId: brief.companyCriteriaId },
          data: {
            generatedPrompt: promptText,
          },
        });

        console.log(`✅ Wygenerowano prompt dla brief ID ${brief.companyCriteriaId} (${brief.personaCriteria?.name || 'bez nazwy'})`);
      } catch (error) {
        console.error(`❌ Błąd generowania promptu dla brief ID ${brief.companyCriteriaId}:`, error.message);
      }
    }

    console.log('\n✅ Zakończono regenerację promptów');
  } catch (error) {
    console.error('❌ Błąd:', error);
  } finally {
    await prisma.$disconnect();
  }
}

regeneratePrompts();

