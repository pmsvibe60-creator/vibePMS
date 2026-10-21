import { config } from '../config.ts';
import { casapay, type AgreementType, type CasaInvoice, type DepositMode, type Tenant } from '../casapay/client.ts';
import { query, withInvoiceNo } from '../db.ts';
import { dueDateFor, etMonth, periodKey, proratedRent, ymd } from '../lib/dates.ts';
import { saveFile, signedFileUrl } from '../lib/files.ts';
import { withLock } from '../lib/lock.ts';
import { sendMail } from '../lib/mailer.ts';
import { currency, fromMicros, round2 } from '../lib/money.ts';
import { referenceNumber } from '../lib/refnum.ts';
import { renderInvoicePdf } from '../pdf/invoice.ts';
import { twenty, type TwentyRecord } from '../twenty/client.ts';
import type { LeaseView } from './model.ts';
import { handleCasaPayEvent } from './casapayEvents.ts';
import { findInvoiceBy, link, loadLease, noteOnLease, updateInvoice, updateLease } from './twentyRecords.ts';

const AGREEMENT_TYPE: Record<string, AgreementType> = { ONTIME: 'ontime', COVER: 'cover', PAYMENT_LINK: 'payment_link' };
const DEPOSIT_MODE: Record<string, DepositMode> = { CHOICE: 'choice', DEPOSIT_UPFRONT: 'deposit_upfront', DEPOSIT_GUARANTEED: 'deposit_guaranteed' };

const tenantOf = (l: LeaseView): Tenant => ({
  email: l.tenant!.email,
  first_name: l.tenant!.firstName || l.tenant!.name,
  last_name: l.tenant!.lastName || '-',
  ...(l.tenant!.phone ? { phone: l.tenant!.phone.replace(/\s/g, '') } : {}),
  ...(l.tenant!.personalCode ? { personal_code: l.tenant!.personalCode } : {}),
});

const returnUrls = (kind: string) => ({
  success_url: `${config.PUBLIC_URL}/pay/done?k=${kind}`,
  cancel_url: `${config.PUBLIC_URL}/pay/cancelled`,
});

const periodRef = (l: LeaseView, year: number, month: number) =>
  referenceNumber(`${l.referenceBase ?? '1'}${year}${String(month).padStart(2, '0')}`);

const lang = (l: LeaseView) => (l.language === 'ET' ? 'ET' : 'EN');

async function invoicePdf(l: LeaseView, inv: { invoiceNo: string; dueDate: string; ref: string; lines: { description: string; amount: number }[] }) {
  const pdf = await renderInvoicePdf({
    invoiceNo: inv.invoiceNo, issueDate: ymd(new Date()), dueDate: inv.dueDate, referenceNumber: inv.ref,
    buyer: { name: l.tenant!.name, personalCode: l.tenant!.personalCode, email: l.tenant!.email },
    unitAddress: l.unit?.address ?? '', lines: inv.lines, language: lang(l),
  });
  const file = await saveFile(`invoices/${inv.invoiceNo}.pdf`, pdf);
  return signedFileUrl(file);
}

/**
 * Lease SIGNED → set up CasaPay billing and send the move-in payment.
 * - deposit > 0 with a guarantee-capable agreement: session-first (CasaPay creates the
 *   agreement on payment; deposit handled via deposit_mode).
 * - otherwise: agreement-first (e-mail alias available immediately) + first invoice.
 */
