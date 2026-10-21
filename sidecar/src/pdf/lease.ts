import fs from 'node:fs/promises';
import path from 'node:path';
import Handlebars from 'handlebars';
import type { Content } from 'pdfmake/interfaces';
import { config } from '../config.ts';
import { displayDate } from '../lib/dates.ts';
import { formatEur } from '../lib/money.ts';
import type { LeaseView } from '../services/model.ts';
import { markdownToContent, renderPdf } from './render.ts';

const templatesDir = path.resolve(import.meta.dirname, '../../templates');

const TEXT = {
  EN: {
    utilities: {
      REBILL_ACTUAL: 'In addition to rent, the Tenant pays utilities and service charges at actual cost.',
      INCLUDED: 'Utilities are included in the rent, except services contracted in the Tenant\'s own name (e.g. internet).',
      TENANT_DIRECT: 'The Tenant contracts utility suppliers in their own name and pays them directly; the building management invoice is re-billed to the Tenant.',
    },
    deposit: {
      DEPOSIT_UPFRONT: 'The deposit is paid as a one-off payment together with the first month\'s rent.',
      DEPOSIT_GUARANTEED: 'Instead of a cash deposit, the Tenant\'s obligations are secured by the CasaPay guarantee service, whose monthly fee is paid by the Tenant.',
      CHOICE: 'When making the first payment the Tenant chooses to either pay the deposit in cash or use the CasaPay guarantee service (monthly fee paid by the Tenant).',
    },
    sigTitle: 'Signatures and signing details',
    landlord: 'Landlord', tenant: 'Tenant', signedAt: 'Signed at', ip: 'IP address', hash: 'SHA-256 hash of the agreement document',
    method: 'Signing method: personal link sent by e-mail, name typed and signature drawn on screen.',
  },
} as const;

export function leaseNumber(l: LeaseView) {
  return l.referenceBase ? `${l.referenceBase}` : l.id.slice(0, 8).toUpperCase();
}

export async function leaseContent(l: LeaseView, today = new Date()): Promise<Content[]> {
  const lang = l.language;
  const src = await fs.readFile(path.join(templatesDir, `lease.${lang.toLowerCase()}.md`), 'utf8');
  const t = TEXT[lang];
  const locale = 'en';
  const md = Handlebars.compile(src, { noEscape: true })({
    today: displayDate(today.toISOString()),
    owner: {
      name: config.OWNER_NAME, regCode: config.OWNER_REG_CODE, address: config.OWNER_ADDRESS,
      representative: config.OWNER_REPRESENTATIVE || config.OWNER_NAME,
    },
    tenant: { ...l.tenant, personalCode: l.tenant?.personalCode || '—' },
    unit: l.unit,
    lease: {
      number: leaseNumber(l),
      startDate: displayDate(l.startDate), endDate: l.endDate ? displayDate(l.endDate) : null,
      rent: formatEur(l.rent, locale), deposit: formatEur(l.deposit, locale),
      dueDay: l.dueDay, noticeDays: l.noticeDays, specialTerms: l.specialTerms,
      utilitiesText: t.utilities[l.utilitiesPolicy as keyof typeof t.utilities] ?? t.utilities.REBILL_ACTUAL,
      depositText: t.deposit[l.depositMode as keyof typeof t.deposit] ?? t.deposit.CHOICE,
    },
  });
  const content = markdownToContent(md);
  if (l.unit?.inventory) {
    content.push({ text: 'Annex 1. Inventory', style: 'h2', pageBreak: 'before' });
    content.push(...markdownToContent(l.unit.inventory));
  }
  return content;
}

/**
 * The unsigned contract — this exact PDF is hashed and shown to signers. `content` is the
 * snapshot taken when the lease was sent, so later edits in Twenty don't alter a document
 * someone already signed.
 */
export async function renderLeasePdf(l: LeaseView, content: Content[]): Promise<Buffer> {
  return renderPdf({
    info: { title: `Lease ${leaseNumber(l)}` },
    content,
    footer: (page: number, pages: number) => ({ text: `${page} / ${pages}`, alignment: 'center', style: 'small', margin: [0, 20, 0, 0] }),
  });
}

export type SignatureEntry = { role: 'tenant' | 'landlord'; name: string; signedName: string; email: string; signedAt: Date; ip: string; userAgent: string; signaturePng: string };

/** Final sealed PDF = contract + signature page with audit trail. */
export async function renderSignedLeasePdf(l: LeaseView, content: Content[], documentSha256: string, sigs: SignatureEntry[]): Promise<Buffer> {
  const t = TEXT[l.language];
  const blocks: Content[] = sigs.map((s) => ({
    margin: [0, 0, 0, 14],
    columns: [
      {
        width: '*',
        stack: [
          { text: s.role === 'tenant' ? t.tenant : t.landlord, bold: true },
          { text: s.name },
          { text: `${t.signedAt}: ${s.signedAt.toISOString().replace('T', ' ').slice(0, 19)} UTC`, style: 'small' },
          { text: `E-mail: ${s.email}`, style: 'small' },
          { text: `${t.ip}: ${s.ip}`, style: 'small' },
          { text: `User-Agent: ${s.userAgent.slice(0, 140)}`, style: 'small' },
          { text: `/${s.signedName}/`, italics: true, margin: [0, 4, 0, 0] },
        ],
      },
      { width: 200, image: s.signaturePng, fit: [200, 80] },
    ],
  }));
  return renderPdf({
    info: { title: `Lease ${leaseNumber(l)} (signed)` },
    content: [
      ...content,
      { text: t.sigTitle, style: 'title', pageBreak: 'before' },
      ...blocks,
      { text: t.method, style: 'small', margin: [0, 10, 0, 4] },
      { text: `${t.hash}: ${documentSha256}`, style: 'small' },
    ],
    footer: (page: number, pages: number) => ({ text: `${page} / ${pages}`, alignment: 'center', style: 'small', margin: [0, 20, 0, 0] }),
  });
}
