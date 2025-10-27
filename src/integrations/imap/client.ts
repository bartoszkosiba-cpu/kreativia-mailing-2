// IMAP Client do pobierania maili
// Wymaga zainstalowania: npm install imap mailparser

import Imap from "imap";
import { simpleParser } from "mailparser";

function getEnv(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

export interface ImapConfig {
  imapHost: string;
  imapPort: number;
  imapUser: string;
  imapPass: string;
  imapSecure: boolean;
  createdAt?: Date; // Opcjonalna data od której pobierać maile (np. data utworzenia skrzynki)
}

export interface ParsedEmail {
  messageId: string;
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string | false;
  date: Date;
  inReplyTo?: string;
  references?: string[];
  threadId?: string;
}

export function createImapConnection(config?: ImapConfig): Imap {
  // Użyj danych z handlowca jeśli są dostępne, w przeciwnym razie fallback na .env
  const host = config?.imapHost || getEnv("IMAP_HOST", getEnv("SMTP_HOST"));
  const port = config?.imapPort || Number(getEnv("IMAP_PORT", "993"));
  const user = config?.imapUser || getEnv("IMAP_USER", getEnv("SMTP_USER"));
  const password = config?.imapPass || getEnv("IMAP_PASS", getEnv("SMTP_PASS"));
  const tls = config?.imapSecure !== null && config?.imapSecure !== undefined 
    ? config.imapSecure 
    : (getEnv("IMAP_TLS", "true").toLowerCase() === "true");

  console.log(`[IMAP] Tworzę połączenie: ${host}:${port} (tls: ${tls}, user: ${user})`);

  return new Imap({
    user,
    password,
    host,
    port,
    tls,
    tlsOptions: { rejectUnauthorized: false }, // Dla diagnostyki
    connTimeout: 15000,
    authTimeout: 15000,
  });
}

/**
 * Pobiera nowe (nieodczytane) maile ze skrzynki INBOX
 */
export async function fetchUnreadEmails(config?: ImapConfig): Promise<ParsedEmail[]> {
  return new Promise(async (resolve, reject) => {
    const imap = createImapConnection(config);
    const emails: ParsedEmail[] = [];
    let fetchCompleted = false;

    // Użyj createdAt z config jeśli podane, w przeciwnym razie ostatnie 15 minut (zamiast 2 dni)
    let sinceDate: Date;
    let filterByDate = false;
    
    if (config?.createdAt) {
      sinceDate = config.createdAt;
      filterByDate = true; // Zapamiętaj że musimy filtrować po dacie i godzinie
      console.log(`[IMAP] Używam daty utworzenia skrzynki: ${sinceDate.toISOString()}`);
    } else {
      sinceDate = new Date();
      sinceDate.setMinutes(sinceDate.getMinutes() - 15); // Ostatnie 15 minut
      console.log(`[IMAP] Używam ostatnich 15 minut: ${sinceDate.toISOString()}`);
    }

    const dateStr = sinceDate.toISOString().split('T')[0].replace(/-/g, '-');
    // ZAPAMIĘTAJ sinceDate dla filtrowania w kodzie (bo SINCE działa tylko na dzień, nie godziny)
    const filterDate = filterByDate ? sinceDate : null;

    imap.once("ready", () => {
      console.log("[IMAP] Połączono, otwieranie skrzynki...");
      imap.openBox("INBOX", false, (err, box) => {
        if (err) {
          console.error("[IMAP] Błąd otwierania skrzynki:", err);
          imap.end();
          return reject(err);
        }

        console.log("[IMAP] Skrzynka otwarta, szukanie maili...");
        
        // Szukaj WSZYSTKICH maili z ostatnich 2 dni (duplikaty są filtrowane przez messageId w procesorze)
        imap.search([["SINCE", dateStr]], (err, results) => {
          if (err) {
            console.error("[IMAP] Błąd wyszukiwania maili:", err);
            imap.end();
            return reject(err);
          }

          console.log(`[IMAP] Znaleziono ${results?.length || 0} nieodczytanych maili`);

          if (!results || results.length === 0) {
            imap.end();
            return resolve([]);
          }

          const fetch = imap.fetch(results, { bodies: "", markSeen: false }); // Nie oznaczaj - duplikaty są filtrowane przez messageId
          let processedCount = 0;

          fetch.on("message", (msg, seqno) => {
            console.log(`[IMAP] Pobieram mail ${seqno}...`);
            let buffer = "";
            
            msg.on("body", (stream, info) => {
              stream.on("data", (chunk) => {
                buffer += chunk.toString("utf8");
              });
              
              stream.once("end", () => {
                simpleParser(buffer, (err, parsed) => {
                  if (err) {
                    console.error(`[IMAP] Błąd parsowania maila ${seqno}:`, err);
                    processedCount++;
                    return;
                  }

                  console.log(`[IMAP] ✓ Sparsowano mail ${seqno}: ${parsed.subject}`);
                  
                  emails.push({
                    messageId: parsed.messageId || `unknown-${seqno}`,
                    from: Array.isArray(parsed.from) ? parsed.from[0]?.value?.[0]?.address || "" : parsed.from?.value?.[0]?.address || "",
                    to: Array.isArray(parsed.to) ? parsed.to[0]?.value?.[0]?.address || "" : parsed.to?.value?.[0]?.address || "",
                    subject: parsed.subject || "(brak tematu)",
                    text: parsed.text || "",
                    html: parsed.html || false,
                    date: parsed.date || new Date(),
                    inReplyTo: parsed.inReplyTo,
                    references: Array.isArray(parsed.references) ? parsed.references : (parsed.references ? [parsed.references] : []),
                  });
                  
                  processedCount++;
                });
              });
            });
          });

          fetch.once("error", (err) => {
            console.error("[IMAP] Błąd fetch:", err);
            if (!fetchCompleted) {
              fetchCompleted = true;
              imap.end();
              reject(err);
            }
          });

          fetch.once("end", () => {
            console.log(`[IMAP] Fetch zakończony, przetworzono ${processedCount}/${results.length} maili`);
            
            // Poczekaj chwilę na parsowanie wszystkich maili
            setTimeout(() => {
              console.log(`[IMAP] Timeout zakończony, pobrano ${emails.length} maili`);
              
              // NOWE: Filtruj maile po dacie createdAt (jeśli podane)
              let filteredEmails = emails;
              if (filterDate && emails.length > 0) {
                const beforeFilter = emails.length;
                filteredEmails = emails.filter(email => {
                  const emailDate = new Date(email.date);
                  const isAfterCreated = emailDate >= filterDate;
                  if (!isAfterCreated) {
                    console.log(`[IMAP] 🔒 Odfiltrowano stary mail z ${emailDate.toISOString()} (przed ${filterDate.toISOString()})`);
                  }
                  return isAfterCreated;
                });
                console.log(`[IMAP] 📊 Filtrowanie: ${beforeFilter} maili -> ${filteredEmails.length} maili (po createdAt)`);
              }
              
              if (!fetchCompleted) {
                fetchCompleted = true;
                console.log(`[IMAP] Rozwiązuję Promise z ${filteredEmails.length} mailami`);
                imap.end();
                resolve(filteredEmails); // RESOLVE TUTAJ!
              }
            }, 2000);
          });
        });
      });
    });

    imap.once("error", (err: Error) => {
      console.error("[IMAP] Błąd połączenia:", err);
      if (!fetchCompleted) {
        fetchCompleted = true;
        reject(err);
      }
    });

    imap.once("end", () => {
      console.log(`[IMAP] Połączenie zakończone, zwracam ${emails.length} maili`);
      if (!fetchCompleted) {
        // NOWE: Filtruj maile po dacie createdAt (jeśli podane)
        let filteredEmails = emails;
        if (filterDate && emails.length > 0) {
          filteredEmails = emails.filter(email => {
            const emailDate = new Date(email.date);
            return emailDate >= filterDate;
          });
          console.log(`[IMAP] 📊 Filtrowanie END: ${emails.length} maili -> ${filteredEmails.length} maili (po createdAt)`);
        }
        fetchCompleted = true;
        resolve(filteredEmails);
      }
    });

    console.log("[IMAP] Łączę się...");
    imap.connect();
  });
}

/**
 * Sprawdza połączenie IMAP
 */
export async function testImapConnection(): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const imap = createImapConnection();

    imap.once("ready", () => {
      imap.end();
      resolve(true);
    });

    imap.once("error", (err: Error) => {
      reject(err);
    });

    imap.connect();
  });
}

