const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function reviewPersonas() {
  try {
    // Pobierz wszystkie weryfikacje dla personaCriteriaId = 11
    const verifications = await prisma.personaVerificationResult.findMany({
      where: {
        personaCriteriaId: 11,
      },
      include: {
        company: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        verifiedAt: 'desc',
      },
    });

    console.log(`\n=== PRZEGLĄD ZAPISANYCH PERSON ===\n`);
    console.log(`Znaleziono ${verifications.length} firm z weryfikacjami\n`);

    let totalPositive = 0;
    let totalNegative = 0;
    let totalUnknown = 0;
    const allEmployees = [];

    for (const verification of verifications) {
      const employees = JSON.parse(verification.employees);
      
      for (const employee of employees) {
        allEmployees.push({
          companyName: verification.company.name,
          companyId: verification.companyId,
          name: employee.name,
          title: employee.title,
          personaMatchStatus: employee.personaMatchStatus,
          personaMatchScore: employee.personaMatchScore,
          personaMatchReason: employee.personaMatchReason,
          email: employee.email,
          emailStatus: employee.emailStatus || employee.email_status,
          departments: employee.departments || [],
          seniority: employee.seniority,
        });
      }

      totalPositive += verification.positiveCount;
      totalNegative += verification.negativeCount;
      totalUnknown += verification.unknownCount;
    }

    console.log(`\n=== STATYSTYKI OGÓLNE ===`);
    console.log(`Pozytywne: ${totalPositive}`);
    console.log(`Negatywne: ${totalNegative}`);
    console.log(`Nieznane: ${totalUnknown}`);
    console.log(`Razem person: ${allEmployees.length}\n`);

    // Grupuj po statusie
    const positive = allEmployees.filter(e => e.personaMatchStatus === 'positive');
    const negative = allEmployees.filter(e => e.personaMatchStatus === 'negative');
    const unknown = allEmployees.filter(e => !e.personaMatchStatus || e.personaMatchStatus === 'unknown');

    console.log(`\n=== OCENA POZYTYWNYCH PERSON (${positive.length}) ===\n`);
    for (const emp of positive) {
      console.log(`✓ ${emp.name} - ${emp.title}`);
      console.log(`  Firma: ${emp.companyName}`);
      console.log(`  Score: ${(emp.personaMatchScore * 100).toFixed(0)}%`);
      console.log(`  Powód: ${emp.personaMatchReason || 'Brak'}`);
      console.log(`  Email: ${emp.email || 'Brak'} (${emp.emailStatus || 'N/A'})`);
      console.log(`  Działy: ${emp.departments.join(', ') || 'Brak'}`);
      console.log(`  Seniority: ${emp.seniority || 'N/A'}`);
      console.log('');
    }

    console.log(`\n=== OCENA NEGATYWNYCH PERSON (${negative.length}) ===\n`);
    for (const emp of negative) {
      console.log(`✗ ${emp.name} - ${emp.title}`);
      console.log(`  Firma: ${emp.companyName}`);
      console.log(`  Score: ${(emp.personaMatchScore * 100).toFixed(0)}%`);
      console.log(`  Powód: ${emp.personaMatchReason || 'Brak'}`);
      console.log(`  Email: ${emp.email || 'Brak'} (${emp.emailStatus || 'N/A'})`);
      console.log(`  Działy: ${emp.departments.join(', ') || 'Brak'}`);
      console.log(`  Seniority: ${emp.seniority || 'N/A'}`);
      console.log('');
    }

    if (unknown.length > 0) {
      console.log(`\n=== OCENA NIEZNANYCH PERSON (${unknown.length}) ===\n`);
      for (const emp of unknown) {
        console.log(`? ${emp.name} - ${emp.title}`);
        console.log(`  Firma: ${emp.companyName}`);
        console.log(`  Status: ${emp.personaMatchStatus || 'Brak'}`);
        console.log(`  Email: ${emp.email || 'Brak'} (${emp.emailStatus || 'N/A'})`);
        console.log('');
      }
    }

  } catch (error) {
    console.error('Błąd:', error);
  } finally {
    await prisma.$disconnect();
  }
}

reviewPersonas();