export function activateLease(leaseId: string) {
  return withLock(`lease:${leaseId}`, async () => {
    const { raw, view: l } = await loadLease(leaseId);
    if (l.status !== 'SIGNED' || raw.moveInCheckout?.primaryLinkUrl) return { skipped: true };

    const start = new Date(`${l.startDate}T00:00:00`);
    const [y, m] = [start.getFullYear(), start.getMonth() + 1];
    const first = proratedRent({ monthlyRent: l.rent, year: y, month: m, leaseStart: l.startDate, leaseEnd: l.endDate });
    const agreementType = AGREEMENT_TYPE[l.agreementType] ?? config.CASAPAY_AGREEMENT_TYPE;
    const ref = periodRef(l, y, m);
    const rentLine = l.language === 'ET'
      ? `Üür ${etMonth(m)} ${y}${first.days < first.totalDays ? ` (${first.days}/${first.totalDays} päeva)` : ''}`
      : `Rent ${periodKey(y, m)}${first.days < first.totalDays ? ` (${first.days}/${first.totalDays} days)` : ''}`;
    const metadata = { lease_id: leaseId, kind: 'move_in', period: periodKey(y, m) };

    const useCover = l.deposit > 0 && agreementType !== 'payment_link';
    const lines = [{ description: rentLine, amount: first.amount }];
    if (l.deposit > 0 && !useCover) lines.push({ description: l.language === 'ET' ? 'Tagatisraha' : 'Security deposit', amount: l.deposit });
    const total = round2(lines.reduce((s, x) => s + x.amount, 0));
    const dueDate = l.startDate < ymd(new Date()) ? ymd(new Date()) : l.startDate;

    // Agreement-first needs the agreement before an invoice number is reserved.
    let agreementId = l.casapayAgreementId;
    if (!useCover && !agreementId) {
      const a = await casapay.createAgreement({
        tenant: tenantOf(l), agreement_type: agreementType, currency: 'EUR', description: `${l.unit?.name ?? ''} – ${l.tenant?.name ?? ''}`,
      });
      agreementId = String(a.id);
      await updateLease(leaseId, { casapayAgreementId: agreementId, casapayAgreementRef: a.agreement_id, casapayEmailAlias: a.email_alias ?? '' });
    }

    const { checkoutUrl, sessionId, documentUrl } = await withInvoiceNo(config.INVOICE_PREFIX, y, async (invoiceNo) => {
      const documentUrl = await invoicePdf(l, { invoiceNo, dueDate, ref, lines });
      const s = useCover
        ? await casapay.createSession({
            tenant: tenantOf(l), ...returnUrls('move_in'), agreement_type: agreementType,
            cover_amount: l.deposit, deposit_mode: DEPOSIT_MODE[l.depositMode] ?? config.CASAPAY_DEPOSIT_MODE,
            first_payment_amount: first.amount, first_payment_description: rentLine, currency: 'EUR',
            description: `${l.language === 'ET' ? 'Sissekolimise makse' : 'Move-in payment'} – ${l.unit?.address ?? ''}`,
            document_url: documentUrl, invoice_no: invoiceNo, reference_number: ref, metadata,
          })
        : await casapay.createInvoice(agreementId!, {
            amount: total, ...returnUrls('move_in'), description: rentLine, document_url: documentUrl,
            due_date: dueDate, invoice_no: invoiceNo, reference_number: ref, metadata,
          });
      await twenty.create('invoices', {
        name: `${invoiceNo} · move-in · ${l.unit?.name ?? ''}`,
        leaseId, unitId: l.unit?.id, invoiceType: 'MOVE_IN', invoiceStatus: 'SENT', invoiceNo, referenceNumber: ref,
        period: periodKey(y, m), amount: currency(useCover ? first.amount : total), dueDate,
        checkoutUrl: link(s.gateway_url, 'Pay'), pdf: link(documentUrl, invoiceNo),
        casapaySessionId: s.session_id, ...(s.invoice_id ? { casapayInvoiceId: String(s.invoice_id) } : {}),
      });
      return { checkoutUrl: s.gateway_url, sessionId: s.session_id, documentUrl };
    });

    await query(`INSERT INTO rent_runs (lease_id, period) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [leaseId, periodKey(y, m)]);
    await updateLease(leaseId, { leaseStatus: 'AWAITING_PAYMENT', moveInCheckout: link(checkoutUrl, 'Move-in checkout') });

    const et = l.language === 'ET';
    await sendMail({
      to: l.tenant!.email,
      subject: et ? `Sissekolimise makse – ${l.unit?.address ?? ''}` : `Move-in payment – ${l.unit?.address ?? ''}`,
      text: et
        ? `Tere ${l.tenant!.firstName}!\n\nPalun tasuge esimese kuu üür${l.deposit > 0 ? ' ja tagatis' : ''} siin:\n${checkoutUrl}\n\n${useCover && (DEPOSIT_MODE[l.depositMode] ?? 'choice') !== 'deposit_upfront' ? 'Maksel saate valida, kas tasuda tagatisraha või kasutada CasaPay tagatisteenust.\n\n' : ''}Arve: ${documentUrl}\n\n${config.OWNER_NAME}`
        : `Hello ${l.tenant!.firstName},\n\nPlease pay the first month's rent${l.deposit > 0 ? ' and deposit' : ''} here:\n${checkoutUrl}\n\nInvoice: ${documentUrl}\n\n${config.OWNER_NAME}`,
    });
    return { sessionId, checkoutUrl };
  });
}

