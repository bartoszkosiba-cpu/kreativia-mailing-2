import { NextResponse } from "next/server";
import { chatgptService } from "@/services/chatgptService";

/**
 * TEST ENDPOINT - Sprawdza czy odmiany imion działają
 * GET /api/test-import
 */
export async function GET() {
  const testNames = ["Paweł", "Klaudia", "Anna", "Tomasz", "Krystian"];
  
  console.log("=".repeat(80));
  console.log("[TEST IMPORT] Rozpoczynam test odmiany imion...");
  console.log(`[TEST IMPORT] Test dla ${testNames.length} imion:`, testNames);
  
  try {
    const startTime = Date.now();
    const results = await chatgptService.batchProcessNames(testNames, [], ['pl']);
    const endTime = Date.now();
    
    console.log(`[TEST IMPORT] ✅ Otrzymano ${results.length} wyników w ${endTime - startTime}ms`);
    console.log("[TEST IMPORT] Wyniki:");
    
    results.forEach((result, index) => {
      console.log(`  ${index + 1}. ${result.originalName} → ${result.greetingForm} (confidence: ${result.confidence})`);
    });
    
    // Sprawdź czy są odmiany czy tylko "Dzień dobry"
    const properGreetings = results.filter(r => r.greetingForm !== "Dzień dobry");
    const fallbackGreetings = results.filter(r => r.greetingForm === "Dzień dobry");
    
    console.log(`[TEST IMPORT] Statystyki:`);
    console.log(`  - Z odmianą: ${properGreetings.length}`);
    console.log(`  - Bez odmiany (fallback): ${fallbackGreetings.length}`);
    
    return NextResponse.json({
      success: true,
      testNames: testNames,
      results: results,
      statistics: {
        total: results.length,
        withDeclension: properGreetings.length,
        fallback: fallbackGreetings.length,
        responseTime: endTime - startTime
      },
      examples: results.map(r => ({
        original: r.originalName,
        greeting: r.greetingForm,
        confidence: r.confidence
      }))
    });
    
  } catch (error: any) {
    console.error("[TEST IMPORT] ❌ Błąd:", error);
    
    return NextResponse.json({
      success: false,
      error: error.message || error.toString(),
      testNames: testNames
    }, { status: 500 });
  }
}

