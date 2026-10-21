import fs from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { leaseContent, renderLeasePdf, renderSignedLeasePdf } from '../src/pdf/lease.ts';
import { renderInvoicePdf } from '../src/pdf/invoice.ts';
import { validateLeaseForSigning, type LeaseView } from '../src/services/model.ts';
import { sha256 } from '../src/lib/hmac.ts';

const lease: LeaseView = {
  id: 'abc12345-0000', name: 'Test', status: 'READY_TO_SIGN', language: 'ET', startDate: '2026-11-16', endDate: null,
  rent: 900, deposit: 1800, dueDay: 5, depositMode: 'CHOICE', agreementType: 'ONTIME', utilitiesPolicy: 'REBILL_ACTUAL',
  noticeDays: 90, specialTerms: 'Lemmikloomad lubatud.', referenceBase: '101', casapayAgreementId: null, emailAlias: null,
  unit: { id: 'u1', name: 'Example Street 1-5', address: 'Example Street 1, 10115 Tallinn', apartmentNo: '5', areaM2: 45, rooms: 2, cadastralNo: '', inventory: '- Külmkapp\n- Diivan' },
  tenant: { id: 'p1', firstName: 'Mari', lastName: 'Maasikas', name: 'Mari Maasikas', email: 'mari@example.com', phone: '', personalCode: '00000000000' },
};
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const out = process.env.PDF_OUT_DIR;

describe('PDF rendering', () => {
  it('renders lease + signed lease PDFs', async () => {
    const content = await leaseContent(lease, new Date('2026-11-01'));
    const a = await renderLeasePdf(lease, content);
    expect(a.subarray(0, 4).toString()).toBe('%PDF');
    const signed = await renderSignedLeasePdf(lease, content, sha256(a), [
      { role: 'tenant', name: 'Mari Maasikas', signedName: 'Mari Maasikas', email: 'mari@example.com', signedAt: new Date(), ip: '192.0.2.1', userAgent: 'test', signaturePng: PNG },
    ]);
    expect(signed.length).toBeGreaterThan(a.length);
    if (out) { await fs.writeFile(`${out}/lease.pdf`, a); await fs.writeFile(`${out}/lease-signed.pdf`, signed); }
    const en = await leaseContent({ ...lease, language: 'EN', endDate: '2027-11-15' });
    expect(JSON.stringify(en)).toContain('fixed term');
  });
  it('renders an invoice', async () => {
    const pdf = await renderInvoicePdf({
      invoiceNo: 'RENT-2026-0001', issueDate: '2026-11-01', dueDate: '2026-11-05', referenceNumber: '1012026115',
      buyer: { name: 'Mari Maasikas', personalCode: '00000000000', email: 'mari@example.com' }, unitAddress: 'Example Street 1-5, Tallinn',
      lines: [{ description: 'Üür november 2026', amount: 900 }], paymentUrl: 'https://gateway.test.casapay.com/s/gwy_x', language: 'ET',
    });
    expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
    if (out) await fs.writeFile(`${out}/invoice.pdf`, pdf);
  });
});

describe('lease validation', () => {
  it('enforces VÕS § 300 deposit cap and required fields', () => {
    expect(validateLeaseForSigning(lease)).toEqual([]);
    expect(validateLeaseForSigning({ ...lease, deposit: 2701 })).toContain('Deposit exceeds 3× monthly rent (VÕS § 300)');
    expect(validateLeaseForSigning({ ...lease, tenant: null })).toContain('Lease has no Tenant');
  });
});
