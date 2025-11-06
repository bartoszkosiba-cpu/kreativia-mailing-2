"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";

// ✅ Funkcja formatująca treść emaila (obsługuje HTML, line breaks, base64, [LOGO], [LINK], CID placeholders)
function formatEmailContent(content: string): string {
  if (!content) return '';
  
  let formatted = content;
  
  // 1. Najpierw obsłuż specjalne tagi systemowe PRZED innym formatowaniem
  // Konwertuj [LOGO]base64[/LOGO] lub [LOGO] [LOGO: PNG] [/LOGO] na znacznik
  formatted = formatted.replace(/\[LOGO\]([\s\S]*?)\[\/LOGO\]/g, (match, logoContent) => {
    // Jeśli zawiera base64, wyciągnij typ
    if (logoContent.includes('data:image')) {
      const imageTypeMatch = logoContent.match(/data:image\/([^;]+)/);
      const imageType = imageTypeMatch ? imageTypeMatch[1] : 'image';
      return `<span style="display: inline-block; padding: 4px 8px; background: #e3f2fd; border-radius: 4px; font-size: 11px; color: #1976d2; margin: 4px 0; font-weight: 500;">[LOGO: ${imageType.toUpperCase()}]</span>`;
    }
    // Jeśli zawiera [LOGO: PNG] to już jest znacznik
    if (logoContent.includes('[LOGO:')) {
      return `<span style="display: inline-block; padding: 4px 8px; background: #e3f2fd; border-radius: 4px; font-size: 11px; color: #1976d2; margin: 4px 0; font-weight: 500;">${logoContent.trim()}</span>`;
    }
    return `<span style="display: inline-block; padding: 4px 8px; background: #e3f2fd; border-radius: 4px; font-size: 11px; color: #1976d2; margin: 4px 0; font-weight: 500;">[LOGO]</span>`;
  });
  
  // Konwertuj [LINK]text[/LINK:url] na <a href="url">text</a>
  formatted = formatted.replace(/\[LINK\](.+?)\[\/LINK:(.+?)\]/g, '<LINK_PLACEHOLDER href="$2">$1</LINK_PLACEHOLDER>');
  
  // Ukryj długie ciągi base64 (logo/images) - zamień na krótką informację
  const base64Pattern = /data:image\/[^;]+;base64,[A-Za-z0-9+/=\s]{100,}/g;
  formatted = formatted.replace(base64Pattern, (match) => {
    const imageTypeMatch = match.match(/data:image\/([^;]+)/);
    const imageType = imageTypeMatch ? imageTypeMatch[1] : 'image';
    return `<span style="display: inline-block; padding: 4px 8px; background: #e3f2fd; border-radius: 4px; font-size: 11px; color: #1976d2; margin: 4px 0; font-weight: 500;">[LOGO: ${imageType.toUpperCase()}]</span>`;
  });
  
  // ✅ Obsługa placeholderów CID dla obrazów (np. [cid:image001.png@01DC4E35.596DBEF0])
  formatted = formatted.replace(/\[cid:([^\]]+)\]/gi, (match, cidContent) => {
    const fileName = cidContent.split('@')[0] || cidContent;
    const extension = fileName.split('.').pop()?.toUpperCase() || 'IMAGE';
    return `<span style="display: inline-block; padding: 4px 8px; background: #fff3cd; border-radius: 4px; font-size: 11px; color: #856404; margin: 4px 0; font-weight: 500; border: 1px solid #ffeaa7;">[OBRAZ: ${extension}]</span>`;
  });
  
  // ✅ Formatuj sekcję "Wiadomość napisana przez..." przed formatowaniem cytatów
  // Znajdź nagłówek cytatu i cały blok cytatów po nim (może być wiele linii)
  formatted = formatted.replace(/(Wiadomość napisana przez[^\n\r]+(?:[\r\n]+))((?:>.*[\r\n]*)+)/gi, (match, header, quoteBlock) => {
    // Formatuj nagłówek (escape HTML, ale nie dodawaj tagów HTML jeszcze)
    const headerText = header.trim();
    
    // Formatuj blok cytatów - wyciągnij wszystkie linie z ">"
    // ✅ Zachowaj puste linie (linie z samym ">") jako odstępy
    const quoteLines = quoteBlock
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line.startsWith('>'))
      .map(line => {
        const withoutPrefix = line.replace(/^>\s*/, '');
        // Jeśli linia była pusta (tylko ">"), zwróć pusty string (będzie renderowany jako odstęp)
        return withoutPrefix === '' ? '' : withoutPrefix;
      });
    
    if (quoteLines.length === 0) {
      return match; // Jeśli nie ma cytatów, zwróć oryginał
    }
    
    // ✅ Połącz linie, ale puste linie (puste stringi) zamień na <br><br> (odstęp)
    const cleanQuote = quoteLines
      .map((line, index) => {
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
    
    // Zwróć sformatowany nagłówek i blok cytatów (escape HTML zostanie zrobiony później)
    return `<QUOTE_HEADER>${headerText}</QUOTE_HEADER><QUOTE_CONTENT>${cleanQuote}</QUOTE_CONTENT>`;
  });
  
  // 2. Sprawdź czy to HTML (zawiera tagi HTML)
  const hasHtmlTags = /<[a-z][\s\S]*>/i.test(formatted);
  
  if (!hasHtmlTags) {
    // To zwykły tekst - konwertuj na HTML
    // 1. Najpierw formatuj specjalne elementy PRZED escape HTML
    
    // Formatuj **bold** (PRZED escape HTML) - obsługuj wielokrotne wystąpienia
    formatted = formatted.replace(/\*\*(.+?)\*\*/g, '<STRONG_PLACEHOLDER>$1</STRONG_PLACEHOLDER>');
    
    // Formatuj cytaty (linie zaczynające się od "> ") - PRZED escape HTML
    // Obsługuj wieloliniowe cytaty - znajdź wszystkie ciągłe bloki cytatów (które nie zostały już sformatowane)
    formatted = formatted.replace(/^(?!.*<div style.*border-left.*>.*<\/div>)(>.*(?:\n>.*)*)/gm, (match) => {
      // Sprawdź czy to nie jest już sformatowany blok
      if (match.includes('<div style')) return match;
      
      // ✅ Usuń "> " z każdej linii, ale zachowaj puste linie jako odstępy
      const cleanQuote = match
        .split(/\r?\n/)
        .map(line => {
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
      
      return `<QUOTE_BLOCK>${cleanQuote}</QUOTE_BLOCK>`;
    });
    
    // Formatuj separator linii (━━━━━━)
    formatted = formatted.replace(/━+/g, '<hr style="border: none; border-top: 1px solid #ddd; margin: 10px 0;" />');
    
    // 2. Escape HTML specjalnych znaków (aby uniknąć XSS)
    formatted = formatted
      .replace(/&/g, '&amp;') // Najpierw &, potem reszta
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
    
    // 3. Przywróć placeholdery jako prawdziwe tagi HTML
    // Najpierw przywróć <br> wewnątrz QUOTE_CONTENT i QUOTE_BLOCK (zostały escape jako &lt;br&gt;)
    formatted = formatted.replace(/&lt;QUOTE_CONTENT&gt;([\s\S]*?)&lt;\/QUOTE_CONTENT&gt;/g, (match, content) => {
      // Przywróć <br> wewnątrz cytatu
      const restoredContent = content.replace(/&lt;br&gt;/g, '<br>');
      return `&lt;QUOTE_CONTENT&gt;${restoredContent}&lt;/QUOTE_CONTENT&gt;`;
    });
    
    formatted = formatted.replace(/&lt;QUOTE_BLOCK&gt;([\s\S]*?)&lt;\/QUOTE_BLOCK&gt;/g, (match, content) => {
      // Przywróć <br> wewnątrz cytatu
      const restoredContent = content.replace(/&lt;br&gt;/g, '<br>');
      return `&lt;QUOTE_BLOCK&gt;${restoredContent}&lt;/QUOTE_BLOCK&gt;`;
    });
    
    // Teraz zamień placeholdery na prawdziwe tagi HTML
    formatted = formatted
      .replace(/&lt;STRONG_PLACEHOLDER&gt;/g, '<strong>')
      .replace(/&lt;\/STRONG_PLACEHOLDER&gt;/g, '</strong>')
      .replace(/&lt;QUOTE_HEADER&gt;/g, '<div style="color: #888; font-size: 12px; margin: 16px 0 8px 0; font-style: italic;">')
      .replace(/&lt;\/QUOTE_HEADER&gt;/g, '</div>')
      .replace(/&lt;QUOTE_CONTENT&gt;/g, '<div style="color: #666; padding: 12px 16px; border-left: 3px solid #ccc; margin: 0 0 16px 0; background: #f9f9f9; border-radius: 4px; font-size: 13px; line-height: 1.6;">')
      .replace(/&lt;\/QUOTE_CONTENT&gt;/g, '</div>')
      .replace(/&lt;QUOTE_BLOCK&gt;/g, '<div style="color: #666; padding: 12px 16px; border-left: 3px solid #ccc; margin: 12px 0; background: #f9f9f9; border-radius: 4px; font-size: 13px; line-height: 1.6;">')
      .replace(/&lt;\/QUOTE_BLOCK&gt;/g, '</div>')
      .replace(/&lt;LINK_PLACEHOLDER href="([^"]+)"&gt;/g, '<a href="$1" target="_blank" style="color: #0066cc; text-decoration: underline;">')
      .replace(/&lt;\/LINK_PLACEHOLDER&gt;/g, '</a>');
    
    // 4. Konwertuj line breaks na <br> (zachowaj podwójne entery jako odstępy)
    // Najpierw zastąp line breaks w sformatowanych blokach specjalnym placeholderem
    formatted = formatted.replace(/<div style="[^"]*border-left[^"]*">([\s\S]*?)<\/div>/g, (match, content) => {
      return match.replace(/\r?\n/g, 'QUOTE_LINE_BREAK');
    });
    
    // Teraz zamień line breaks na <br>
    formatted = formatted
      .replace(/\r\n\r\n/g, '<br><br>') // Podwójne Windows line breaks
      .replace(/\n\n/g, '<br><br>') // Podwójne Unix line breaks
      .replace(/\r\r/g, '<br><br>') // Podwójne Mac line breaks
      .replace(/\r\n/g, '<br>') // Pojedyncze Windows line breaks
      .replace(/\n/g, '<br>') // Pojedyncze Unix line breaks
      .replace(/\r/g, '<br>'); // Pojedyncze Mac line breaks
    
    // Przywróć line breaks w sformatowanych blokach (zostaną one jako <br> w środku bloku)
    formatted = formatted.replace(/QUOTE_LINE_BREAK/g, '<br>');
    
    // 5. Formatuj linki (http/https) - po escape HTML
    formatted = formatted.replace(/(https?:\/\/[^\s&lt;&gt;&quot;']+)/gi, (match) => {
      const decoded = match.replace(/&amp;/g, '&').replace(/&quot;/g, '"');
      return `<a href="${decoded}" target="_blank" style="color: #0066cc; text-decoration: underline;">${match}</a>`;
    });
    
    // 6. Formatuj emaile
    formatted = formatted.replace(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, '<a href="mailto:$1" style="color: #0066cc; text-decoration: underline;">$1</a>');
  } else {
    // To już HTML - ale może zawierać też markdown, więc formatuj markdown nawet w HTML
    
    // Formatuj **bold** markdown nawet jeśli jest HTML
    formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    
    // Formatuj cytaty w HTML (linie z "> " które nie są w tagach HTML)
    // Najpierw znajdź tekstowe cytaty (poza tagami HTML) - ale tylko jeśli nie zostały już sformatowane
    if (!formatted.includes('border-left: 3px solid #ccc')) {
      // Prostsza metoda - znajdź wszystkie bloki z ">" i sformatuj je
      formatted = formatted.replace(/((?:^|>)[^<]*?)((?:>.*[\r\n]*)+)/gm, (match, before, quoteBlock) => {
        // Jeśli przed cytatem nie ma tagu HTML i to nie jest już sformatowany blok
        if (!before.includes('<div') && !before.includes('<span') && !match.includes('border-left')) {
          // ✅ Formatuj blok cytatów - zachowaj puste linie jako odstępy
          const quoteLines = quoteBlock
            .split(/\r?\n/)
            .map(line => line.trim())
            .filter(line => line.startsWith('>'))
            .map(line => {
              const withoutPrefix = line.replace(/^>\s*/, '');
              // Jeśli linia była pusta (tylko ">"), zwróć pusty string (będzie renderowany jako odstęp)
              return withoutPrefix === '' ? '' : withoutPrefix;
            });
          
          if (quoteLines.length === 0) {
            return match; // Jeśli nie ma cytatów, zwróć oryginał
          }
          
          // ✅ Połącz linie, ale puste linie (puste stringi) zamień na <br><br> (odstęp)
          const cleanQuote = quoteLines
            .map((line, index) => {
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
          
          return `${before}<div style="color: #666; padding: 12px 16px; border-left: 3px solid #ccc; margin: 12px 0; background: #f9f9f9; border-radius: 4px; font-size: 13px; line-height: 1.6;">${cleanQuote}</div>`;
        }
        return match;
      });
    }
    
    // Obsługa placeholderów CID nawet w HTML (jeśli nie zostały jeszcze przetworzone)
    formatted = formatted.replace(/\[cid:([^\]]+)\]/gi, (match, cidContent) => {
      const fileName = cidContent.split('@')[0] || cidContent;
      const extension = fileName.split('.').pop()?.toUpperCase() || 'IMAGE';
      return `<span style="display: inline-block; padding: 4px 8px; background: #fff3cd; border-radius: 4px; font-size: 11px; color: #856404; margin: 4px 0; font-weight: 500; border: 1px solid #ffeaa7;">[OBRAZ: ${extension}]</span>`;
    });
    
    // ✅ Formatuj separator ━━ na <hr> (jeśli jeszcze nie został sformatowany)
    formatted = formatted.replace(/━+/g, '<hr style="border: none; border-top: 1px solid #ddd; margin: 10px 0;" />');
    
    // ✅ Konwertuj line breaks na <br> dla całej treści
    // Najpierw zachowaj line breaks w sformatowanych blokach cytatów
    formatted = formatted.replace(/<div style="[^"]*border-left[^"]*">([\s\S]*?)<\/div>/g, (match, content) => {
      return match.replace(/\r?\n/g, 'QUOTE_LINE_BREAK');
    });
    
    // Teraz zamień wszystkie line breaks na <br> (dla całej treści)
    formatted = formatted
      .replace(/\r\n\r\n/g, '<br><br>') // Podwójne Windows line breaks
      .replace(/\n\n/g, '<br><br>') // Podwójne Unix line breaks
      .replace(/\r\r/g, '<br><br>') // Podwójne Mac line breaks
      .replace(/\r\n/g, '<br>') // Pojedyncze Windows line breaks
      .replace(/\n/g, '<br>') // Pojedyncze Unix line breaks
      .replace(/\r/g, '<br>'); // Pojedyncze Mac line breaks
    
    // Przywróć line breaks w sformatowanych blokach cytatów (zostaną one jako <br> w środku bloku)
    formatted = formatted.replace(/QUOTE_LINE_BREAK/g, '<br>');
  }
  
  return formatted;
}

interface Decision {
  id: number;
  lead: {
    id: number;
    firstName: string | null;
    lastName: string | null;
    email: string;
    company: string | null;
  };
  campaign: {
    id: number;
    name: string;
  };
  reply: {
    id: number;
    fromEmail: string;
    subject: string | null;
    content: string;
    createdAt: Date;
    receivedAt?: Date | null;
  };
  aiConfidence: number;
  aiReasoning: string;
  leadResponse: string;
  suggestedAction: string;
  status: string;
  createdAt: Date;
}

interface MaterialResponse {
  id: number;
  lead: {
    id: number;
    firstName: string | null;
    lastName: string | null;
    email: string;
    company: string | null;
  };
  campaign: {
    id: number;
    name: string;
  };
  reply: {
    id: number;
    subject: string | null;
    content: string;
    receivedAt: Date;
  } | null;
  subject: string;
  responseText: string;
  sentAt: Date | null;
  status: string;
  mailboxId?: number | null;
  messageId?: string | null;
}

interface PreviewData {
  subject: string;
  content: string;
  materials: Array<{
    id: number;
    name: string;
    type: string;
    url?: string | null;
    fileName?: string | null;
  }>;
}

interface Props {
  campaignId: number;
}

interface CampaignMaterialDecisionsProps extends Props {
  showOnlyPending?: boolean;
  showOnlyRejected?: boolean;
  showOnlyHistory?: boolean;
}

export default function CampaignMaterialDecisions({ campaignId, showOnlyPending, showOnlyRejected, showOnlyHistory }: CampaignMaterialDecisionsProps) {
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [sentMaterialResponses, setSentMaterialResponses] = useState<MaterialResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(showOnlyHistory || false);
  
  // Modal state dla podglądu decyzji
  const [selectedDecision, setSelectedDecision] = useState<Decision | null>(null);
  const [decisionPreviewData, setDecisionPreviewData] = useState<PreviewData | null>(null);
  const [loadingDecisionPreview, setLoadingDecisionPreview] = useState(false);
  const [refreshingPreview, setRefreshingPreview] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  
  // State dla zarządzania decyzjami
  const [processing, setProcessing] = useState<number | null>(null);
  const [decisionNote, setDecisionNote] = useState<Record<number, string>>({});
  const [expandedDecisions, setExpandedDecisions] = useState<Set<number>>(new Set());

  const fetchData = async () => {
    setLoading(true);
    try {
      // Pobierz decyzje dla tej kampanii (w zależności od trybu)
      const status = showOnlyRejected ? 'REJECTED' : 'PENDING';
      const decisionsResponse = await fetch(`/api/campaigns/${campaignId}/auto-replies?type=decision&status=${status}`);
      const decisionsData = await decisionsResponse.json();
      
      if (decisionsData.success) {
          // Konwertuj dane z API na format Decision
          const decisionsList = (decisionsData.data || [])
            .filter((item: any) => item.type === 'decision')
            .map((item: any) => ({
              id: item.id,
              lead: item.lead,
              campaign: { id: campaignId, name: item.campaign?.name || '' },
              reply: {
                ...item.reply,
                receivedAt: item.reply?.receivedAt || item.reply?.createdAt || null
              },
              aiConfidence: item.aiConfidence,
              aiReasoning: item.aiReasoning,
              leadResponse: item.leadResponse,
              suggestedAction: item.suggestedAction,
              status: item.status,
              createdAt: item.createdAt
            }));
        setDecisions(decisionsList);
      }

      // Pobierz historię wysłanych odpowiedzi dla tej kampanii
      const historyResponse = await fetch(`/api/campaigns/${campaignId}/auto-replies?type=material&status=sent&limit=50`);
      const historyData = await historyResponse.json();
      
      if (historyData.success) {
        // Konwertuj dane z API na format MaterialResponse
        const materialResponses = (historyData.data || [])
          .filter((item: any) => item.type === 'material')
          .map((item: any) => ({
            id: item.id,
            lead: item.lead,
            campaign: { id: campaignId, name: item.campaign?.name || '' },
            reply: item.reply,
            subject: item.subject || '',
            responseText: item.responseText || '',
            sentAt: item.sentAt || item.createdAt,
            status: item.status || 'sent',
            mailboxId: item.mailboxId || null, // ✅ Dodaj mailboxId
            messageId: item.messageId || null // ✅ Dodaj messageId
          }));
        console.log(`[CAMPAIGN MATERIAL DECISIONS] Załadowano ${materialResponses.length} wysłanych odpowiedzi`);
        setSentMaterialResponses(materialResponses);
      } else {
        console.error("[CAMPAIGN MATERIAL DECISIONS] API zwróciło błąd:", historyData.error);
      }
    } catch (error: any) {
      console.error("Błąd pobierania danych:", error);
      console.error("Szczegóły błędu:", error.message, error.stack);
    } finally {
      setLoading(false);
    }
  };

  const searchParams = useSearchParams();
  
  useEffect(() => {
    fetchData();
  }, [campaignId, showOnlyRejected]);
  
  // ✅ Automatycznie otwórz odpowiedź jeśli podano parametry URL
  useEffect(() => {
    if (!showOnlyHistory || !searchParams) return;
    
    const autoReplyLeadId = searchParams.get('autoReplyLeadId');
    const autoReplySubject = searchParams.get('autoReplySubject');
    
    if (autoReplyLeadId && sentMaterialResponses.length > 0) {
      // Znajdź odpowiedź która pasuje do leadId i tematu
      const matchingResponse = sentMaterialResponses.find((mr: MaterialResponse) => {
        const leadIdMatch = mr.lead.id === parseInt(autoReplyLeadId);
        const subjectMatch = !autoReplySubject || 
          (mr.subject && autoReplySubject && mr.subject.trim() === decodeURIComponent(autoReplySubject).trim());
        return leadIdMatch && subjectMatch;
      });
      
      if (matchingResponse) {
        // Otwórz podgląd odpowiedzi - użyj funkcji zdefiniowanej później
        setTimeout(() => {
          // handleResponseClick jest zdefiniowane później, więc użyjemy bezpośrednio logiki
          setSelectedDecision(null);
          setDecisionPreviewData(null);
          setLoadingDecisionPreview(true);
          
          // Pobierz pełną treść odpowiedzi (logika z handleResponseClick)
          fetch(`/api/campaigns/${campaignId}/materials`)
            .then(materialsResponse => materialsResponse.json())
            .then(materialsData => {
              const materials = materialsData.success && materialsData.data 
                ? materialsData.data.filter((m: any) => m.isActive).map((m: any) => ({
                    id: m.id,
                    name: m.name,
                    type: m.type,
                    url: m.url || null,
                    fileName: m.fileName || null
                  }))
                : [];
              
              // Pobierz pełną treść z SendLog jeśli MaterialResponse ma mailboxId
              let fullContent = matchingResponse.responseText || 'Brak treści';
              let fullSubject = matchingResponse.subject || 'Brak tematu';
              
              if (matchingResponse.mailboxId) {
                const sendLogUrl = matchingResponse.messageId 
                  ? `/api/campaigns/${campaignId}/send-log?mailboxId=${matchingResponse.mailboxId}&messageId=${encodeURIComponent(matchingResponse.messageId)}`
                  : `/api/campaigns/${campaignId}/send-log?mailboxId=${matchingResponse.mailboxId}&leadId=${matchingResponse.lead.id}`;
                
                return fetch(sendLogUrl)
                  .then(sendLogResponse => sendLogResponse.json())
                  .then(sendLogData => {
                    if (sendLogData.success && sendLogData.data) {
                      fullContent = sendLogData.data.content || fullContent;
                      fullSubject = sendLogData.data.subject || fullSubject;
                    }
                    return { fullContent, fullSubject, materials };
                  });
              }
              
              return { fullContent, fullSubject, materials };
            })
            .then(({ fullContent, fullSubject, materials }) => {
              setDecisionPreviewData({
                materials,
                responseContent: fullContent,
                responseSubject: fullSubject,
                lead: matchingResponse.lead,
                reply: matchingResponse.reply
              });
              setLoadingDecisionPreview(false);
            })
            .catch(error => {
              console.error('Błąd pobierania podglądu:', error);
              setLoadingDecisionPreview(false);
            });
        }, 500); // Małe opóźnienie aby lista się załadowała
      }
    }
  }, [sentMaterialResponses, searchParams, showOnlyHistory, campaignId]);

  const handleShowPreview = async (decision: Decision) => {
    setSelectedDecision(decision);
    setDecisionPreviewData(null);
    setLoadingDecisionPreview(true);

    try {
      const response = await fetch(`/api/material-decisions/${decision.id}/preview`);
      const data = await response.json();
      
      if (data.success) {
        setDecisionPreviewData(data.data);
      } else {
        alert(`Błąd: ${data.error}`);
      }
    } catch (error: any) {
      console.error("Błąd pobierania podglądu:", error);
      alert(`Błąd pobierania podglądu: ${error.message}`);
    } finally {
      setLoadingDecisionPreview(false);
    }
  };

  const handleRefreshPreview = async () => {
    if (!selectedDecision) return;
    
    setRefreshingPreview(true);
    try {
      const response = await fetch(`/api/material-decisions/${selectedDecision.id}/refresh`, {
        method: "POST"
      });
      const data = await response.json();
      
      if (data.success) {
        setDecisionPreviewData(data.data);
        alert("✓ Odpowiedź została odświeżona z aktualnymi ustawieniami kampanii");
      } else {
        alert(`Błąd: ${data.error}`);
      }
    } catch (error: any) {
      console.error("Błąd odświeżania podglądu:", error);
      alert(`Błąd odświeżania podglądu: ${error.message}`);
    } finally {
      setRefreshingPreview(false);
    }
  };

  const handleSendTest = async () => {
    if (!selectedDecision) return;
    
    if (!confirm("Czy na pewno chcesz wysłać testowy email na adres bartosz.kosiba@kreativia.pl?")) {
      return;
    }
    
    setSendingTest(true);
    try {
      const response = await fetch(`/api/material-decisions/${selectedDecision.id}/send-test`, {
        method: "POST"
      });
      const data = await response.json();
      
      if (data.success) {
        alert(`✓ Testowy email został wysłany na adres bartosz.kosiba@kreativia.pl`);
      } else {
        alert(`Błąd: ${data.error}`);
      }
    } catch (error: any) {
      console.error("Błąd wysyłki testowej:", error);
      alert(`Błąd wysyłki testowej: ${error.message}`);
    } finally {
      setSendingTest(false);
    }
  };

  const handleCloseDecisionPreview = () => {
    setSelectedDecision(null);
    setSelectedMaterialResponse(null);
    setDecisionPreviewData(null);
    setLoadingDecisionPreview(false);
  };

  const handleDecision = async (decisionId: number, status: "APPROVED" | "REJECTED") => {
    setProcessing(decisionId);

    try {
      const response = await fetch(`/api/material-decisions/${decisionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          decisionNote: decisionNote[decisionId]?.trim() || null,
          decidedBy: "Administrator"
        })
      });

      const data = await response.json();

      if (!data.success) {
        alert(`Błąd: ${data.error}`);
        return;
      }

      // Odśwież listę
      await fetchData();
      setProcessing(null);
      setDecisionNote({ ...decisionNote, [decisionId]: "" });
    } catch (error: any) {
      alert(`Błąd: ${error.message}`);
    } finally {
      setProcessing(null);
    }
  };

  const handleRestoreDecision = async (decisionId: number) => {
    setProcessing(decisionId);

    try {
      const response = await fetch(`/api/material-decisions/${decisionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "PENDING", // Przywróć do PENDING
          decisionNote: decisionNote[decisionId]?.trim() || null,
          decidedBy: "Administrator"
        })
      });

      const data = await response.json();

      if (!data.success) {
        alert(`Błąd: ${data.error}`);
        return;
      }

      alert("✓ Decyzja została przywrócona do kolejki oczekujących");
      
      // Jeśli jesteśmy w trybie showOnlyRejected, przekieruj do podkarty "oczekujace"
      if (showOnlyRejected && typeof window !== 'undefined') {
        window.location.hash = '#automatyczne-oczekujace';
      }
      
      // Odśwież listę
      await fetchData();
      setProcessing(null);
      setDecisionNote({ ...decisionNote, [decisionId]: "" });
    } catch (error: any) {
      alert(`Błąd: ${error.message}`);
    } finally {
      setProcessing(null);
    }
  };

  const [selectedMaterialResponse, setSelectedMaterialResponse] = useState<MaterialResponse | null>(null);
  const [restoringResponse, setRestoringResponse] = useState(false);

  const handleResponseClick = async (response: MaterialResponse) => {
    setSelectedDecision(null);
    setSelectedMaterialResponse(response);
    setDecisionPreviewData(null);
    setLoadingDecisionPreview(true);
    
    try {
      // Pobierz podgląd z zapisanej odpowiedzi
      const materialsResponse = await fetch(`/api/campaigns/${campaignId}/materials`);
      const materialsData = await materialsResponse.json();
      
      const materials = materialsData.success && materialsData.data 
        ? materialsData.data.filter((m: any) => m.isActive).map((m: any) => ({
            id: m.id,
            name: m.name,
            type: m.type,
            url: m.url || null,
            fileName: m.fileName || null
          }))
        : [];
      
          // ✅ Pobierz pełną treść z SendLog jeśli MaterialResponse ma mailboxId
          let fullContent = response.responseText || 'Brak treści';
          let fullSubject = response.subject || 'Brak tematu';
          
          if (response.mailboxId) {
            try {
              // Spróbuj pobrać z SendLog - najpierw po messageId, jeśli nie to po lead.id
              const sendLogUrl = response.messageId 
                ? `/api/campaigns/${campaignId}/send-log?mailboxId=${response.mailboxId}&messageId=${encodeURIComponent(response.messageId)}`
                : `/api/campaigns/${campaignId}/send-log?mailboxId=${response.mailboxId}&leadId=${response.lead.id}`;
          
          const sendLogResponse = await fetch(sendLogUrl);
          if (sendLogResponse.ok) {
            const sendLogData = await sendLogResponse.json();
            if (sendLogData.success && sendLogData.data) {
              // Użyj pełnej treści z SendLog
              fullContent = sendLogData.data.content || fullContent;
              fullSubject = sendLogData.data.subject || fullSubject;
              console.log(`[CAMPAIGN MATERIAL DECISIONS] ✅ Pobrano pełną treść z SendLog (${fullContent.length} znaków)`);
            } else {
              console.warn(`[CAMPAIGN MATERIAL DECISIONS] SendLog API zwróciło success=false:`, sendLogData.error);
            }
          } else {
            console.warn(`[CAMPAIGN MATERIAL DECISIONS] SendLog API zwróciło status ${sendLogResponse.status}`);
          }
        } catch (sendLogError) {
          console.warn("[CAMPAIGN MATERIAL DECISIONS] Nie udało się pobrać pełnej treści z SendLog, używam responseText:", sendLogError);
        }
      }
      
      setDecisionPreviewData({
        subject: fullSubject,
        content: fullContent,
        materials
      });
    } catch (error: any) {
      console.error("Błąd pobierania podglądu:", error);
      alert(`Błąd pobierania podglądu: ${error.message}`);
    } finally {
      setLoadingDecisionPreview(false);
    }
  };

  const handleRestoreMaterialResponse = async (materialResponseId: number) => {
    if (!confirm("Czy na pewno chcesz przenieść ten email z powrotem do oczekujących na decyzję?")) {
      return;
    }

    setRestoringResponse(true);
    try {
      const response = await fetch(`/api/material-responses/${materialResponseId}/restore`, {
        method: "POST"
      });
      const data = await response.json();
      
      if (data.success) {
        alert("✓ Email został przeniesiony do oczekujących na decyzję");
        // Zamknij modal i odśwież listę
        setSelectedMaterialResponse(null);
        setDecisionPreviewData(null);
        await fetchData();
        // Przekieruj do zakładki "oczekujące"
        if (typeof window !== 'undefined') {
          window.location.hash = '#automatyczne-oczekujace';
        }
      } else {
        alert(`Błąd: ${data.error}`);
      }
    } catch (error: any) {
      console.error("Błąd przywracania:", error);
      alert(`Błąd przywracania: ${error.message}`);
    } finally {
      setRestoringResponse(false);
    }
  };

  if (loading) {
    return <div style={{ padding: "40px", textAlign: "center" }}>Ładowanie...</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Tabs: Oczekujące / Historia - tylko jeśli nie są wymuszone przez showOnlyPending/showOnlyHistory/showOnlyRejected */}
      {!showOnlyPending && !showOnlyHistory && !showOnlyRejected && (
        <div style={{ display: "flex", gap: "10px", marginBottom: "20px", borderBottom: "2px solid #ddd" }}>
          <button
            onClick={() => setShowHistory(false)}
            style={{
              padding: "12px 24px",
              backgroundColor: showHistory ? "transparent" : "#2196f3",
              color: showHistory ? "#666" : "white",
              border: "none",
              borderRadius: "6px 6px 0 0",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: "14px",
              borderBottom: showHistory ? "none" : "2px solid #2196f3",
              marginBottom: "-2px"
            }}
          >
            Oczekujące decyzje ({decisions.length})
          </button>
          <button
            onClick={() => setShowHistory(true)}
            style={{
              padding: "12px 24px",
              backgroundColor: showHistory ? "#2196f3" : "transparent",
              color: showHistory ? "white" : "#666",
              border: "none",
              borderRadius: "6px 6px 0 0",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: "14px",
              borderBottom: showHistory ? "2px solid #2196f3" : "none",
              marginBottom: "-2px"
            }}
          >
            Historia wysłanych ({sentMaterialResponses.length})
          </button>
        </div>
      )}

      {/* Zawartość zakładek */}
      {showOnlyRejected ? (
        // ZAKŁADKA: Odrzucone decyzje
        decisions.length === 0 ? (
          <div style={{ padding: "40px", textAlign: "center", backgroundColor: "white", borderRadius: "8px" }}>
            <p style={{ fontSize: "18px", color: "#666" }}>
              Brak odrzuconych decyzji!
            </p>
            <p style={{ marginTop: "10px", color: "#999" }}>
              Wszystkie decyzje są aktywne lub zostały zatwierdzone.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {decisions.map((decision, index) => {
              const isExpanded = expandedDecisions.has(decision.id);

              return (
              <div
                key={decision.id}
                onClick={(e) => {
                  if ((e.target as HTMLElement).tagName === 'BUTTON' || (e.target as HTMLElement).tagName === 'TEXTAREA') {
                    return;
                  }
                  const newExpanded = new Set(expandedDecisions);
                  if (isExpanded) {
                    newExpanded.delete(decision.id);
                  } else {
                    newExpanded.add(decision.id);
                  }
                  setExpandedDecisions(newExpanded);
                }}
                style={{
                  padding: "12px",
                  backgroundColor: "white",
                  borderRadius: "8px",
                  border: "1px solid #ddd",
                  cursor: "pointer",
                  height: isExpanded ? "auto" : "260px",
                  display: "flex",
                  flexDirection: "column"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1 }}>
                    <span style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: "24px",
                      height: "24px",
                      backgroundColor: "#2196f3",
                      color: "white",
                      borderRadius: "50%",
                      fontSize: "12px",
                      fontWeight: 600,
                      flexShrink: 0
                    }}>
                      {index + 1}
                    </span>
                    <div style={{ flex: 1 }}>
                      <h3 style={{ margin: 0, marginBottom: "4px", fontSize: "15px" }}>
                        {decision.lead.firstName} {decision.lead.lastName} ({decision.lead.email})
                      </h3>
                      <p style={{ margin: 0, color: "#666", fontSize: "12px" }}>
                        {decision.lead.company && `${decision.lead.company} • `}
                        Pewność AI: {(decision.aiConfidence * 100).toFixed(0)}%
                        {(decision.reply?.receivedAt || decision.reply?.createdAt) && (
                          <> • Otrzymano: {new Date(decision.reply.receivedAt || decision.reply.createdAt).toLocaleString('pl-PL', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}</>
                        )}
                      </p>
                    </div>
                  </div>
                </div>

                <div style={{
                  marginBottom: "8px",
                  padding: "8px",
                  backgroundColor: "#f8f9fa",
                  borderRadius: "4px",
                  flex: 1,
                  overflow: isExpanded ? "visible" : "hidden"
                }}>
                  <strong style={{ display: "block", marginBottom: "4px", fontSize: "12px" }}>Odpowiedź leada:</strong>
                  <p style={{
                    margin: 0,
                    whiteSpace: "pre-wrap",
                    fontSize: "13px",
                    lineHeight: "1.4",
                    maxHeight: isExpanded ? "none" : "180px",
                    overflow: isExpanded ? "visible" : "hidden"
                  }}>
                    {decision.leadResponse}
                  </p>
                </div>

                <div style={{
                  marginTop: "auto",
                  display: "flex",
                  gap: "6px",
                  flexWrap: "wrap",
                  paddingTop: "8px",
                  borderTop: "1px solid #eee"
                }}
                onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => handleShowPreview(decision)}
                    style={{
                      padding: "6px 12px",
                      backgroundColor: "#2196f3",
                      color: "white",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                      fontWeight: 600,
                      fontSize: "12px"
                    }}
                  >
                    Podgląd
                  </button>
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (!confirm("Czy na pewno chcesz wysłać testowy email na adres bartosz.kosiba@kreativia.pl?")) {
                        return;
                      }
                      setSendingTest(true);
                      try {
                        const response = await fetch(`/api/material-decisions/${decision.id}/send-test`, {
                          method: "POST"
                        });
                        const data = await response.json();
                        
                        if (data.success) {
                          alert(`✓ Testowy email został wysłany na adres bartosz.kosiba@kreativia.pl`);
                        } else {
                          alert(`Błąd: ${data.error}`);
                        }
                      } catch (error: any) {
                        console.error("Błąd wysyłki testowej:", error);
                        alert(`Błąd wysyłki testowej: ${error.message}`);
                      } finally {
                        setSendingTest(false);
                      }
                    }}
                    disabled={sendingTest}
                    style={{
                      padding: "6px 12px",
                      backgroundColor: sendingTest ? "#ccc" : "#2196f3",
                      color: "white",
                      border: "none",
                      borderRadius: "4px",
                      cursor: sendingTest ? "not-allowed" : "pointer",
                      fontWeight: 600,
                      fontSize: "12px"
                    }}
                  >
                    {sendingTest ? "Wysyłanie..." : "Test"}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!confirm("Czy na pewno chcesz przywrócić tę decyzję do kolejki oczekujących?")) {
                        return;
                      }
                      handleRestoreDecision(decision.id);
                    }}
                    disabled={processing === decision.id}
                    style={{
                      padding: "6px 12px",
                      backgroundColor: processing === decision.id ? "#ccc" : "#28a745",
                      color: "white",
                      border: "none",
                      borderRadius: "4px",
                      cursor: processing === decision.id ? "not-allowed" : "pointer",
                      fontWeight: 600,
                      fontSize: "12px"
                    }}
                  >
                    {processing === decision.id ? "Przetwarzanie..." : "Powrót"}
                  </button>
                </div>

                {isExpanded && (
                  <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid #eee" }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <label style={{ display: "block", marginBottom: "6px", fontWeight: 600, fontSize: "13px" }}>
                      Notatka (opcjonalnie):
                    </label>
                    <textarea
                      value={decisionNote[decision.id] || ""}
                      onChange={(e) => setDecisionNote({ ...decisionNote, [decision.id]: e.target.value })}
                      placeholder="Dodaj notatkę do tej decyzji..."
                      style={{
                        width: "100%",
                        minHeight: "60px",
                        padding: "8px",
                        border: "1px solid #ddd",
                        borderRadius: "4px",
                        fontSize: "13px",
                        fontFamily: "inherit"
                      }}
                    />
                  </div>
                )}
              </div>
              );
            })}
          </div>
        )
      ) : (showOnlyPending || (!showOnlyHistory && !showHistory)) ? (
        // ZAKŁADKA: Oczekujące decyzje
        decisions.length === 0 ? (
          <div style={{ padding: "40px", textAlign: "center", backgroundColor: "white", borderRadius: "8px" }}>
            <p style={{ fontSize: "18px", color: "#666" }}>
              Brak oczekujących decyzji!
            </p>
            <p style={{ marginTop: "10px", color: "#999" }}>
              Wszystkie prośby o materiały zostały przetworzone.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {decisions.map((decision, index) => {
              const isExpanded = expandedDecisions.has(decision.id);

              return (
              <div
                key={decision.id}
                onClick={(e) => {
                  // Nie rozwijaj jeśli kliknięto w przycisk lub textarea
                  if ((e.target as HTMLElement).tagName === 'BUTTON' || (e.target as HTMLElement).tagName === 'TEXTAREA') {
                    return;
                  }
                  const newExpanded = new Set(expandedDecisions);
                  if (isExpanded) {
                    newExpanded.delete(decision.id);
                  } else {
                    newExpanded.add(decision.id);
                  }
                  setExpandedDecisions(newExpanded);
                }}
                style={{
                  padding: "12px",
                  backgroundColor: "white",
                  borderRadius: "8px",
                  border: "1px solid #ddd",
                  cursor: "pointer",
                  height: isExpanded ? "auto" : "260px",
                  display: "flex",
                  flexDirection: "column"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1 }}>
                    <span style={{ 
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: "24px",
                      height: "24px",
                      backgroundColor: "#2196f3",
                      color: "white",
                      borderRadius: "50%",
                      fontSize: "12px",
                      fontWeight: 600,
                      flexShrink: 0
                    }}>
                      {index + 1}
                    </span>
                    <div style={{ flex: 1 }}>
                      <h3 style={{ margin: 0, marginBottom: "4px", fontSize: "15px" }}>
                        {decision.lead.firstName} {decision.lead.lastName} ({decision.lead.email})
                      </h3>
                      <p style={{ margin: 0, color: "#666", fontSize: "12px" }}>
                        {decision.lead.company && `${decision.lead.company} • `}
                        Pewność AI: {(decision.aiConfidence * 100).toFixed(0)}%
                        {(decision.reply?.receivedAt || decision.reply?.createdAt) && (
                          <> • Otrzymano: {new Date(decision.reply.receivedAt || decision.reply.createdAt).toLocaleString('pl-PL', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}</>
                        )}
                      </p>
                    </div>
                  </div>
                </div>

                <div style={{ 
                  marginBottom: "8px", 
                  padding: "8px", 
                  backgroundColor: "#f8f9fa", 
                  borderRadius: "4px",
                  flex: 1,
                  overflow: isExpanded ? "visible" : "hidden"
                }}>
                  <strong style={{ display: "block", marginBottom: "4px", fontSize: "12px" }}>Odpowiedź leada:</strong>
                  <p style={{ 
                    margin: 0, 
                    whiteSpace: "pre-wrap", 
                    fontSize: "13px", 
                    lineHeight: "1.4",
                    maxHeight: isExpanded ? "none" : "180px",
                    overflow: isExpanded ? "visible" : "hidden"
                  }}>
                    {decision.leadResponse}
                  </p>
                </div>

                <div style={{ 
                  marginTop: "auto",
                  display: "flex", 
                  gap: "6px", 
                  flexWrap: "wrap",
                  paddingTop: "8px",
                  borderTop: "1px solid #eee"
                }}
                onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => handleShowPreview(decision)}
                    style={{
                      padding: "6px 12px",
                      backgroundColor: "#2196f3",
                      color: "white",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                      fontWeight: 600,
                      fontSize: "12px"
                    }}
                  >
                    Podgląd
                  </button>
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (!confirm("Czy na pewno chcesz wysłać testowy email na adres bartosz.kosiba@kreativia.pl?")) {
                        return;
                      }
                      setSendingTest(true);
                      try {
                        const response = await fetch(`/api/material-decisions/${decision.id}/send-test`, {
                          method: "POST"
                        });
                        const data = await response.json();
                        
                        if (data.success) {
                          alert(`✓ Testowy email został wysłany na adres bartosz.kosiba@kreativia.pl`);
                        } else {
                          alert(`Błąd: ${data.error}`);
                        }
                      } catch (error: any) {
                        console.error("Błąd wysyłki testowej:", error);
                        alert(`Błąd wysyłki testowej: ${error.message}`);
                      } finally {
                        setSendingTest(false);
                      }
                    }}
                    disabled={sendingTest}
                    style={{
                      padding: "6px 12px",
                      backgroundColor: sendingTest ? "#ccc" : "#2196f3",
                      color: "white",
                      border: "none",
                      borderRadius: "4px",
                      cursor: sendingTest ? "not-allowed" : "pointer",
                      fontWeight: 600,
                      fontSize: "12px"
                    }}
                  >
                    {sendingTest ? "Wysyłanie..." : "Test"}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDecision(decision.id, "APPROVED");
                    }}
                    disabled={processing === decision.id}
                    style={{
                      padding: "6px 12px",
                      backgroundColor: processing === decision.id ? "#ccc" : "#4caf50",
                      color: "white",
                      border: "none",
                      borderRadius: "4px",
                      cursor: processing === decision.id ? "not-allowed" : "pointer",
                      fontWeight: 600,
                      fontSize: "12px"
                    }}
                  >
                    {processing === decision.id ? "Przetwarzanie..." : "Zatwierdź"}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDecision(decision.id, "REJECTED");
                    }}
                    disabled={processing === decision.id}
                    style={{
                      padding: "6px 12px",
                      backgroundColor: processing === decision.id ? "#ccc" : "#f44336",
                      color: "white",
                      border: "none",
                      borderRadius: "4px",
                      cursor: processing === decision.id ? "not-allowed" : "pointer",
                      fontWeight: 600,
                      fontSize: "12px"
                    }}
                  >
                    {processing === decision.id ? "Przetwarzanie..." : "Odrzuć"}
                  </button>
                </div>

                {isExpanded && (
                  <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid #eee" }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <label style={{ display: "block", marginBottom: "6px", fontWeight: 600, fontSize: "13px" }}>
                      Notatka (opcjonalnie):
                    </label>
                    <textarea
                      value={decisionNote[decision.id] || ""}
                      onChange={(e) => setDecisionNote({ ...decisionNote, [decision.id]: e.target.value })}
                      placeholder="Dodaj notatkę do tej decyzji..."
                      style={{
                        width: "100%",
                        minHeight: "60px",
                        padding: "8px",
                        border: "1px solid #ddd",
                        borderRadius: "4px",
                        fontSize: "13px",
                        fontFamily: "inherit"
                      }}
                    />
                  </div>
                )}
              </div>
              );
            })}
          </div>
        )
      ) : null}
      
      {(showOnlyHistory || showHistory) && (
        // ZAKŁADKA: Historia wysłanych
        sentMaterialResponses.length === 0 ? (
          <div style={{ padding: "40px", textAlign: "center", backgroundColor: "white", borderRadius: "8px" }}>
            <p style={{ fontSize: "18px", color: "#666" }}>
              Brak wysłanych odpowiedzi!
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {sentMaterialResponses.map((response) => (
              <div
                key={response.id}
                onClick={() => handleResponseClick(response)}
                style={{
                  padding: "20px",
                  backgroundColor: "white",
                  borderRadius: "8px",
                  border: "1px solid #4caf50",
                  cursor: "pointer"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "15px" }}>
                  <div>
                    <h3 style={{ margin: 0, marginBottom: "8px" }}>
                      {response.lead.firstName} {response.lead.lastName} ({response.lead.email})
                    </h3>
                    <p style={{ margin: 0, color: "#666", fontSize: "14px" }}>
                      {response.lead.company && `${response.lead.company} • `}
                      Wysłano: {response.sentAt ? new Date(response.sentAt).toLocaleString('pl-PL') : 'N/A'}
                    </p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{
                      padding: "6px 12px",
                      backgroundColor: "#4caf50",
                      color: "white",
                      borderRadius: "4px",
                      fontSize: "12px",
                      fontWeight: 600,
                      display: "inline-block"
                    }}>
                      Wysłano
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Modal z podglądem decyzji lub historii */}
      {(selectedDecision || selectedMaterialResponse || decisionPreviewData) && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "20px"
          }}
          onClick={handleCloseDecisionPreview}
        >
          <div
            style={{
              backgroundColor: "white",
              borderRadius: "8px",
              maxWidth: "800px",
              width: "100%",
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 4px 20px rgba(0,0,0,0.3)"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header - stały */}
            <div style={{ padding: "30px 30px 20px 30px", borderBottom: "1px solid #eee" }}>
              <h2 style={{ marginTop: 0, marginBottom: 0 }}>
                Podgląd odpowiedzi - {selectedDecision ? `${selectedDecision.lead.firstName} ${selectedDecision.lead.lastName}` : selectedMaterialResponse ? `${selectedMaterialResponse.lead.firstName} ${selectedMaterialResponse.lead.lastName}` : 'Historia'}
              </h2>
            </div>

            {/* Content - przewijalny */}
            <div style={{ 
              padding: "30px", 
              overflowY: "auto", 
              overflowX: "hidden",
              flex: 1,
              minHeight: 0
            }}>
              {loadingDecisionPreview ? (
                <div style={{ textAlign: "center", padding: "40px" }}>
                  <p>Ładowanie podglądu...</p>
                </div>
              ) : decisionPreviewData ? (
                <>
                  <div style={{ marginBottom: "20px" }}>
                    <label style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}>Temat:</label>
                    <div style={{ padding: "12px", border: "1px solid #ddd", borderRadius: "4px", backgroundColor: "#fafafa" }}>
                      {decisionPreviewData.subject}
                    </div>
                  </div>

                  <div style={{ marginBottom: "20px" }}>
                    <label style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}>Treść odpowiedzi:</label>
                    <div style={{ 
                      padding: "15px", 
                      border: "1px solid #ddd", 
                      borderRadius: "4px", 
                      backgroundColor: "#fafafa", 
                      maxHeight: "500px",
                      overflowY: "auto",
                      overflowX: "hidden",
                      wordWrap: "break-word",
                      fontSize: "14px",
                      lineHeight: "1.6",
                      fontFamily: "Arial, sans-serif",
                      color: "#333"
                    }}
                    dangerouslySetInnerHTML={{ 
                      __html: formatEmailContent(decisionPreviewData.content)
                    }}
                    />
                  </div>

                {/* Materiały */}
                {decisionPreviewData.materials.length > 0 && (
                  <div style={{ marginBottom: "20px" }}>
                    <label style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}>Materiały:</label>
                    <div style={{ padding: "15px", border: "1px solid #ddd", borderRadius: "4px", backgroundColor: "#fafafa" }}>
                      {decisionPreviewData.materials.map((mat, idx) => (
                        <div key={idx} style={{ marginBottom: "10px", padding: "10px", backgroundColor: "white", borderRadius: "4px" }}>
                          <strong>{mat.name}</strong> ({mat.type === "LINK" ? "Link" : "Załącznik"})
                          {mat.type === "LINK" && mat.url && (
                            <div style={{ marginTop: "5px" }}>
                              <a href={mat.url} target="_blank" rel="noopener noreferrer" style={{ color: "#2196f3" }}>
                                {mat.url}
                              </a>
                            </div>
                          )}
                          {mat.type === "ATTACHMENT" && mat.fileName && (
                            <div style={{ marginTop: "5px", fontSize: "13px", color: "#666" }}>
                              Plik: {mat.fileName}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div style={{ textAlign: "center", padding: "40px" }}>
                <p>Nie można załadować podglądu.</p>
              </div>
            )}
            </div>

            {/* Footer - stały, poza przewijalnym obszarem */}
            <div style={{ 
              padding: "20px 30px", 
              borderTop: "1px solid #eee",
              display: "flex",
              gap: "10px",
              justifyContent: "flex-end",
              flexWrap: "wrap"
            }}>
              {selectedDecision ? (
                <>
                  <button
                    onClick={handleRefreshPreview}
                    disabled={refreshingPreview}
                    style={{
                      padding: "10px 20px",
                      backgroundColor: refreshingPreview ? "#ccc" : "#ff9800",
                      color: "white",
                      border: "none",
                      borderRadius: "6px",
                      cursor: refreshingPreview ? "not-allowed" : "pointer",
                      fontWeight: 600,
                      fontSize: "14px"
                    }}
                  >
                    {refreshingPreview ? "Odświeżanie..." : "🔄 Odśwież odpowiedź"}
                  </button>
                  <button
                    onClick={handleSendTest}
                    disabled={sendingTest}
                    style={{
                      padding: "10px 20px",
                      backgroundColor: sendingTest ? "#ccc" : "#2196f3",
                      color: "white",
                      border: "none",
                      borderRadius: "6px",
                      cursor: sendingTest ? "not-allowed" : "pointer",
                      fontWeight: 600,
                      fontSize: "14px"
                    }}
                  >
                    {sendingTest ? "Wysyłanie..." : "📧 Wyślij testowy email"}
                  </button>
                  <button
                    onClick={() => {
                      handleCloseDecisionPreview();
                      handleDecision(selectedDecision.id, "APPROVED");
                    }}
                    style={{
                      padding: "10px 20px",
                      backgroundColor: "#4caf50",
                      color: "white",
                      border: "none",
                      borderRadius: "6px",
                      cursor: "pointer",
                      fontWeight: 600,
                      fontSize: "14px"
                    }}
                  >
                    Zatwierdź i wyślij
                  </button>
                </>
              ) : selectedMaterialResponse ? (
                <button
                  onClick={() => handleRestoreMaterialResponse(selectedMaterialResponse.id)}
                  disabled={restoringResponse}
                  style={{
                    padding: "10px 20px",
                    backgroundColor: restoringResponse ? "#ccc" : "#ff9800",
                    color: "white",
                    border: "none",
                    borderRadius: "6px",
                    cursor: restoringResponse ? "not-allowed" : "pointer",
                    fontWeight: 600,
                    fontSize: "14px"
                  }}
                >
                  {restoringResponse ? "Przywracanie..." : "🔄 Przywróć do oczekujących"}
                </button>
              ) : null}
              <button
                onClick={() => {
                  setSelectedDecision(null);
                  setSelectedMaterialResponse(null);
                  setDecisionPreviewData(null);
                }}
                style={{
                  padding: "10px 20px",
                  backgroundColor: "#666",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: "14px"
                }}
              >
                Zamknij
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

