import fs from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { leaseContent, renderLeasePdf, renderSignedLeasePdf } from '../src/pdf/lease.ts';
import { renderInvoicePdf } from '../src/pdf/invoice.ts';
import { validateLeaseForSigning, type LeaseView } from '../src/services/model.ts';
import { sha256 } from '../src/lib/hmac.ts';

const lease: LeaseView = {
  id: 'abc12345-0000', name: 'Test', status: 'READY_TO_SIGN', language: 'EN', startDate: '2026-11-16', endDate: null,
  rent: 900, deposit: 1800, dueDay: 5, depositMode: 'CHOICE', agreementType: 'ONTIME', utilitiesPolicy: 'REBILL_ACTUAL',
  noticeDays: 90, specialTerms: 'Pets allowed.', referenceBase: '101', casapayAgreementId: null, emailAlias: null,
  unit: { id: 'u1', name: 'Example Street 1-5', address: '1 Example Street, Sample City', apartmentNo: '5', areaM2: 45, rooms: 2, cadastralNo: '', inventory: '- Refrigerator\n- Sofa' },
  tenant: { id: 'p1', firstName: 'Alex', lastName: 'Example', name: 'Alex Example', email: 'alex@example.com', phone: '', personalCode: '00000000000' },
};
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const out = process.env.PDF_OUT_DIR;

describe('PDF rendering', () => {
  it('renders lease + signed lease PDFs', async () => {
    const content = await leaseContent(lease, new Date('2026-11-01'));
    const a = await renderLeasePdf(lease, content);
    expect(a.subarray(0, 4).toString()).toBe('%PDF');
    const signed = await renderSignedLeasePdf(lease, content, sha256(a), [
      { role: 'tenant', name: 'Alex Example', signedName: 'Alex Example', email: 'alex@example.com', signedAt: new Date(), ip: '192.0.2.1', userAgent: 'test', signaturePng: PNG },
    ]);
    expect(signed.length).toBeGreaterThan(a.length);
    if (out) { await fs.writeFile(`${out}/lease.pdf`, a); await fs.writeFile(`${out}/lease-signed.pdf`, signed); }
    const en = await leaseContent({ ...lease, language: 'EN', endDate: '2027-11-15' });
    expect(JSON.stringify(en)).toContain('fixed term');
  });
  it('renders an invoice', async () => {
    const pdf = await renderInvoicePdf({
      invoiceNo: 'RENT-2026-0001', issueDate: '2026-11-01', dueDate: '2026-11-05', referenceNumber: '1012026115',
      buyer: { name: 'Alex Example', personalCode: '00000000000', email: 'alex@example.com' }, unitAddress: '1 Example Street, Unit 5, Sample City',
      lines: [{ description: 'Rent November 2026', amount: 900 }], paymentUrl: 'https://gateway.test.casapay.com/s/gwy_x', language: 'EN',
    });
    expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
    if (out) await fs.writeFile(`${out}/invoice.pdf`, pdf);
  });
});

describe('lease validation', () => {
  it('validates required fields without a country-specific deposit cap', () => {
    expect(validateLeaseForSigning(lease)).toEqual([]);
    expect(validateLeaseForSigning({ ...lease, deposit: 3600 })).toEqual([]);
    expect(validateLeaseForSigning({ ...lease, noticeDays: 0 })).toContain('Set a positive notice period for this lease');
    expect(validateLeaseForSigning({ ...lease, deposit: -1 })).toContain('Deposit must be a non-negative amount');
    expect(validateLeaseForSigning({ ...lease, tenant: null })).toContain('Lease has no Tenant');
  });
});