/**
 * Oznacza wszystkie maile jako przeczytane (SEEN)
 * Używane podczas resetu bazy danych
 */
export async function markAllEmailsAsSeen(config?: ImapConfig): Promise<{ marked: number }> {
  return new Promise((resolve, reject) => {
    const imap = createImapConnection(config);
    let markedCount = 0;

    imap.once("ready", () => {
      console.log("[IMAP] Połączono, otwieranie skrzynki...");
      imap.openBox("INBOX", false, (err, box) => {
        if (err) {
          imap.end();
          return reject(err);
        }

        console.log("[IMAP] Skrzynka otwarta, oznaczam wszystkie maile jako przeczytane...");
        
        // Znajdź wszystkie nieodczytane maile
        imap.search(["UNSEEN"], (err, results) => {
          if (err) {
            imap.end();
            return reject(err);
          }

          if (!results || results.length === 0) {
            console.log("[IMAP] Brak nieodczytanych maili do oznaczenia");
            imap.end();
            return resolve({ marked: 0 });
          }

          markedCount = results.length;
          console.log(`[IMAP] Znaleziono ${markedCount} nieodczytanych maili, oznaczam jako SEEN...`);

          // Oznacz wszystkie jako przeczytane
          imap.addFlags(results, ["\\Seen"], (err) => {
            if (err) {
              imap.end();
              return reject(err);
            }

            console.log(`[IMAP] ✓ Oznaczono ${markedCount} maili jako przeczytane`);
            imap.end();
            resolve({ marked: markedCount });
          });
        });
      });
    });

    imap.once("error", (err: Error) => {
      console.error("[IMAP] Błąd połączenia:", err);
      reject(err);
    });

    imap.connect();
  });
}

