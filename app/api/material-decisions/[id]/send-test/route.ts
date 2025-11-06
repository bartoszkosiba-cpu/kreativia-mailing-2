import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateMaterialResponse } from "@/services/materialResponseAI";
import * as fs from "fs";
import * as path from "path";

/**
 * Zwraca domyślne powitanie w danym języku
 */
function getDefaultGreetingForLanguage(language: string): string {
  switch (language.toLowerCase()) {
    case 'de':
      return 'Guten Tag';
    case 'en':
      return 'Hello';
    case 'fr':
      return 'Bonjour';
    case 'pl':
    default:
      return 'Dzień dobry';
  }
}

/**
 * ✅ Funkcja convertToHtml - rozszerzona o formatowanie cytatów (dokładnie taka sama jak w materialResponseSender.ts)
 */
function convertToHtml(text: string): string {
  let html = text;
  
  // 1. Najpierw obsłuż specjalne tagi systemowe
  // Konwertuj logo [LOGO]base64[/LOGO] na <img>
  html = html.replace(/\[LOGO\](.+?)\[\/LOGO\]/g, '<img src="$1" alt="Company Logo" style="max-width: 112px; margin: 20px 0;" />');
  
  // Konwertuj linki [LINK]text[/LINK:url] na <a href="url">text</a>
  html = html.replace(/\[LINK\](.+?)\[\/LINK:(.+?)\]/g, '<a href="$2" style="color: #0066cc; text-decoration: underline;">$1</a>');
  
  // Formatuj **bold** na <strong>
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  
  // 2. ✅ Formatuj separator ━━━━━━━━ na <hr>
  html = html.replace(/━+/g, '<hr style="border: none; border-top: 1px solid #ddd; margin: 10px 0;" />');
  
  // 3. ✅ Formatuj sekcję "Wiadomość napisana przez..." + cytat
  // Znajdź nagłówek i cały blok cytatów po nim
  html = html.replace(/(Wiadomość napisana przez[^\n\r]+(?:[\r\n]+))((?:>.*[\r\n]*)+)/gi, (match, header, quoteBlock) => {
    // Formatuj nagłówek (kursywa, szary kolor)
    const formattedHeader = `<div style="color: #888; font-size: 12px; margin: 16px 0 8px 0; font-style: italic;">${header.trim()}</div>`;
    
    // Formatuj blok cytatów - wyciągnij wszystkie linie z ">"
    // ✅ Zachowaj puste linie (linie z samym ">") jako odstępy
    const quoteLines = quoteBlock
      .split(/\r?\n/)
      .map((line: string) => line.trim())
      .filter((line: string) => line.startsWith('>'))
      .map((line: string) => {
        const withoutPrefix = line.replace(/^>\s*/, '');
        // Jeśli linia była pusta (tylko ">"), zwróć pusty string (będzie renderowany jako odstęp)
        return withoutPrefix === '' ? '' : withoutPrefix;
      });
    
    if (quoteLines.length === 0) {
      return match; // Jeśli nie ma cytatów, zwróć oryginał
    }
    
    // ✅ Połącz linie, ale puste linie (puste stringi) zamień na <br><br> (odstęp)
    const cleanQuote = quoteLines
      .map((line: string, index: number) => {
        if (line === '') {
          // Pusta linia - dodaj odstęp
          return '<br>';
        } else if (index > 0 && quoteLines[index - 1] === '') {
          // Jeśli poprzednia linia była pusta, to już dodaliśmy <br>, więc dodaj tylko jedną linię
          return line;
        } else {
          return line;
        }
      })
      .join('<br>')
      .replace(/<br><br>/g, '<br><br>'); // Podwójne <br> to odstęp
    
    // Zwróć sformatowany nagłówek i blok cytatów
    return formattedHeader + `<div style="color: #666; padding: 12px 16px; border-left: 3px solid #ccc; margin: 0 0 16px 0; background: #f9f9f9; border-radius: 4px; font-size: 13px; line-height: 1.6;">${cleanQuote}</div>`;
  });
  
  // 4. ✅ Formatuj pozostałe cytaty (linie z "> " które nie są w sformatowanym bloku)
  // Znajdź wszystkie ciągłe bloki cytatów (linie zaczynające się od "> ")
  html = html.replace(/^(>.*(?:\n>.*)*)/gm, (match) => {
    // Sprawdź czy to nie jest już sformatowany blok
    if (match.includes('<div style')) return match;
    
    // ✅ Usuń "> " z każdej linii, ale zachowaj puste linie jako odstępy
    const cleanQuote = match
      .split(/\r?\n/)
      .map((line: string) => {
        const withoutPrefix = line.replace(/^>\s*/, '');
        // Jeśli linia była pusta (tylko ">"), zwróć pusty string dla odstępu
        return withoutPrefix === '' ? '' : withoutPrefix;
      })
      .map((line, index, array) => {
        if (line === '') {
          // Pusta linia - zwróć jako odstęp (będzie dodany jako <br><br>)
          return '';
        } else if (index > 0 && array[index - 1] === '') {
          // Jeśli poprzednia linia była pusta, to już będzie <br><br>, więc zwróć tylko linię
          return line;
        } else {
          return line;
        }
      })
      .filter((line, index, array) => {
        // Jeśli mamy ciąg pustych linii, zostaw tylko jedną
        if (line === '' && index > 0 && array[index - 1] === '') {
          return false;
        }
        return true;
      })
      .join('<br>')
      .replace(/<br><br>/g, '<br><br>'); // Podwójne <br> to odstęp
    
    return `<div style="color: #666; padding: 12px 16px; border-left: 3px solid #ccc; margin: 12px 0; background: #f9f9f9; border-radius: 4px; font-size: 13px; line-height: 1.6;">${cleanQuote}</div>`;
  });
  
  // 5. ✅ Obsługa placeholderów CID dla obrazów (np. [cid:image001.png@01DC4E35.596DBEF0])
  html = html.replace(/\[cid:([^\]]+)\]/gi, (match, cidContent) => {
    const fileName = cidContent.split('@')[0] || cidContent;
    const extension = fileName.split('.').pop()?.toUpperCase() || 'IMAGE';
    return `<span style="display: inline-block; padding: 4px 8px; background: #fff3cd; border-radius: 4px; font-size: 11px; color: #856404; margin: 4px 0; font-weight: 500; border: 1px solid #ffeaa7;">[OBRAZ: ${extension}]</span>`;
  });
  
  // 6. Konwertuj line breaks na <br> (tylko te które nie są już w sformatowanych blokach)
  // Najpierw zastąp line breaks w sformatowanych blokach specjalnym placeholderem
  html = html.replace(/<div style="[^"]*border-left[^"]*">([\s\S]*?)<\/div>/g, (match, content) => {
    return match.replace(/\r?\n/g, 'QUOTE_LINE_BREAK');
  });
  
  // Teraz zamień line breaks na <br>
  html = html
    .replace(/\r\n\r\n/g, '<br><br>')
    .replace(/\n\n/g, '<br><br>')
    .replace(/\r\r/g, '<br><br>')
    .replace(/\r\n/g, '<br>')
    .replace(/\n/g, '<br>')
    .replace(/\r/g, '<br>');
  
  // Przywróć line breaks w sformatowanych blokach (zostaną one jako <br> w środku bloku)
  html = html.replace(/QUOTE_LINE_BREAK/g, '<br>');
  
  return html;
}

