import nodemailer from "nodemailer";

function getEnv(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

interface SmtpConfig {
  smtpHost?: string | null;
  smtpPort?: number | null;
  smtpUser?: string | null;
  smtpPass?: string | null;
  smtpSecure?: boolean | null;
}

export function createSmtpTransport(config?: SmtpConfig) {
  // Użyj danych z handlowca jeśli są dostępne, w przeciwnym razie fallback na .env
  const host = config?.smtpHost || getEnv("SMTP_HOST");
  const port = config?.smtpPort || Number(getEnv("SMTP_PORT"));
  const secure = config?.smtpSecure !== null && config?.smtpSecure !== undefined 
    ? config.smtpSecure 
    : getEnv("SMTP_SECURE").toLowerCase() === "true";
  const user = config?.smtpUser || getEnv("SMTP_USER");
  const pass = config?.smtpPass || getEnv("SMTP_PASS");
  const insecureTls = (process.env.SMTP_TLS_INSECURE ?? "false").toLowerCase() === "true";

  console.log(`[SMTP] Tworzę transport: ${host}:${port} (secure: ${secure}, user: ${user})`);

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    // Ułatwienie diagnostyki na serwerach z nietypowymi certyfikatami
    tls: insecureTls ? { rejectUnauthorized: false } : undefined,
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000
  });
}

export async function sendTestEmail(to: string) {
  const from = getEnv("SMTP_FROM");
  const transport = createSmtpTransport();
  const info = await transport.sendMail({
    from,
    to,
    subject: "Kreativia Mailing – test SMTP",
    text: "To jest test wysyłki SMTP z Kreativia Mailing.",
  });
  return { messageId: info.messageId, accepted: info.accepted };
}

// Funkcja do konwersji **bold**, linków i logo na HTML
function convertToHtml(text: string): string {
  // Najpierw konwertuj logo [LOGO]base64[/LOGO] na <img>
  let html = text.replace(/\[LOGO\](.+?)\[\/LOGO\]/g, '<img src="$1" alt="Company Logo" style="max-width: 112px; margin: 20px 0;" />');
  // Konwertuj linki [LINK]text[/LINK:url] na <a href="url">text</a>
  html = html.replace(/\[LINK\](.+?)\[\/LINK:(.+?)\]/g, '<a href="$2" style="color: #0066cc; text-decoration: underline;">$1</a>');
  // Konwertuj **bold** na <strong>
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  return html;
}

interface VirtualSalesperson {
  name: string;
  email: string;
  phone: string | null;
  language: string;
  smtpHost?: string | null;
  smtpPort?: number | null;
  smtpUser?: string | null;
  smtpPass?: string | null;
  smtpSecure?: boolean | null;
  mainMailbox?: {
    email: string;
    displayName?: string;
  };
}

interface CampaignData {
  jobDescription?: string | null;
  postscript?: string | null;
  linkText?: string | null;
  linkUrl?: string | null;
}

interface CompanySettings {
  address?: string | null;
  logoBase64?: string | null;
  disclaimerPl?: string | null;
  disclaimerEn?: string | null;
  disclaimerDe?: string | null;
  disclaimerFr?: string | null;
  legalFooter?: string | null;
}

interface MailboxConfig {
  id: number;
  email: string;
  displayName?: string | null;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  smtpSecure: boolean;
}

interface CampaignEmailData {
  subject: string;
  content: string;
  leadEmail: string;
  leadName?: string;
  leadCompany?: string;
  leadLanguage?: string; // Język leada (pl, en, de, fr)
  salesperson?: VirtualSalesperson; // Dane handlowca (imię, telefon)
  mailbox?: MailboxConfig; // NOWE: Konkretna skrzynka do wysyłki
  campaign?: CampaignData;
  settings?: CompanySettings;
}

/**
 * Prosta funkcja do wysyłania warmup maili
 */
export async function sendEmail(data: {
  from: string;
  to: string;
  subject: string;
  html: string;
  mailboxId: number;
  type: string;
  metadata?: any;
}) {
  try {
    // Pobierz dane skrzynki
    const { db } = await import('@/lib/db');
    const mailbox = await db.mailbox.findUnique({
      where: { id: data.mailboxId }
    });

    if (!mailbox) {
      throw new Error('Skrzynka nie istnieje');
    }

    // Utwórz transport SMTP
    const smtpConfig: SmtpConfig = {
      smtpHost: mailbox.smtpHost,
      smtpPort: mailbox.smtpPort,
      smtpUser: mailbox.smtpUser,
      smtpPass: mailbox.smtpPass,
      smtpSecure: mailbox.smtpSecure
    };

    const transport = createSmtpTransport(smtpConfig);

    // Wyślij mail
    const result = await transport.sendMail({
      from: data.from,
      to: data.to,
      subject: data.subject,
      html: data.html
    });

    console.log(`[SMTP] ✅ Wysłano warmup mail: ${data.from} -> ${data.to} (${result.messageId})`);

    return {
      success: true,
      messageId: result.messageId
    };
  } catch (error) {
    console.error(`[SMTP] ❌ Błąd wysyłania warmup maila:`, error);
    return {
      success: false,
      error: String(error)
    };
  }
}

