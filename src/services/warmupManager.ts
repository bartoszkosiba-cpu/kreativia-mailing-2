/**
 * WARMUP MANAGER - API Helper Layer
 * 
 * Dostarcza funkcje pomocnicze dla API endpoints:
 * - getWarmupStats() - statystyki dla UI dashboard
 * - checkDNSSetup() - weryfikacja DNS
 * - startWarmup() / stopWarmup() - zarządzanie statusem
 * 
 * Współpracuje z NOWYM systemem warmup (warmup/*)
 */

import { db } from '@/lib/db';
import { getWarmupConfig } from './warmup/config';
import { promisify } from 'util';
import * as dns from 'dns';

const dnsResolve = promisify(dns.resolve);
const dnsResolveTxt = promisify(dns.resolveTxt);

export class WarmupManager {
  /**
   * Sprawdza czy skrzynka może wysłać warmup email
   */
  static async canSendWarmupEmail(mailboxId: number): Promise<boolean> {
    const mailbox = await db.mailbox.findUnique({
      where: { id: mailboxId }
    });

    if (!mailbox || mailbox.warmupStatus !== 'warming') {
      return false;
    }

    const config = getWarmupConfig(mailbox.warmupDay);
    if (!config) {
      return false;
    }

    return mailbox.warmupTodaySent < config.dailyLimit;
  }

  /**
   * Pobiera limit warmup dla skrzynki
   */
  static async getWarmupLimit(mailboxId: number): Promise<number> {
    const mailbox = await db.mailbox.findUnique({
      where: { id: mailboxId }
    });

    if (!mailbox) {
      return 0;
    }

    const config = getWarmupConfig(mailbox.warmupDay);
    return config?.dailyLimit || 0;
  }

  /**
   * Pobiera statystyki warmup dla skrzynki
   */
  static async getWarmupStats(mailboxId: number): Promise<any> {
    const mailbox = await db.mailbox.findUnique({
      where: { id: mailboxId }
    });

    if (!mailbox) {
      return {
        warmupDay: 1,
        dailyLimit: 0,
        todaySent: 0,
        progress: 0,
        status: 'inactive',
        dns: { spf: 'pending', dkim: 'pending', dmarc: 'pending' },
        emails: {
          total: 0,
          sent: 0,
          failed: 0,
          bounced: 0,
          byType: {
            internal: 0,
            test: 0,
            campaign: 0
          }
        }
      };
    }

    const config = getWarmupConfig(mailbox.warmupDay);
    const dailyLimit = config?.dailyLimit || 0;
    const progress = dailyLimit > 0 ? Math.round((mailbox.warmupTodaySent / dailyLimit) * 100) : 0;

    // Pobierz statystyki emaili Z DZISIEJSZEGO DNIA WARMUP
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayEmails = await db.warmupEmail.findMany({
      where: { 
        mailboxId: mailboxId,
        createdAt: {
          gte: today,
          lt: tomorrow
        }
      },
      select: {
        type: true,
        status: true
      }
    });

    const emails = {
      total: todayEmails.length,
      sent: todayEmails.filter(e => e.status === 'sent').length,
      failed: todayEmails.filter(e => e.status === 'failed').length,
      bounced: todayEmails.filter(e => e.status === 'bounced').length,
      byType: {
        internal: todayEmails.filter(e => e.type === 'internal').length,
        test: todayEmails.filter(e => e.type === 'test').length,
        campaign: todayEmails.filter(e => e.type === 'campaign').length
      }
    };

    return {
      warmupDay: mailbox.warmupDay,
      dailyLimit: dailyLimit,
      todaySent: mailbox.warmupTodaySent,
      progress: progress,
      status: mailbox.warmupStatus,
      dns: { 
        spf: 'pending', 
        dkim: 'pending', 
        dmarc: 'pending' 
      },
      emails
    };
  }

  /**
   * Rozpoczyna warmup dla skrzynki
   */
  static async startWarmup(mailboxId: number): Promise<boolean> {
    try {
      // 1. Zaktualizuj status skrzynki
      await db.mailbox.update({
        where: { id: mailboxId },
        data: {
          warmupStatus: 'warming',
          warmupDay: 1,
          warmupDailyLimit: 15,
          warmupTodaySent: 0
        }
      });

      // 2. OD RAZU zaplanuj maile na dzisiaj
      const { scheduleDailyEmailsForMailbox } = await import('./warmup/scheduler');
      await scheduleDailyEmailsForMailbox(mailboxId);
      
      console.log(`[WARMUP MANAGER] ✅ Rozpoczęto warmup dla skrzynki ${mailboxId} - maile zaplanowane na dzisiaj`);
      return true;
    } catch (error) {
      console.error('Błąd rozpoczęcia warmup:', error);
      return false;
    }
  }

  /**
   * Zatrzymuje warmup dla skrzynki
   */
  static async stopWarmup(mailboxId: number): Promise<boolean> {
    try {
      await db.mailbox.update({
        where: { id: mailboxId },
        data: {
          warmupStatus: 'inactive',
          warmupDay: 0,
          warmupDailyLimit: 0,
          warmupTodaySent: 0
        }
      });
      return true;
    } catch (error) {
      console.error('Błąd zatrzymania warmup:', error);
      return false;
    }
  }