/** Issue the rent invoice for one lease and month (idempotent per lease+period). */
export async function createRentInvoice(leaseId: string, year: number, month: number) {
  const period = periodKey(year, month);
  const release = () => query(`DELETE FROM rent_runs WHERE lease_id = $1 AND period = $2`, [leaseId, period]);
  return withLock(`lease:${leaseId}`, async () => {
    const claim = await query(`INSERT INTO rent_runs (lease_id, period) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING lease_id`, [leaseId, period]);
    if (!claim.rowCount) return { skipped: 'already invoiced' };
    try {
      const { view: l } = await loadLease(leaseId);
      const agreementId = l.casapayAgreementId;
      if (!agreementId) throw new Error('Lease has no CasaPay agreement yet');
      const r = proratedRent({ monthlyRent: l.rent, year, month, leaseStart: l.startDate, leaseEnd: l.endDate });
      if (r.amount <= 0) { await release(); return { skipped: 'no rent for period' }; }

      const ref = periodRef(l, year, month);
      let dueDate = dueDateFor(year, month, l.dueDay);
      if (dueDate < ymd(new Date())) dueDate = ymd(new Date());
      const desc = l.language === 'ET'
        ? `Üür ${etMonth(month)} ${year}${r.days < r.totalDays ? ` (${r.days}/${r.totalDays} päeva)` : ''} – ${l.unit?.address ?? ''}`
        : `Rent ${period}${r.days < r.totalDays ? ` (${r.days}/${r.totalDays} days)` : ''} – ${l.unit?.address ?? ''}`;

      return await withInvoiceNo(config.INVOICE_PREFIX, year, async (invoiceNo) => {
        const documentUrl = await invoicePdf(l, { invoiceNo, dueDate, ref, lines: [{ description: desc, amount: r.amount }] });
        const s = await casapay.createInvoice(agreementId, {
          amount: r.amount, ...returnUrls('rent'), description: desc, document_url: documentUrl, due_date: dueDate,
          invoice_no: invoiceNo, reference_number: ref, metadata: { lease_id: leaseId, kind: 'rent', period },
        });
        const rec = await twenty.create('invoices', {
          name: `${invoiceNo} · ${period} · ${l.unit?.name ?? ''}`,
          leaseId, unitId: l.unit?.id, invoiceType: 'RENT', invoiceStatus: 'SENT', invoiceNo, referenceNumber: ref, period,
          amount: currency(r.amount), dueDate, checkoutUrl: link(s.gateway_url, 'Pay'), pdf: link(documentUrl, invoiceNo),
          casapaySessionId: s.session_id, ...(s.invoice_id ? { casapayInvoiceId: String(s.invoice_id) } : {}),
        });
        await query(`UPDATE rent_runs SET invoice_record_id = $3 WHERE lease_id = $1 AND period = $2`, [leaseId, period, rec.id]);
        return { invoiceNo, amount: r.amount, checkoutUrl: s.gateway_url };
      });
    } catch (e) {
      await release();
      throw e;
    }
  });
}

const BILLABLE = ['ACTIVE', 'NOTICE_GIVEN'];

export async function billableLeases(): Promise<TwentyRecord[]> {
  const rows = await twenty.list('leases', { filter: `leaseStatus[in]:[${BILLABLE.map((s) => `"${s}"`).join(',')}]` });
  return rows.filter((r) => r.casapayAgreementId);
}

/** Daily: issue this month's rent for every billable lease once the invoice day is reached. */
export async function runMonthlyRent(now = new Date()) {
  if (now.getDate() < config.RENT_INVOICE_DAY) return [];
  const [y, m] = [now.getFullYear(), now.getMonth() + 1];
  const results = [];
  for (const lease of await billableLeases()) {
    try {
      results.push({ lease: lease.id, ...(await createRentInvoice(lease.id, y, m)) });
    } catch (e) {
      results.push({ lease: lease.id, error: (e as Error).message });
      await noteOnLease(lease.id, `Rent invoice ${periodKey(y, m)} failed`, (e as Error).message);
    }
  }
  return results;
}

const STATUS_MAP: Record<CasaInvoice['status'], string> = { paid: 'PAID', partial: 'PARTIAL', unpaid: 'SENT', cancelled: 'CANCELLED', rejected: 'CANCELLED' };

/**
 * Pull invoices per agreement: updates status/payout of ours and imports invoices CasaPay
 * created from bills forwarded to the lease's e-mail alias (→ type UTILITY).
 */