/**
 * Buduje pełną stopkę kampanii
 */
function buildCampaignSignature(
  virtualSalesperson: any,
  campaign: any,
  leadLanguage: string,
  companySettings: any
): string {
  let signature = "";
  
  if (virtualSalesperson) {
    signature += "\n\n**" + virtualSalesperson.name + "**";
    
    if (campaign?.jobDescription) {
      signature += "\n" + campaign.jobDescription;
    }
    
    signature += "\n";
    if (virtualSalesperson.phone) {
      signature += "\nM. " + virtualSalesperson.phone;
    }
    const signatureEmail = virtualSalesperson.mainMailbox?.email || virtualSalesperson.email;
    signature += "\nE. " + signatureEmail;
  }
  
  if (campaign?.postscript) {
    signature += "\n\n**PS.** " + campaign.postscript;
  }
  
  if (companySettings?.logoBase64) {
    signature += "\n[LOGO]" + companySettings.logoBase64 + "[/LOGO]";
  }
  
  if (companySettings?.address) {
    signature += "\n" + companySettings.address;
  } else {
    signature += "\n\n";
    signature += "**Showroom & Office & Production:**\n";
    signature += "ul. Bukowska 16\n";
    signature += "62-081 Wysogotowo, PL";
  }
  
  if (campaign?.linkText) {
    const displayText = campaign.linkText;
    const targetUrl = campaign.linkUrl || campaign.linkText;
    signature += "\n\n**Visit our site:** [LINK]" + displayText + "[/LINK:" + targetUrl + "]";
  }
  
  if (companySettings?.legalFooter) {
    signature += "\n\n" + companySettings.legalFooter;
  } else {
    signature += "\n\n";
    signature += "The content of this message is confidential and covered by the NDA. ";
    signature += "The recipient can only be the recipient of the exclusion of third party access. ";
    signature += "If you are not the addressee of this message, or employee is authorized to transfer it to the addressee, ";
    signature += "to announce that its dissemination, copying or distribution is prohibited. ";
    signature += "If you have received this message in error, please notify the sender by sending a reply ";
    signature += "and delete this message with attachments from your mailbox. Thank you. Kreativia.";
  }
  
  return signature;
}

