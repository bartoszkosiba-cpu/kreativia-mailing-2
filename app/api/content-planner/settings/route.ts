import { NextRequest, NextResponse } from "next/server";
import { getCurrentConfig, resetToDefault } from "@/services/metaAI";

// GET - Pobierz obecną konfigurację
export async function GET(req: NextRequest) {
  try {
    const config = await getCurrentConfig();
    
    return NextResponse.json({
      success: true,
      config
    });
  } catch (error: any) {
    console.error("Błąd pobierania config:", error);
    return NextResponse.json(
      { error: "Błąd pobierania konfiguracji", details: error.message },
      { status: 500 }
    );
  }
}

// DELETE - Reset do default
export async function DELETE(req: NextRequest) {
  try {
    await resetToDefault();
    
    return NextResponse.json({
      success: true,
      message: "Konfiguracja zresetowana do domyślnej"
    });
  } catch (error: any) {
    console.error("Błąd resetu config:", error);
    return NextResponse.json(
      { error: "Błąd resetu konfiguracji", details: error.message },
      { status: 500 }
    );
  }
}

