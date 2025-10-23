import Imap from 'imap';

interface ImapConfig {
  imapHost: string;
  imapPort: number;
  imapUser: string;
  imapPass: string;
  imapSecure?: boolean;
}

/**
 * Listuje wszystkie foldery w skrzynce IMAP
 */
export async function listImapFolders(config: ImapConfig): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const imap = new Imap({
      user: config.imapUser,
      password: config.imapPass,
      host: config.imapHost,
      port: config.imapPort,
      tls: config.imapSecure ?? true,
      tlsOptions: { rejectUnauthorized: false }
    });

    imap.once('ready', () => {
      console.log('[IMAP] Połączono, pobieram listę folderów...');
      
      imap.getBoxes((err, boxes) => {
        if (err) {
          imap.end();
          return reject(err);
        }

        const folderNames: string[] = [];
        
        function extractFolders(boxes: any, prefix = '') {
          for (const name in boxes) {
            const fullPath = prefix ? `${prefix}/${name}` : name;
            folderNames.push(fullPath);
            
            if (boxes[name].children) {
              extractFolders(boxes[name].children, fullPath);
            }
          }
        }
        
        extractFolders(boxes);
        
        console.log(`[IMAP] Znaleziono ${folderNames.length} folderów`);
        imap.end();
        resolve(folderNames);
      });
    });

    imap.once('error', (err: Error) => {
      console.error('[IMAP] Błąd połączenia:', err);
      reject(err);
    });

    imap.once('end', () => {
      console.log('[IMAP] Połączenie zamknięte');
    });

    imap.connect();
  });
}
