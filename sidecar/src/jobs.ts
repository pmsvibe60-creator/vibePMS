import cron from 'node-cron';
import { config } from './config.ts';
import { runMonthlyRent, syncInvoices } from './services/billing.ts';

export const JOBS = {
  monthlyRent: () => runMonthlyRent(),
  syncInvoices: () => syncInvoices(),
};

export async function runJob(name: keyof typeof JOBS) {
  const started = Date.now();
  const result = await JOBS[name]();
  return { job: name, ms: Date.now() - started, result };
}

type Log = { info: (o: unknown, m?: string) => void; error: (o: unknown, m?: string) => void };

export function startScheduler(log: Log) {
  if (!config.TWENTY_API_KEY || !config.CASAPAY_API_KEY) {
    log.info('Scheduler disabled until TWENTY_API_KEY and CASAPAY_API_KEY are set');
    return;
  }
  const schedule = (expr: string, name: keyof typeof JOBS) =>
    cron.schedule(expr, async () => {
      try { log.info(await runJob(name), `job ${name} done`); }
      catch (e) { log.error(e, `job ${name} failed`); }
    }, { timezone: config.TZ });

  schedule('5 8 * * *', 'monthlyRent');   // daily 08:05; idempotent per lease+month, starts on RENT_INVOICE_DAY
  schedule('15 * * * *', 'syncInvoices'); // hourly: statuses, payouts, utility invoices from the e-mail alias
}
