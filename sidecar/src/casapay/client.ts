import { config, requireSetting } from '../config.ts';

/** CasaPay Gateway API (skill v1.12). Amounts are decimal EUR, not cents. */
export type Tenant = { email: string; first_name: string; last_name: string; phone?: string; personal_code?: string };
export type AgreementType = 'payment_link' | 'ontime' | 'cover';
export type DepositMode = 'deposit_upfront' | 'deposit_guaranteed' | 'choice';

export class CasaPayError extends Error {
  constructor(public status: number, public code: string | undefined, message: string, public details?: unknown) {
    super(`CasaPay ${status} ${code ?? ''}: ${message}${details ? ` ${JSON.stringify(details)}` : ''}`);
  }
}

async function call<T>(method: string, path: string, body?: unknown, attempt = 0): Promise<T> {
  const res = await fetch(`${config.CASAPAY_API_BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${requireSetting('CASAPAY_API_KEY')}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 429 && attempt < 3) {
    const wait = Number(res.headers.get('retry-after') ?? 10);
    await new Promise((r) => setTimeout(r, wait * 1000));
    return call(method, path, body, attempt + 1);
  }
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok) {
    // Error shapes seen: {error, code} and {error: {code, message, details}}
    const err = typeof json.error === 'object' ? json.error : { message: json.error, code: json.code, details: json.details ?? json.errors };
    throw new CasaPayError(res.status, err?.code, err?.message ?? text.slice(0, 300), err?.details);
  }
  return json as T;
}

export type Agreement = {
  id: number; agreement_id: string; agreement_type: AgreementType; status: string;
  email_alias: string | null; currency: string; cover_amount?: number | null; coverage_amount?: number | null;
};

export type Session = {
  session_id: string; gateway_url: string; status: string; expires_at: string | null;
  total_amount?: number; invoice_id?: number; payment_agreement_id?: number;
};

export type SessionDetails = Session & {
  current_step: string | null;
  payment_agreement_id: number | null;
  cover?: { amount: number; mode: string; resolved_mode: string | null };
  payment?: { status: string; paid_at: string | null; payment_method: string | null; transaction_id: string | null };
  guarantee?: { status: string; guarantee_id: string; covered_amount: number } | null;
  tenant?: { verification_status?: string };
  metadata?: Record<string, string>;
};

export type CasaInvoice = {
  id: number; invoice_no: string | null; reference_number: string | null; total_amount: number; paid_amount: number;
  status: 'paid' | 'partial' | 'unpaid' | 'cancelled' | 'rejected'; due_date: string | null; paid_at: string | null;
  created_at: string; payout_status: string | null; payout_amount: number | null; payout_target_date: string | null;
};

type Paged<T> = { data: T[]; meta: { current_page: number; last_page: number } };

export const casapay = {
  pricingPreview: (b: { cover_amount: number; first_payment_amount?: number; currency?: string }) =>
    call<any>('POST', '/pricing-preview', b),

  createAgreement: (b: { tenant: Tenant; agreement_type: AgreementType; cover_amount?: number; currency?: string; description?: string }) =>
    call<Agreement>('POST', '/agreements', b),

  getAgreement: (id: number | string) => call<Agreement>('GET', `/agreements/${id}`),

  createSession: (b: {
    tenant: Tenant; success_url: string; cancel_url: string;
    agreement_type?: AgreementType; cover_amount?: number; deposit_mode?: DepositMode;
    first_payment_amount?: number; first_payment_description?: string; currency?: string; description?: string;
    document_url?: string; invoice_no?: string; reference_number?: string; verification_required?: boolean | null;
    allowed_payment_methods?: ('card' | 'bank_transfer' | 'open_banking')[]; metadata?: Record<string, string>;
  }) => call<Session>('POST', '/sessions', b),

  getSession: (id: string) => call<SessionDetails>('GET', `/sessions/${id}`),

  cancelSession: (id: string, b: { reason?: 'operator_cancelled' | 'customer_cancelled'; note?: string; cascade?: boolean } = {}) =>
    call<{ session_id: string; status: string; cancellation_reason: string; invoice_cancelled: boolean | null }>('POST', `/sessions/${id}/cancel`, b),

  createInvoice: (agreementId: number | string, b: {
    amount: number; success_url: string; cancel_url: string; description?: string; document_url?: string;
    due_date?: string; invoice_no?: string; reference_number?: string; metadata?: Record<string, string>;
  }) => call<Session & { invoice_id: number }>('POST', `/agreements/${agreementId}/invoice`, b),

  async listInvoices(agreementId: number | string): Promise<CasaInvoice[]> {
    const out: CasaInvoice[] = [];
    for (let page = 1; ; page++) {
      const r = await call<Paged<CasaInvoice>>('GET', `/agreements/${agreementId}/invoices?per_page=200&page=${page}`);
      out.push(...r.data);
      if (!r.meta || page >= r.meta.last_page) break;
    }
    return out;
  },

  invoiceDocument: (invoiceId: number | string, minutes = 15) =>
    call<{ document_url: string; expires_at: string }>('GET', `/invoices/${invoiceId}/document?expires_in_minutes=${minutes}`),
};
