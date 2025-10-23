/**
 * Seed dla AI Persona Config - default configuration
 */

import { PrismaClient } from '@prisma/client';
import { DEFAULT_SYSTEM_PERSONA } from '../src/services/metaAI';

const db = new PrismaClient();

async function seedAIConfig() {
  console.log('🌱 Seedowanie AI Persona Config...\n');

  try {
    // Sprawdź czy już istnieje
    const existing = await db.aIPersonaConfig.findFirst({
      where: { isActive: true }
    });

    if (existing) {
      console.log('ℹ️  Config już istnieje - pomijam\n');
      return existing;
    }

    // Utwórz default config
    const config = await db.aIPersonaConfig.create({
      data: {
        generatedPrompt: DEFAULT_SYSTEM_PERSONA,
        promptVersion: 1,
        isActive: true,
        createdBy: "system"
      }
    });

    console.log(`✅ Utworzono default AI Persona Config (ID: ${config.id})`);
    console.log(`   Wersja promptu: v${config.promptVersion}`);

    console.log('\n🎉 Seed zakończony pomyślnie!');
    console.log('\n📝 Następne kroki:');
    console.log('   1. Otwórz /content-planner/settings');
    console.log('   2. Zacznij rozmowę z Meta-AI');
    console.log('   3. Skonfiguruj swoje zasady pisania\n');

    return config;

  } catch (error) {
    console.error('❌ Błąd seedowania:', error);
    throw error;
  } finally {
    await db.$disconnect();
  }
}

// Uruchom seed
seedAIConfig()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Błąd krytyczny:', error);
    process.exit(1);
  });