export async function sendCampaignEmail(data: CampaignEmailData) {
  // NOWE: Użyj danych SMTP z Mailbox (priorytet) lub fallback na handlowca
  const smtpConfig: SmtpConfig | undefined = data.mailbox ? {
    smtpHost: data.mailbox.smtpHost,
    smtpPort: data.mailbox.smtpPort,
    smtpUser: data.mailbox.smtpUser,
    smtpPass: data.mailbox.smtpPass,
    smtpSecure: data.mailbox.smtpSecure
  } : data.salesperson ? {
    smtpHost: data.salesperson.smtpHost,
    smtpPort: data.salesperson.smtpPort,
    smtpUser: data.salesperson.smtpUser,
    smtpPass: data.salesperson.smtpPass,
    smtpSecure: data.salesperson.smtpSecure
  } : undefined;
  
  const transport = createSmtpTransport(smtpConfig);
  
  // Określ nadawcę - NOWE: Użyj emaila z Mailbox jeśli dostępny
  let fromEmail: string;
  let fromName: string;
  
  if (data.mailbox) {
    fromEmail = data.mailbox.email;
    fromName = data.mailbox.displayName || data.salesperson?.name || "Kreativia";
  } else if (data.salesperson) {
    // Używaj email głównej skrzynki jeśli istnieje, w przeciwnym razie email handlowca
    fromEmail = data.salesperson.mainMailbox?.email || data.salesperson.email;
    fromName = data.salesperson.name;
  } else {
    fromEmail = getEnv("SMTP_FROM");
    fromName = "Kreativia";
  }

  // Przygotuj treść maila
  let emailContent = data.content;
  
  // Buduj pełny podpis zgodnie z strukturą
  let signature = "";
  
  // 1. Podpis handlowca (imię, nazwisko, telefon, email)
  if (data.salesperson) {
    signature += "\n\n**" + data.salesperson.name + "**";
    
    // Dodaj opis stanowiska z kampanii (jeśli istnieje)
    if (data.campaign?.jobDescription) {
      signature += "\n" + data.campaign.jobDescription;
    }
    
    signature += "\n";
    if (data.salesperson.phone) {
      signature += "\nM. " + data.salesperson.phone;
    }
    // Używaj email głównej skrzynki w podpisie
    const signatureEmail = data.salesperson.mainMailbox?.email || data.salesperson.email;
    signature += "\nE. " + signatureEmail;
  }
  
  // 2. Disclaimer wielojęzyczny z ustawień
  if (data.settings) {
    const lang = data.leadLanguage || 'pl';
    let disclaimer = "";
    
    switch (lang) {
      case 'en':
        disclaimer = data.settings.disclaimerEn || "In case of no interest, please let me know – I will not contact you again.";
        break;
      case 'de':
        disclaimer = data.settings.disclaimerDe || "Bei fehlendem Interesse bitte ich um eine Nachricht – ich werde Sie nicht mehr kontaktieren.";
        break;
      case 'fr':
        disclaimer = data.settings.disclaimerFr || "En cas d'absence d'intérêt, veuillez m'en informer – je ne vous contacterai plus.";
        break;
      default: // pl
        disclaimer = data.settings.disclaimerPl || "W razie braku zainteresowania proszę o informację – nie będę się już kontaktować.";
    }
    
    signature += "\n\n" + disclaimer;
  }
  
  // 3. PS. z kampanii (jeśli istnieje)
  if (data.campaign?.postscript) {
    signature += "\n\n**PS.** " + data.campaign.postscript;
  }
  
  // 4. Logo (jeśli istnieje w ustawieniach)
  if (data.settings?.logoBase64) {
    signature += "\n[LOGO]" + data.settings.logoBase64 + "[/LOGO]";
  }
  
  // 5. Adres firmy z ustawień
  if (data.settings?.address) {
    signature += "\n" + data.settings.address;
  } else {
    // Fallback na domyślny adres
    signature += "\n\n";
    signature += "**Showroom & Office & Production:**\n";
    signature += "ul. Bukowska 16\n";
    signature += "62-081 Wysogotowo, PL";
  }
  
  // 6. Link do strony kampanii (jeśli istnieje)
  if (data.campaign?.linkText) {
    // Zawsze wyświetlamy tekst z linkText, ale kierujemy do linkUrl (jeśli istnieje) lub linkText (jeśli nie)
    const displayText = data.campaign.linkText;
    const targetUrl = data.campaign.linkUrl || data.campaign.linkText;
    signature += "\n\n**Visit our site:** [LINK]" + displayText + "[/LINK:" + targetUrl + "]";
  }
  
  // 7. Stopka prawna z ustawień
  if (data.settings?.legalFooter) {
    signature += "\n\n" + data.settings.legalFooter;
  } else {
    // Fallback na domyślną stopkę
    signature += "\n\n";
    signature += "The content of this message is confidential and covered by the NDA. ";
    signature += "The recipient can only be the recipient of the exclusion of third party access. ";
    signature += "If you are not the addressee of this message, or employee is authorized to transfer it to the addressee, ";
    signature += "to announce that its dissemination, copying or distribution is prohibited. ";
    signature += "If you have received this message in error, please notify the sender by sending a reply ";
    signature += "and delete this message with attachments from your mailbox. Thank you. Kreativia.";
  }
  
  emailContent += signature;

  // Wersja tekstowa (usuń **bold**, znaczniki linków i logo)
  let textContent = emailContent.replace(/\*\*(.+?)\*\*/g, '$1');
  textContent = textContent.replace(/\[LINK\](.+?)\[\/LINK:(.+?)\]/g, '$1');
  textContent = textContent.replace(/\[LOGO\].+?\[\/LOGO\]/g, '[Logo firmy]');
  
  // Wersja HTML (konwertuj **bold** i linki, potem \n na <br>)
  const htmlContent = convertToHtml(emailContent).replace(/\n/g, '<br>');

  const info = await transport.sendMail({
    from: `${fromName} <${fromEmail}>`,
    to: data.leadEmail,
    subject: data.subject,
    text: textContent,
    html: htmlContent,
  });

  return { 
    messageId: info.messageId, 
    accepted: info.accepted,
    from: `${fromName} <${fromEmail}>`,
    to: data.leadEmail
  };
}

