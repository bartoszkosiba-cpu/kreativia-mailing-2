const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function reviewPersonasDetailed() {
  try {
    // Pobierz kryteria person
    const criteria = await prisma.companyPersonaCriteria.findUnique({
      where: { id: 11 },
    });

    if (!criteria) {
      console.log('Nie znaleziono kryteriów person dla ID 11');
      return;
    }

    const positiveRoles = JSON.parse(criteria.positiveRoles || '[]');
    const negativeRoles = JSON.parse(criteria.negativeRoles || '[]');

    console.log('\n=== KRYTERIA PERSON ===\n');
    console.log('Pozytywne role:');
    positiveRoles.forEach(role => {
      console.log(`  - ${role.label} (minSeniority: ${role.minSeniority || 'brak'})`);
    });
    console.log('\nNegatywne role:');
    negativeRoles.forEach(role => {
      console.log(`  - ${role.label}`);
    });

    // Pobierz wszystkie weryfikacje
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
    }

    const positive = allEmployees.filter(e => e.personaMatchStatus === 'positive');
    const negative = allEmployees.filter(e => e.personaMatchStatus === 'negative');
    const unknown = allEmployees.filter(e => !e.personaMatchStatus || e.personaMatchStatus === 'unknown');

    console.log(`\n\n=== OCENA POZYTYWNYCH PERSON (${positive.length}) ===\n`);
    positive.forEach((emp, idx) => {
      console.log(`${idx + 1}. ✓ ${emp.name} - "${emp.title}"`);
      console.log(`   Firma: ${emp.companyName}`);
      console.log(`   Score: ${(emp.personaMatchScore * 100).toFixed(0)}%`);
      console.log(`   Powód: ${emp.personaMatchReason || 'Brak'}`);
      console.log(`   Email: ${emp.email || 'Brak'} (${emp.emailStatus || 'N/A'})`);
      console.log(`   Działy: ${emp.departments.join(', ') || 'Brak'}`);
      console.log(`   Seniority: ${emp.seniority || 'N/A'}`);
      console.log('');
    });

    console.log(`\n\n=== OCENA NEGATYWNYCH PERSON (${negative.length}) ===\n`);
    negative.forEach((emp, idx) => {
      console.log(`${idx + 1}. ✗ ${emp.name} - "${emp.title}"`);
      console.log(`   Firma: ${emp.companyName}`);
      console.log(`   Score: ${(emp.personaMatchScore * 100).toFixed(0)}%`);
      console.log(`   Powód: ${emp.personaMatchReason || 'Brak'}`);
      console.log(`   Email: ${emp.email || 'Brak'} (${emp.emailStatus || 'N/A'})`);
      console.log(`   Działy: ${emp.departments.join(', ') || 'Brak'}`);
      console.log(`   Seniority: ${emp.seniority || 'N/A'}`);
      console.log('');
    });

    if (unknown.length > 0) {
      console.log(`\n\n=== OCENA NIEZNANYCH PERSON (${unknown.length}) ===\n`);
      unknown.forEach((emp, idx) => {
        console.log(`${idx + 1}. ? ${emp.name} - "${emp.title}"`);
        console.log(`   Firma: ${emp.companyName}`);
        console.log(`   Status: ${emp.personaMatchStatus || 'Brak'}`);
        console.log(`   Email: ${emp.email || 'Brak'} (${emp.emailStatus || 'N/A'})`);
        console.log('');
      });
    }

  } catch (error) {
    console.error('Błąd:', error);
  } finally {
    await prisma.$disconnect();
  }
}

reviewPersonasDetailed();