  /**
   * Sprawdza konfigurację DNS
   */
  static async checkDNSSetup(mailboxId: number): Promise<boolean> {
    try {
      const mailbox = await db.mailbox.findUnique({
        where: { id: mailboxId }
      });

      if (!mailbox) {
        console.log(`[DNS CHECK] ❌ Skrzynka ${mailboxId} nie istnieje`);
        return false;
      }

      console.log(`[DNS CHECK] 🔍 Sprawdzam DNS dla ${mailbox.email}`);
      
      const domain = mailbox.email.split('@')[1];
      console.log(`[DNS CHECK] 📧 Domena: ${domain}`);

      // Sprawdź rekordy DNS
      const dnsResults = await this.checkDNSRecords(domain);
      
      console.log(`[DNS CHECK] 📊 Wyniki:`);
      console.log(`  MX: ${dnsResults.mx ? '✅' : '❌'}`);
      console.log(`  SPF: ${dnsResults.spf ? '✅' : '❌'}`);
      console.log(`  DKIM: ${dnsResults.dkim ? '✅' : '❌'}`);
      console.log(`  DMARC: ${dnsResults.dmarc ? '✅' : '❌'}`);

      // DNS jest OK jeśli ma MX i przynajmniej jeden z rekordów bezpieczeństwa
      const dnsOk = dnsResults.mx && (dnsResults.spf || dnsResults.dkim || dnsResults.dmarc);

          await db.mailbox.update({
            where: { id: mailboxId },
            data: {
              dnsSetupCompleted: dnsOk,
              dnsLastCheckedAt: new Date(),
              mxRecordStatus: dnsResults.mx ? 'configured' : 'missing',
              spfRecordStatus: dnsResults.spf ? 'configured' : 'missing',
              dkimRecordStatus: dnsResults.dkim ? 'configured' : 'missing',
              dmarcRecordStatus: dnsResults.dmarc ? 'configured' : 'missing'
            }
          });

      console.log(`[DNS CHECK] ${dnsOk ? '✅' : '❌'} DNS dla ${mailbox.email} - ${dnsOk ? 'OK' : 'BŁĄD'}`);
      return dnsOk;
    } catch (error) {
      console.error('[DNS CHECK] ❌ Błąd podczas sprawdzania DNS:', error);
      return false;
    }
  }

  /**
   * Sprawdza konkretne rekordy DNS dla domeny
   */
  private static async checkDNSRecords(domain: string): Promise<{
    mx: boolean;
    spf: boolean;
    dkim: boolean;
    dmarc: boolean;
  }> {
    const results = {
      mx: false,
      spf: false,
      dkim: false,
      dmarc: false
    };

    try {
      // Sprawdź rekordy MX
      try {
        const mxRecords = await dnsResolve(domain, 'MX');
        results.mx = mxRecords && mxRecords.length > 0;
        console.log(`[DNS CHECK] MX records: ${mxRecords?.length || 0}`);
      } catch (error) {
        console.log(`[DNS CHECK] MX error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      // Sprawdź rekordy TXT (SPF, DKIM, DMARC)
      try {
        const txtRecords = await dnsResolveTxt(domain);
        console.log(`[DNS CHECK] TXT records found: ${txtRecords?.length || 0}`);
        
        for (const record of txtRecords || []) {
          const txtValue = record.join('').toLowerCase();
          
          // SPF record
          if (txtValue.includes('v=spf1')) {
            results.spf = true;
            console.log(`[DNS CHECK] SPF found: ${txtValue.substring(0, 50)}...`);
          }
          
          // DMARC record
          if (txtValue.includes('v=dmarc1')) {
            results.dmarc = true;
            console.log(`[DNS CHECK] DMARC found: ${txtValue.substring(0, 50)}...`);
          }
          
          // DKIM record (może być w różnych formatach)
          if (txtValue.includes('v=dkim1') || txtValue.includes('k=rsa')) {
            results.dkim = true;
            console.log(`[DNS CHECK] DKIM found: ${txtValue.substring(0, 50)}...`);
          }
        }
      } catch (error) {
        console.log(`[DNS CHECK] TXT error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      // Sprawdź DMARC w poddomenie _dmarc
      if (!results.dmarc) {
        try {
          const dmarcRecords = await dnsResolveTxt(`_dmarc.${domain}`);
          for (const record of dmarcRecords || []) {
            const txtValue = record.join('').toLowerCase();
            if (txtValue.includes('v=dmarc1')) {
              results.dmarc = true;
              console.log(`[DNS CHECK] DMARC found in _dmarc subdomain: ${txtValue.substring(0, 50)}...`);
              break;
            }
          }
        } catch (error) {
          console.log(`[DNS CHECK] DMARC subdomain error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

    } catch (error) {
      console.error(`[DNS CHECK] General DNS error for ${domain}:`, error instanceof Error ? error.message : 'Unknown error');
    }

    return results;
  }
}