export async function syncInvoices() {
  const today = ymd(new Date());
  const summary = { updated: 0, imported: 0, movedIn: 0, errors: [] as string[] };

  // Polling backup for missed webhooks: move-in sessions are the only ones without an agreement yet.
  for (const lease of await twenty.list('leases', { filter: `leaseStatus[eq]:"AWAITING_PAYMENT"` })) {
    try {
      const [inv] = await twenty.list('invoices', { filter: `and(leaseId[eq]:"${lease.id}",invoiceType[eq]:"MOVE_IN")`, limit: 1 });
      if (!inv?.casapaySessionId) continue;
      const s = await casapay.getSession(inv.casapaySessionId);
      if (s.status === 'completed') {
        await handleCasaPayEvent({ event: 'gateway.session.completed', session_id: s.session_id, timestamp: new Date().toISOString(),
          metadata: { lease_id: lease.id, kind: 'move_in' }, payment_agreement_id: s.payment_agreement_id ?? undefined });
        summary.movedIn++;
      } else if (['expired', 'cancelled', 'failed'].includes(s.status)) {
        await handleCasaPayEvent({ event: `gateway.session.${s.status === 'failed' ? 'cancelled' : s.status}`, session_id: s.session_id,
          timestamp: new Date().toISOString(), metadata: { lease_id: lease.id, kind: 'move_in' } });
      }
    } catch (e) {
      summary.errors.push(`move-in ${lease.id}: ${(e as Error).message}`);
    }
  }
  for (const lease of await twenty.list('leases', { filter: `casapayAgreementId[is]:NOT_NULL` })) {
    if (!lease.casapayAgreementId) continue;
    try {
      for (const ci of await casapay.listInvoices(lease.casapayAgreementId)) {
        let rec = (await findInvoiceBy('casapayInvoiceId', String(ci.id))) ?? (ci.invoice_no ? await findInvoiceBy('invoiceNo', ci.invoice_no) : undefined);
        let status = STATUS_MAP[ci.status] ?? 'SENT';
        if (status === 'SENT' && ci.due_date && ci.due_date < today) status = 'OVERDUE';
        const patch: Record<string, unknown> = {
          casapayInvoiceId: String(ci.id), paidAmount: currency(ci.paid_amount ?? 0), payoutStatus: ci.payout_status ?? '',
          ...(ci.paid_at ? { paidAt: ci.paid_at } : {}),
        };
        if (!rec) {
          rec = await twenty.create('invoices', {
            name: `${ci.invoice_no ?? `CP-${ci.id}`} · utilities · ${lease.name ?? ''}`,
            leaseId: lease.id, unitId: lease.unitId, invoiceType: 'UTILITY', invoiceStatus: status,
            invoiceNo: ci.invoice_no ?? '', referenceNumber: ci.reference_number ?? '', amount: currency(ci.total_amount),
            ...(ci.due_date ? { dueDate: ci.due_date, period: ci.due_date.slice(0, 7) } : {}),
            pdf: link(signedFileUrl(`casapay-invoice/${ci.id}`, 60 * 60 * 24 * 365), 'Invoice PDF (CasaPay)'),
            ...patch,
          });
          summary.imported++;
          continue;
        }
        const keep = rec.invoiceStatus === 'REFUND_NEEDED' || (rec.invoiceStatus === 'CANCELLED' && status !== 'PAID');
        const changed = !keep && rec.invoiceStatus !== status;
        if (changed || rec.casapayInvoiceId !== String(ci.id) || rec.payoutStatus !== (ci.payout_status ?? '') || fromMicros(rec.paidAmount) !== (ci.paid_amount ?? 0)) {
          await updateInvoice(rec.id, { ...patch, ...(changed ? { invoiceStatus: status } : {}) });
          summary.updated++;
        }
      }
    } catch (e) {
      summary.errors.push(`${lease.id}: ${(e as Error).message}`);
    }
  }
  // Invoices without a CasaPay invoice id yet (e.g. move-in sessions) still go overdue locally.
  for (const rec of await twenty.list('invoices', { filter: `and(invoiceStatus[eq]:"SENT",dueDate[lt]:"${today}")` })) {
    await updateInvoice(rec.id, { invoiceStatus: 'OVERDUE' });
    summary.updated++;
  }
  return summary;
}

/** Operator action: cancel an unpaid invoice's checkout session (CasaPay refuses once money moved). */
export async function voidInvoice(invoiceId: string, note?: string) {
  const rec = await twenty.get('invoices', invoiceId, 0);
  if (!rec.casapaySessionId) { await updateInvoice(invoiceId, { invoiceStatus: 'CANCELLED' }); return { cancelled: true }; }
  try {
    const r = await casapay.cancelSession(rec.casapaySessionId, { reason: 'operator_cancelled', note, cascade: true });
    // invoice_cancelled === false → money already moved for the invoice: needs refund/credit, not cancel.
    await updateInvoice(invoiceId, { invoiceStatus: r.invoice_cancelled === false ? 'REFUND_NEEDED' : 'CANCELLED' });
    return r;
  } catch (e: any) {
    if (e?.code === 'CANCEL_FAILED') {
      await updateInvoice(invoiceId, { lastPaymentError: `Cancel refused: ${e.message}` });
      return { cancelled: false, reason: e.message };
    }
    throw e;
  }
}
