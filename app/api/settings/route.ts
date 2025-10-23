import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET - Pobierz ustawienia (lub utwórz domyślne jeśli nie istnieją)
export async function GET() {
  try {
    let settings = await db.companySettings.findFirst();
    
    // Jeśli nie ma ustawień, utwórz domyślne
    if (!settings) {
      settings = await db.companySettings.create({
        data: {
          companyName: "Kreativia",
          address: "**Showroom & Office & Production:**\nul. Bukowska 16\n62-081 Wysogotowo, PL",
          disclaimerPl: "W razie braku zainteresowania proszę o informację – nie będę się już kontaktować.",
          disclaimerEn: "In case of no interest, please let me know – I will not contact you again.",
          disclaimerDe: "Bei fehlendem Interesse bitte ich um eine Nachricht – ich werde Sie nicht mehr kontaktieren.",
          disclaimerFr: "En cas d'absence d'intérêt, veuillez m'en informer – je ne vous contacterai plus.",
          legalFooter: "The content of this message is confidential and covered by the NDA. The recipient can only be the recipient of the exclusion of third party access. If you are not the addressee of this message, or employee is authorized to transfer it to the addressee, to announce that its dissemination, copying or distribution is prohibited. If you have received this message in error, please notify the sender by sending a reply and delete this message with attachments from your mailbox. Thank you. Kreativia.",
          forwardEmail: "bartosz.kosiba@kreativia.pl"
        }
      });
    }
    
    return NextResponse.json(settings);
  } catch (error) {
    console.error("Błąd pobierania ustawień:", error);
    return NextResponse.json({ error: "Wystąpił błąd podczas pobierania ustawień" }, { status: 500 });
  }
}

// PUT - Aktualizuj ustawienia
export async function PUT(req: NextRequest) {
  try {
    const data = await req.json();
    
    // Pobierz istniejące ustawienia lub utwórz nowe
    let settings = await db.companySettings.findFirst();
    
    if (settings) {
      // Aktualizuj istniejące
      settings = await db.companySettings.update({
        where: { id: settings.id },
        data: {
          companyName: data.companyName || "Kreativia",
          address: data.address || null,
          logoBase64: data.logoBase64 || null,
          disclaimerPl: data.disclaimerPl || null,
          disclaimerEn: data.disclaimerEn || null,
          disclaimerDe: data.disclaimerDe || null,
          disclaimerFr: data.disclaimerFr || null,
          legalFooter: data.legalFooter || null,
          forwardEmail: data.forwardEmail || null,
        }
      });
    } else {
      // Utwórz nowe
      settings = await db.companySettings.create({
        data: {
          companyName: data.companyName || "Kreativia",
          address: data.address || null,
          logoBase64: data.logoBase64 || null,
          disclaimerPl: data.disclaimerPl || null,
          disclaimerEn: data.disclaimerEn || null,
          disclaimerDe: data.disclaimerDe || null,
          disclaimerFr: data.disclaimerFr || null,
          legalFooter: data.legalFooter || null,
          forwardEmail: data.forwardEmail || null,
        }
      });
    }
    
    return NextResponse.json({
      message: "Ustawienia zapisane pomyślnie",
      settings
    });
  } catch (error) {
    console.error("Błąd zapisywania ustawień:", error);
    return NextResponse.json({ error: "Wystąpił błąd podczas zapisywania ustawień" }, { status: 500 });
  }
}

