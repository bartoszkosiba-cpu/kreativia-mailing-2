import Imap from 'imap';
import { simpleParser } from 'mailparser';

interface ImapConfig {
  imapHost: string;
  imapPort: number;
  imapUser: string;
  imapPass: string;
  imapSecure?: boolean;
}

export async function checkSpamFolder(config: ImapConfig): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const imap = new Imap({
      user: config.imapUser,
      password: config.imapPass,
      host: config.imapHost,
      port: config.imapPort,
      tls: config.imapSecure ?? true,
      tlsOptions: { rejectUnauthorized: false }
    });

    const emails: any[] = [];

    imap.once('ready', () => {
      console.log('[IMAP SPAM] Połączono, otwieranie folderu SPAM...');
      
      imap.openBox('SPAM', false, (err, box) => {
        if (err) {
          console.error('[IMAP SPAM] Błąd otwierania SPAM:', err);
          imap.end();
          return reject(err);
        }

        console.log('[IMAP SPAM] Folder SPAM otwarty, szukam maili...');
        
        // Szukaj wszystkich maili w SPAM
        imap.search(['ALL'], (err, results) => {
          if (err) {
            console.error('[IMAP SPAM] Błąd wyszukiwania:', err);
            imap.end();
            return reject(err);
          }

          if (!results || results.length === 0) {
            console.log('[IMAP SPAM] Folder SPAM jest pusty');
            imap.end();
            return resolve([]);
          }

          console.log(`[IMAP SPAM] Znaleziono ${results.length} maili w SPAM`);
          
          const fetch = imap.fetch(results, { bodies: '' });
          let processed = 0;

          fetch.on('message', (msg, seqno) => {
            let buffer = '';
            
            msg.on('body', (stream) => {
              stream.on('data', (chunk) => {
                buffer += chunk.toString('utf8');
              });
            });

            msg.once('end', () => {
              simpleParser(buffer).then((parsed) => {
                emails.push({
                  from: parsed.from?.text || '',
                  subject: parsed.subject || '',
                  date: parsed.date,
                  messageId: parsed.messageId
                });
                processed++;
                
                if (processed === results.length) {
                  imap.end();
                }
              });
            });
          });

          fetch.once('end', () => {
            console.log('[IMAP SPAM] Zakończono pobieranie SPAM');
            setTimeout(() => resolve(emails), 1000);
          });
        });
      });
    });

    imap.once('error', (err: Error) => {
      console.error('[IMAP SPAM] Błąd:', err);
      reject(err);
    });

    imap.connect();
  });
}
