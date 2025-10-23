/**
 * Aktualizacja AI Persona Config do nowej wersji (bez hardcoded przykładów)
 */

import { PrismaClient } from '@prisma/client';
import { DEFAULT_SYSTEM_PERSONA } from '../src/services/metaAI';

const db = new PrismaClient();

async function updatePersona() {
  console.log('🔄 Aktualizacja AI Persona Config...\n');

  try {
    const config = await db.aIPersonaConfig.findFirst({
      where: { isActive: true }
    });

    if (!config) {
      console.log('⚠️  Brak aktywnego config - uruchom seed-ai-config.ts');
      return;
    }

    await db.aIPersonaConfig.update({
      where: { id: config.id },
      data: {
        generatedPrompt: DEFAULT_SYSTEM_PERSONA,
        promptVersion: config.promptVersion + 1,
        updatedAt: new Date()
      }
    });

    console.log(`✅ Zaktualizowano AI Persona (v${config.promptVersion} → v${config.promptVersion + 1})`);
    console.log('\n📝 Zmiany:');
    console.log('   • Usunięto hardcoded przykłady ("15 minut")');
    console.log('   • Dodano ostrzeżenie: NIE WYMYŚLAJ DANYCH');
    console.log('   • AI będzie pytać o dane zamiast zakładać\n');

  } catch (error) {
    console.error('❌ Błąd aktualizacji:', error);
    throw error;
  } finally {
    await db.$disconnect();
  }
}

updatePersona()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));

