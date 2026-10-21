import { casapay } from '../casapay/client.ts';
import { withLock } from '../lib/lock.ts';
import { sendMail } from '../lib/mailer.ts';
import { twenty } from '../twenty/client.ts';
import { findInvoiceBy, loadLease, noteOnLease, updateInvoice, updateLease } from './twentyRecords.ts';

export type CasaPayEvent = {
  event: string; session_id: string; timestamp: string;
  metadata?: Record<string, string>; payment_agreement_id?: number;
  deposit?: { amount: number; mode: string; resolved_mode: string | null };
  guarantee?: { guarantee_id: string; covered_amount: number; status: string };
  payment?: { total_amount?: number; cash_amount?: number; paid_at?: string; payment_method?: string };
  failure?: { reason: string; code: string; message: string; retry_count: number; can_retry: boolean };
  invoice_id?: number;
};

/** Idempotency key: same session+event delivered twice is processed once; each failed attempt counts separately. */
export const eventKey = (e: CasaPayEvent) =>
  `${e.session_id}:${e.event}${e.event === 'gateway.payment.failed' ? `:${e.failure?.retry_count ?? e.timestamp}` : ''}`;

async function setKyc(leaseId: string | undefined, status: string) {
  if (!leaseId) return;
  const { view } = await loadLease(leaseId);
  if (view.tenant) await twenty.update('people', view.tenant.id, { kycStatus: status });
}

export async function handleCasaPayEvent(e: CasaPayEvent) {
  const leaseId = e.metadata?.lease_id;
  const invoice = await findInvoiceBy('casapaySessionId', e.session_id);

  switch (e.event) {
    case 'gateway.session.completed': {
      // Never trust the webhook alone: confirm with the API.
      const s = await casapay.getSession(e.session_id);
      if (s.status !== 'completed') {
        console.warn(`[casapay] webhook says completed but API says ${s.status} for ${e.session_id}`);
        return;
      }
      if (invoice) {
        await updateInvoice(invoice.id, {
          invoiceStatus: 'PAID', paidAt: s.payment?.paid_at ?? new Date().toISOString(), lastPaymentError: '',
          ...(e.invoice_id ? { casapayInvoiceId: String(e.invoice_id) } : {}),
        });
      }
      if (leaseId && e.metadata?.kind === 'move_in') await completeMoveIn(leaseId, s.payment_agreement_id ?? e.payment_agreement_id, e, s.cover?.resolved_mode);
      return;
    }
    case 'gateway.session.cancelled':
    case 'gateway.session.expired': {
      if (invoice && !['PAID', 'REFUND_NEEDED'].includes(invoice.invoiceStatus)) await updateInvoice(invoice.id, { invoiceStatus: 'CANCELLED' });
      if (leaseId) await noteOnLease(leaseId, `Checkout ${e.event.split('.').pop()}`, `Session ${e.session_id}${e.metadata?.kind === 'move_in' ? ' (move-in). Use "activate" admin action to create a new checkout.' : ''}`);
      return;
    }
    case 'gateway.payment.failed': {
      const f = e.failure;
      const msg = f ? `${f.reason}: ${f.message} (attempt ${f.retry_count}${f.can_retry ? ', can retry' : ''})` : 'payment failed';
      if (invoice) await updateInvoice(invoice.id, { lastPaymentError: msg });
      if (leaseId) {
        const { view } = await loadLease(leaseId);
        if (f?.can_retry && view.tenant?.email && invoice?.checkoutUrl?.primaryLinkUrl) {
          await sendMail({
            to: view.tenant.email,
            subject: 'Your payment did not go through',
            text: `Hello ${view.tenant.firstName},\n\nYour payment did not go through (${f.reason}). Please try again, using another card or bank if needed:\n${invoice.checkoutUrl.primaryLinkUrl}\n`,
          });
        }
      }
      return;
    }
    case 'gateway.verification.pending': return setKyc(leaseId, 'PENDING');
    case 'gateway.verification.approved': return setKyc(leaseId, 'APPROVED');
    case 'gateway.verification.failed': return setKyc(leaseId, 'FAILED');
    case 'gateway.guarantee.activated': {
      if (leaseId) await updateLease(leaseId, { depositResolution: `CasaPay guarantee ${e.guarantee?.guarantee_id ?? ''} active, covers ${e.guarantee?.covered_amount ?? ''} €` });
      return;
    }
    default:
      console.log(`[casapay] ignoring event ${e.event}`);
  }
}

function completeMoveIn(leaseId: string, agreementId: number | null | undefined, e: CasaPayEvent, resolvedMode?: string | null) {
  return withLock(`lease:${leaseId}`, async () => {
    const { raw, view } = await loadLease(leaseId);
    const patch: Record<string, unknown> = { leaseStatus: 'ACTIVE' };
    const mode = resolvedMode ?? e.deposit?.resolved_mode;
    if (mode) patch.depositResolution = /guarant/.test(mode) ? 'CasaPay guarantee' : `Deposit paid upfront (${view.deposit} €)`;
    if (agreementId && !view.casapayAgreementId) {
      const a = await casapay.getAgreement(agreementId);
      Object.assign(patch, { casapayAgreementId: String(a.id), casapayAgreementRef: a.agreement_id, casapayEmailAlias: a.email_alias ?? '' });
    }
    await updateLease(leaseId, patch);
    if (raw.unitId) await twenty.update('units', raw.unitId, { unitStatus: 'OCCUPIED' });
    await noteOnLease(leaseId, 'Move-in payment received', `Lease is ACTIVE. Forward utility bills to: ${patch.casapayEmailAlias ?? view.emailAlias ?? '(alias pending)'}`);
  });
}
