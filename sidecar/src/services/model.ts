import type { TwentyRecord } from '../twenty/client.ts';
import { fromMicros } from '../lib/money.ts';

/** Normalised views of Twenty records used by PDFs, signing and CasaPay calls. */
export type LeaseView = {
  id: string; name: string; status: string; language: 'EN';
  startDate: string; endDate: string | null; rent: number; deposit: number; dueDay: number;
  depositMode: string; agreementType: string; utilitiesPolicy: string; noticeDays: number; specialTerms: string;
  referenceBase: string | null; casapayAgreementId: string | null; emailAlias: string | null;
  unit: { id: string; name: string; address: string; apartmentNo: string; areaM2: number | null; rooms: number | null; cadastralNo: string; inventory: string } | null;
  tenant: { id: string; firstName: string; lastName: string; name: string; email: string; phone: string; personalCode: string } | null;
};

export function formatAddress(a: any): string {
  if (!a) return '';
  return [a.addressStreet1, a.addressStreet2, [a.addressPostcode, a.addressCity].filter(Boolean).join(' '), a.addressCountry]
    .filter((x) => x && String(x).trim()).join(', ');
}

export function toLeaseView(r: TwentyRecord, dueDayDefault: number): LeaseView {
  const u = r.unit;
  const p = r.tenant;
  const phone = p?.phones?.primaryPhoneNumber ? `${p.phones.primaryPhoneCallingCode ?? ''}${p.phones.primaryPhoneNumber}` : '';
  return {
    id: r.id,
    name: r.name ?? '',
    status: r.leaseStatus ?? 'DRAFT',
    language: 'EN',
    startDate: (r.startDate ?? '').slice(0, 10),
    endDate: r.endDate ? String(r.endDate).slice(0, 10) : null,
    rent: fromMicros(r.rentAmount),
    deposit: fromMicros(r.depositAmount),
    dueDay: Number(r.dueDay) || dueDayDefault,
    depositMode: r.depositMode ?? 'CHOICE',
    agreementType: r.agreementType ?? 'ONTIME',
    utilitiesPolicy: r.utilitiesPolicy ?? 'REBILL_ACTUAL',
    noticeDays: Number(r.noticePeriodDays) || 0,
    specialTerms: r.specialTerms ?? '',
    referenceBase: r.referenceBase || null,
    casapayAgreementId: r.casapayAgreementId || null,
    emailAlias: r.casapayEmailAlias || null,
    unit: u ? {
      id: u.id, name: u.name ?? '', address: formatAddress(u.unitAddress) || u.name || '', apartmentNo: u.apartmentNo ?? '',
      areaM2: u.areaM2 ?? null, rooms: u.rooms ?? null, cadastralNo: u.cadastralNo ?? '', inventory: u.inventory ?? '',
    } : null,
    tenant: p ? {
      id: p.id, firstName: p.name?.firstName ?? '', lastName: p.name?.lastName ?? '',
      name: [p.name?.firstName, p.name?.lastName].filter(Boolean).join(' '),
      email: p.emails?.primaryEmail ?? '', phone, personalCode: p.personalCode ?? '',
    } : null,
  };
}

export function validateLeaseForSigning(l: LeaseView): string[] {
  const errs: string[] = [];
  if (!l.unit) errs.push('Lease has no Unit');
  if (!l.tenant) errs.push('Lease has no Tenant');
  if (l.tenant && !l.tenant.email) errs.push('Tenant has no e-mail');
  if (!l.startDate) errs.push('Start date missing');
  if (!Number.isInteger(l.noticeDays) || l.noticeDays <= 0) errs.push('Set a positive notice period for this lease');
  if (!Number.isFinite(l.deposit) || l.deposit < 0) errs.push('Deposit must be a non-negative amount');
  if (!(l.rent > 0)) errs.push('Monthly rent missing');
  if (l.agreementType === 'PAYMENT_LINK' && l.deposit > 0 && l.depositMode !== 'DEPOSIT_UPFRONT')
    errs.push('PAYMENT_LINK agreements cannot carry a guarantee — use deposit mode "Paid upfront" or agreement type ONTIME/COVER');
  if (l.deposit > 15000) errs.push('Deposit above CasaPay max cover (15 000 €)');
  return errs;
}