/**
 * POST /api/material-decisions/[id]/send-test - Wyślij testowy email z podglądem odpowiedzi
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const decisionId = parseInt(params.id);

    // Pobierz decyzję z pełnymi danymi
    const decision = await db.pendingMaterialDecision.findUnique({
      where: { id: decisionId },
      include: {
        lead: true,
        campaign: {
          include: {
            virtualSalesperson: {
              include: {
                mainMailbox: {
                  select: {
                    email: true
                  }
                },
                mailboxes: {
                  where: { isActive: true },
                  orderBy: [
                    { priority: 'asc' },
                    { lastUsedAt: 'asc' }
                  ],
                  take: 1
                }
              }
            },
            materials: {
              where: { isActive: true },
              orderBy: { order: 'asc' }
            }
          }
        },
        reply: true
      }
    });

    if (!decision) {
      return NextResponse.json(
        { success: false, error: "Decyzja nie została znaleziona" },
        { status: 404 }
      );
    }

    // Pobierz adres testowy z ustawień
    const companySettings = await db.companySettings.findFirst();
    const testEmail = companySettings?.forwardEmail || "bartosz.kosiba@kreativia.pl";

    if (!testEmail) {
      return NextResponse.json(
        { success: false, error: "Nie znaleziono adresu email do testowej wysyłki w ustawieniach" },
        { status: 400 }
      );
    }

    // Wygeneruj podstawową treść odpowiedzi
    const campaignLanguage = decision.campaign.virtualSalesperson?.language || decision.lead.language || 'pl';
    
    const responseContent = await generateMaterialResponse(
      {
        firstName: decision.lead.firstName,
        lastName: decision.lead.lastName,
        greetingForm: decision.lead.greetingForm,
        language: decision.lead.language || 'pl'
      },
      {
        id: decision.campaign.id,
        name: decision.campaign.name,
        autoReplyContext: decision.campaign.autoReplyContext,
        autoReplyRules: decision.campaign.autoReplyRules,
        virtualSalespersonLanguage: decision.campaign.virtualSalesperson?.language || null,
        autoReplyContent: decision.campaign.autoReplyContent
      },
      decision.campaign.materials.map(m => ({
        name: m.name,
        type: m.type as "LINK" | "ATTACHMENT",
        url: m.url,
        fileName: m.fileName
      })),
      decision.leadResponse,
      decision.reply.subject || null
    );

    // Zbuduj pełną treść emaila (jak w preview)
    const leadLanguage = decision.lead.language || 'pl';
    const languageMismatch = campaignLanguage !== leadLanguage;
    
    let greetingForm: string | null = null;
    
    if (languageMismatch) {
      if (decision.lead.firstName) {
        try {
          const { chatgptService } = await import('@/services/chatgptService');
          const results = await chatgptService.batchProcessNames(
            [decision.lead.firstName],
            [decision.lead.lastName || ''],
            [campaignLanguage]
          );
          
          if (results && results.length > 0 && results[0]?.greetingForm) {
            greetingForm = results[0].greetingForm;
          }
        } catch (error: any) {
          greetingForm = getDefaultGreetingForLanguage(campaignLanguage);
        }
      } else {
        greetingForm = getDefaultGreetingForLanguage(campaignLanguage);
      }
    } else {
      greetingForm = decision.lead.greetingForm;
    }

    let emailContent = '';
    if (greetingForm) {
      emailContent = greetingForm + "\n\n" + responseContent.content;
    } else {
      emailContent = responseContent.content;
    }

    // Info o opiekunie (jeśli włączone)
    if (decision.campaign.autoReplyIncludeGuardian && decision.campaign.virtualSalesperson) {
      const salesperson = decision.campaign.virtualSalesperson;
      const realName = salesperson.realSalespersonName;
      const realEmail = salesperson.realSalespersonEmail;
      const realPhone = salesperson.realSalespersonPhone;
      const realSignature = salesperson.realSalespersonSignature;
      
      if (realName && realEmail) {
        const introText = decision.campaign.autoReplyGuardianIntroText?.trim();
        if (introText) {
          emailContent += '\n\n\n\n' + introText; // ✅ Dwa dodatkowe entery przed tekstem
        }
        
        emailContent += '\n\n**' + realName + '**';
        if (realSignature) {
          emailContent += '\n' + realSignature;
        }
        if (realPhone || realEmail) {
          emailContent += '\n';
          if (realPhone) {
            emailContent += '\nM. ' + realPhone;
          }
          if (realEmail) {
            emailContent += '\nE. ' + realEmail;
          }
        }
      }
    }

    // ✅ Przygotuj załączniki (dokładnie jak w materialResponseSender.ts)
    const attachments: Array<{ filename: string; path: string }> = [];
    const links: Array<{ name: string; url: string }> = [];
    
    console.log(`[MATERIAL TEST] 📦 Przetwarzam ${decision.campaign.materials.length} materiałów...`);
    
    for (const material of decision.campaign.materials) {
      console.log(`[MATERIAL TEST] 📄 Materiał: ${material.name} (type: ${material.type}, fileName: ${material.fileName || 'null'})`);
      
      if (material.type === 'ATTACHMENT' && material.fileName) {
        // ✅ fileName może zawierać pełną ścieżkę względną (np. "materials/3_123456_katalog.pdf")
        // lub tylko nazwę pliku (np. "katalog.pdf")
        const fileName = material.fileName;
        console.log(`[MATERIAL TEST] 🔍 Szukam pliku: ${fileName}`);
        
        // Usuń prefix "materials/" jeśli istnieje
        const fileNameWithoutPath = fileName.replace(/^materials\//, '');
        const baseFileName = path.basename(fileName);
        const baseFileNameWithoutPath = path.basename(fileNameWithoutPath);
        
        console.log(`[MATERIAL TEST] Warianty nazwy: fileNameWithoutPath="${fileNameWithoutPath}", baseFileName="${baseFileName}", baseFileNameWithoutPath="${baseFileNameWithoutPath}"`);
        
        // ✅ NOWE: Szukaj plików z prefiksem {campaignId}_{timestamp}_ w uploads/materials/
        // Pliki są zapisywane jako: {campaignId}_{timestamp}_{originalFileName}
        const campaignId = decision.campaign.id;
        const uploadsDir = path.join(process.cwd(), 'uploads', 'materials');
        let foundPath: string | null = null;
        
        // Najpierw sprawdź dokładną nazwę (jeśli fileName zawiera pełną ścieżkę)
        const exactPaths = [
          path.join(process.cwd(), 'uploads', 'materials', fileName),
          path.join(process.cwd(), 'uploads', 'materials', fileNameWithoutPath),
          path.join(process.cwd(), 'uploads', 'materials', baseFileName),
          path.join(process.cwd(), 'uploads', 'materials', baseFileNameWithoutPath),
        ];
        
        for (const exactPath of exactPaths) {
          if (fs.existsSync(exactPath)) {
            foundPath = exactPath;
            console.log(`[MATERIAL TEST] ✅ Znaleziono dokładną ścieżkę: ${foundPath}`);
            break;
          }
        }
        
        // Jeśli nie znaleziono, szukaj plików z prefiksem {campaignId}_*
        if (!foundPath && fs.existsSync(uploadsDir)) {
          try {
            const filesInDir = fs.readdirSync(uploadsDir);
            console.log(`[MATERIAL TEST] Szukam pliku z prefiksem ${campaignId}_* wśród ${filesInDir.length} plików...`);
            
            // Szukaj pliku który zaczyna się od {campaignId}_ i zawiera nazwę pliku
            const matchingFile = filesInDir.find(file => {
              // Plik powinien zaczynać się od {campaignId}_ i zawierać nazwę pliku (może być zmieniona)
              const startsWithCampaignId = file.startsWith(`${campaignId}_`);
              const containsFileName = baseFileNameWithoutPath && 
                file.toLowerCase().includes(baseFileNameWithoutPath.toLowerCase().replace(/[^a-z0-9]/gi, '_'));
              return startsWithCampaignId && (containsFileName || file.includes(baseFileNameWithoutPath));
            });
            
            if (matchingFile) {
              foundPath = path.join(uploadsDir, matchingFile);
              console.log(`[MATERIAL TEST] ✅ Znaleziono plik z prefiksem: ${foundPath}`);
            } else {
              // Jeśli nie znaleziono dopasowania, użyj ostatniego pliku z prefiksem {campaignId}_
              const campaignFiles = filesInDir.filter(f => f.startsWith(`${campaignId}_`)).sort().reverse();
              if (campaignFiles.length > 0) {
                foundPath = path.join(uploadsDir, campaignFiles[0]);
                console.log(`[MATERIAL TEST] ⚠️ Używam ostatniego pliku z kampanii ${campaignId}: ${campaignFiles[0]}`);
              }
            }
          } catch (e: any) {
            console.error(`[MATERIAL TEST] Błąd odczytu katalogu: ${e.message}`);
          }
        }
        
        // Fallback: sprawdź inne lokalizacje
        const fallbackPaths = [
          path.join(process.cwd(), 'public', 'materials', fileName),
          path.join(process.cwd(), 'public', 'materials', fileNameWithoutPath),
          path.join(process.cwd(), 'materials', fileName),
          path.join(process.cwd(), 'materials', fileNameWithoutPath),
          path.join(process.cwd(), fileName),
          path.join(process.cwd(), fileNameWithoutPath)
        ];
        
        if (!foundPath) {
          for (const fallbackPath of fallbackPaths) {
            if (fs.existsSync(fallbackPath)) {
              foundPath = fallbackPath;
              console.log(`[MATERIAL TEST] ✅ Znaleziono w fallback: ${foundPath}`);
              break;
            }
          }
        }
        
        // foundPath jest już ustawiony w kodzie powyżej
        
        if (foundPath) {
          // Użyj oryginalnej nazwy pliku (bez ścieżki) dla załącznika
          const attachmentFileName = baseFileNameWithoutPath || baseFileName || material.name;
          attachments.push({
            filename: attachmentFileName,
            path: foundPath
          });
          console.log(`[MATERIAL TEST] ✅ Dodano załącznik: ${attachmentFileName} (z ${foundPath})`);
        } else {
          console.error(`[MATERIAL TEST] ❌❌❌ PLIK NIE ISTNIEJE w żadnej z lokalizacji dla: ${fileName}`);
          const allCheckedPaths = [
            path.join(process.cwd(), 'uploads', 'materials', fileName),
            path.join(process.cwd(), 'uploads', 'materials', fileNameWithoutPath),
            ...fallbackPaths
          ];
          console.error(`[MATERIAL TEST] Sprawdzane ścieżki:`, allCheckedPaths.map((p: string) => `  - ${p}`).join('\n'));
          
          // Sprawdź czy katalog uploads/materials istnieje
          const uploadsDir = path.join(process.cwd(), 'uploads', 'materials');
          const uploadsDirExists = fs.existsSync(uploadsDir);
          console.error(`[MATERIAL TEST] Katalog uploads/materials istnieje: ${uploadsDirExists}`);
          if (uploadsDirExists) {
            try {
              const filesInDir = fs.readdirSync(uploadsDir);
              console.error(`[MATERIAL TEST] Pliki w uploads/materials (${filesInDir.length}):`, filesInDir.slice(0, 10).join(', '));
            } catch (e: any) {
              console.error(`[MATERIAL TEST] Błąd odczytu katalogu: ${e.message}`);
            }
          }
        }
      } else if (material.type === 'LINK' && material.url) {
        links.push({
          name: material.name,
          url: material.url
        });
        console.log(`[MATERIAL TEST] ✅ Dodano link: ${material.name} -> ${material.url}`);
      } else {
        console.warn(`[MATERIAL TEST] ⚠️ Materiał ${material.name} pominięty (type: ${material.type}, fileName: ${material.fileName || 'null'})`);
      }
    }
    
    console.log(`[MATERIAL TEST] 📎 Podsumowanie: ${attachments.length} załączników, ${links.length} linków`);

    // 3. Linki do materiałów (jeśli są) - PRZED stopką
    if (links.length > 0) {
      emailContent += '\n\n';
      links.forEach(link => {
        emailContent += `\n${link.name}: ${link.url}`;
      });
    }

    // 4. Pełna stopka kampanii
    if (decision.campaign.autoReplyIncludeGuardian || links.length > 0) {
      emailContent += '\n\n\n';
    }
    
    const signature = buildCampaignSignature(
      decision.campaign.virtualSalesperson,
      decision.campaign,
      leadLanguage,
      companySettings
    );
    
    emailContent += signature;

    // 5. Cytat z odpowiedzi leada NA KOŃCU
    if (decision.reply?.content && decision.reply?.fromEmail && decision.reply?.receivedAt) {
      const replyDate = new Date(decision.reply.receivedAt);
      const dateStr = replyDate.toLocaleDateString('pl-PL', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric' 
      });
      const timeStr = replyDate.toLocaleTimeString('pl-PL', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
      
      // ✅ Wyczyść treść odpowiedzi leada z HTML, ale ZACHOWAJ formatowanie (puste linie, odstępy)
      let leadReplyText = decision.reply.content
        .replace(/<[^>]+>/g, '') // Usuń HTML tagi
        .replace(/&nbsp;/g, ' ') // Zamień &nbsp; na spacje
        .replace(/&amp;/g, '&') // Przywróć &
        .replace(/&lt;/g, '<') // Przywróć <
        .replace(/&gt;/g, '>') // Przywróć >
        .replace(/&quot;/g, '"') // Przywróć "
        // ✅ NIE usuń wielokrotnych \n - zachowaj puste linie dla formatowania
        .trim();
      
      const lines = leadReplyText.split('\n');
      let directReplyLines: string[] = [];
      
      for (const line of lines) {
        const trimmedLine = line.trim();
        
        if (
          trimmedLine.startsWith('>') ||
          trimmedLine.match(/^Wiadomość napisana przez/i) ||
          trimmedLine.match(/^Message written by/i) ||
          trimmedLine.match(/^On .+ wrote:/i) ||
          trimmedLine.match(/^-----/i) ||
          trimmedLine.match(/^From:/i) ||
          trimmedLine === '--'
        ) {
          break;
        }
        
        // ✅ Zachowaj pustą linię jeśli istnieje (dla formatowania)
        directReplyLines.push(line);
      }
      
      // ✅ Usuń puste linie tylko na początku i końcu, ale ZACHOWAJ w środku
      let cleanReplyText = directReplyLines.join('\n');
      cleanReplyText = cleanReplyText.replace(/^\n+/, '').replace(/\n+$/, '');
      
      if (cleanReplyText) {
        const languageLabels = {
          pl: 'Wiadomość napisana przez',
          en: 'Message written by',
          de: 'Nachricht geschrieben von',
          fr: 'Message écrit par'
        };
        
        const label = languageLabels[campaignLanguage as keyof typeof languageLabels] || languageLabels.pl;
        const leadName = `${decision.lead.firstName || ''} ${decision.lead.lastName || ''}`.trim() || decision.lead.email;
        
        // ✅ Dodaj odstępy przed cytatem i wizualne oznaczenie
        emailContent += '\n\n\n';
        emailContent += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        emailContent += `${label} ${leadName} w dniu ${dateStr}, o godz. ${timeStr}:\n`;
        emailContent += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
        
        // ✅ Dodaj prefix "> " do każdej linii cytatu, ZACHOWAJ puste linie (są ważne dla formatowania!)
        const quotedLines = cleanReplyText.split('\n').map(line => {
          if (line.trim() === '') {
            // Pusta linia - zachowaj jako pustą linię (będzie renderowana jako odstęp w HTML)
            return '>';
          } else {
            return `> ${line}`;
          }
        });
        emailContent += quotedLines.join('\n');
        emailContent += '\n\n';
      }
    }

    // ✅ Konwersja do HTML dokładnie jak w materialResponseSender.ts
    // Wersja tekstowa (usuń **bold**, znaczniki linków i logo)
    let textContent = emailContent.replace(/\*\*(.+?)\*\*/g, '$1');
    textContent = textContent.replace(/\[LINK\](.+?)\[\/LINK:(.+?)\]/g, '$1');
    textContent = textContent.replace(/\[LOGO\].+?\[\/LOGO\]/g, '[Logo firmy]');
    
    // ✅ Wersja HTML - convertToHtml już formatuje cytaty poprawnie
    let htmlContent = convertToHtml(emailContent);

    // Pobierz pierwszą dostępną skrzynkę mailową
    const mailbox = decision.campaign.virtualSalesperson?.mailboxes?.[0];
    if (!mailbox) {
      return NextResponse.json(
        { success: false, error: "Brak dostępnej skrzynki mailowej dla kampanii" },
        { status: 400 }
      );
    }

    // Utwórz transport SMTP (dokładnie jak w materialResponseSender.ts)
    const { createSmtpTransport } = await import('@/integrations/smtp/client');
    const transport = createSmtpTransport({
      smtpHost: mailbox.smtpHost,
      smtpPort: mailbox.smtpPort,
      smtpUser: mailbox.smtpUser,
      smtpPass: mailbox.smtpPass,
      smtpSecure: mailbox.smtpSecure
    });

    // Przygotuj załączniki dla nodemailer
    const nodemailerAttachments = attachments.map(att => ({
      filename: att.filename,
      path: att.path
    }));

    console.log(`[MATERIAL TEST] 📎 Przygotowano ${attachments.length} załączników:`, 
      attachments.map(a => `${a.filename} (${a.path})`).join(', '));

    // Wyślij email testowy
    const fromEmail = mailbox.email;
    const fromName = mailbox.displayName || decision.campaign.virtualSalesperson?.name || "Kreativia";

    const mailOptions: any = {
      from: `"${fromName}" <${fromEmail}>`,
      to: testEmail,
      subject: `[TEST] ${responseContent.subject}`,
      text: textContent,
      html: htmlContent,
      attachments: nodemailerAttachments.length > 0 ? nodemailerAttachments : undefined,
      replyTo: mailbox.email
    };

    console.log(`[MATERIAL TEST] 📧 Wysyłanie emaila z ${nodemailerAttachments.length} załącznikami...`);

    // ✅ NIE dodawaj handlowca do CC w testowym emailu (aby nie wprowadzać w błąd)

    try {
      const result = await transport.sendMail(mailOptions);
      console.log(`[MATERIAL TEST] ✅ Testowy email wysłany: ${fromEmail} -> ${testEmail} (${result.messageId})`);

      // ✅ Zapisz do SendLog dla archiwum
      try {
        await db.sendLog.create({
          data: {
            campaignId: decision.campaign.id,
            leadId: null, // Testowy email - nie ma leada
            mailboxId: mailbox.id,
            toEmail: testEmail, // Adres testowy
            subject: `[TEST] ${responseContent.subject}`,
            content: emailContent.substring(0, 500), // Ogranicz do 500 znaków dla logu
            status: 'sent',
            messageId: result.messageId
          }
        });
        console.log(`[MATERIAL TEST] ✅ Zapisano testowy email do SendLog`);
      } catch (logError: any) {
        console.warn(`[MATERIAL TEST] Nie udało się zapisać do SendLog:`, logError.message);
        // Nie przerywaj jeśli logowanie się nie powiedzie
      }

      return NextResponse.json({
        success: true,
        message: `Testowy email został wysłany na adres ${testEmail}${attachments.length > 0 ? ` z ${attachments.length} załącznikami` : ''}`
      });
    } catch (error: any) {
      console.error("[MATERIAL TEST] ❌ Błąd wysyłki testowej:", error);
      return NextResponse.json(
        { success: false, error: "Błąd podczas wysyłki testowej: " + error.message },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("[MATERIAL DECISION SEND TEST] Błąd:", error);
    return NextResponse.json(
      { success: false, error: "Błąd podczas wysyłki testowej: " + error.message },
      { status: 500 }
    );
  }
}

