/**
 * Migracja: CampaignVersion → SavedContent
 * Przenosi istniejące wersje do nowego prostego modelu
 */

import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

async function migrate() {
  console.log('🔄 Migracja CampaignVersion → SavedContent...\n');

  try {
    // Pobierz wszystkie wersje
    const versions = await db.campaignVersion.findMany({
      include: {
        campaignTheme: {
          include: {
            productGroup: true
          }
        }
      }
    });

    console.log(`📊 Znaleziono ${versions.length} wersji do migracji\n`);

    for (const version of versions) {
      const theme = version.campaignTheme;
      const group = theme.productGroup;

      // Stwórz nazwę dla SavedContent
      const name = `${theme.name} (v${version.versionNumber}${version.variantLetter ? ` ${version.variantLetter}` : ''})`;

      const savedContent = await db.savedContent.create({
        data: {
          productGroupId: group.id,
          name,
          subject: version.subject,
          content: version.content,
          type: version.type,
          language: theme.language || 'pl',
          notes: version.aiRationale || null,
          sourceType: version.aiModel === 'manual' ? 'manual' : 'ai',
          isActive: version.status !== 'rejected',
          isFavorite: version.status === 'approved'
        }
      });

      console.log(`  ✅ ${name} → SavedContent ID: ${savedContent.id}`);

      // Zaktualizuj Campaign które używały tej wersji
      const updatedCampaigns = await db.campaign.updateMany({
        where: { contentVersionId: version.id },
        data: { savedContentId: savedContent.id }
      });

      if (updatedCampaigns.count > 0) {
        console.log(`     📧 Zaktualizowano ${updatedCampaigns.count} kampanii`);
      }
    }

    console.log('\n✅ Migracja zakończona pomyślnie!');
    console.log(`📝 Zmigrowano ${versions.length} wersji do SavedContent\n`);

  } catch (error) {
    console.error('❌ Błąd migracji:', error);
    throw error;
  } finally {
    await db.$disconnect();
  }
}

migrate()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));

