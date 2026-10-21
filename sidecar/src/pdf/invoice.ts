import type { Content } from 'pdfmake/interfaces';
import { config } from '../config.ts';
import { etDate } from '../lib/dates.ts';
import { formatEur } from '../lib/money.ts';
import { renderPdf } from './render.ts';

export type InvoiceDoc = {
  invoiceNo: string; issueDate: string; dueDate: string; referenceNumber: string;
  buyer: { name: string; personalCode?: string; email?: string; address?: string };
  unitAddress: string;
  lines: { description: string; quantity?: string; amount: number }[];
  paymentUrl?: string;
  language: 'ET' | 'EN';
};

const L = {
  ET: { title: 'ARVE', no: 'Arve nr', date: 'Kuupäev', due: 'Maksetähtaeg', ref: 'Viitenumber', seller: 'Müüja', buyer: 'Ostja',
    object: 'Üüripind', desc: 'Kirjeldus', qty: 'Periood', sum: 'Summa', total: 'Tasuda kokku', vat: 'Käibemaksuvaba (KMS § 16 lg 2 p 1)',
    pay: 'Tasumine', payLink: 'Maksa kaardi või pangalingiga', viaEmail: 'Makselink (kaart, pangalink, pangaülekanne) saadetakse e-postiga CasaPay kaudu.', regCode: 'Reg. kood', vatNo: 'KMKR', code: 'Isikukood' },
  EN: { title: 'INVOICE', no: 'Invoice no.', date: 'Date', due: 'Due date', ref: 'Reference no.', seller: 'Seller', buyer: 'Bill to',
    object: 'Premises', desc: 'Description', qty: 'Period', sum: 'Amount', total: 'Total due', vat: 'VAT exempt (VAT Act § 16(2)(1))',
    pay: 'Payment', payLink: 'Pay by card or bank link', viaEmail: 'A payment link (card, bank link, bank transfer) is sent by e-mail via CasaPay.', regCode: 'Reg. code', vatNo: 'VAT no.', code: 'Personal code' },
} as const;

export function renderInvoicePdf(inv: InvoiceDoc): Promise<Buffer> {
  const t = L[inv.language];
  const locale = inv.language === 'ET' ? 'et-EE' : 'en-IE';
  const total = inv.lines.reduce((s, l) => s + l.amount, 0);
  const kv = (k: string, v: string): Content => ({ columns: [{ text: k, style: 'label', width: 90 }, { text: v, width: '*' }], margin: [0, 0, 0, 2] });

  return renderPdf({
    info: { title: `${t.title} ${inv.invoiceNo}` },
    content: [
      { columns: [
        { stack: [{ text: config.OWNER_NAME, bold: true, fontSize: 12 }, config.OWNER_ADDRESS,
          `${t.regCode}: ${config.OWNER_REG_CODE}`, ...(config.OWNER_VAT_NO ? [`${t.vatNo}: ${config.OWNER_VAT_NO}`] : []),
          config.OWNER_EMAIL, config.OWNER_PHONE].filter(Boolean) as Content[] },
        { width: 200, stack: [{ text: t.title, style: 'title', alignment: 'right' },
          kv(t.no, inv.invoiceNo), kv(t.date, etDate(inv.issueDate)), kv(t.due, etDate(inv.dueDate)), kv(t.ref, inv.referenceNumber)] },
      ] },
      { text: t.buyer, style: 'h2', margin: [0, 18, 0, 4] },
      { text: inv.buyer.name, bold: true },
      ...(inv.buyer.personalCode ? [{ text: `${t.code}: ${inv.buyer.personalCode}` }] : []),
      ...(inv.buyer.email ? [{ text: inv.buyer.email }] : []),
      { text: `${t.object}: ${inv.unitAddress}`, margin: [0, 6, 0, 12] },
      {
        table: {
          widths: ['*', 80],
          body: [
            [{ text: t.desc, style: 'th' }, { text: t.sum, style: 'th', alignment: 'right' }],
            ...inv.lines.map((l) => [l.description, { text: formatEur(l.amount, locale), alignment: 'right' }]),
            [{ text: t.total, bold: true }, { text: formatEur(total, locale), bold: true, alignment: 'right' }],
          ],
        },
        layout: 'lightHorizontalLines',
      } as Content,
      { text: t.vat, style: 'small', margin: [0, 4, 0, 16] },
      { text: t.pay, style: 'h2' },
      ...(inv.paymentUrl ? [{ text: [`${t.payLink}: `, { text: inv.paymentUrl, link: inv.paymentUrl, color: '#1a56db' }] } as Content] : []),
      // Payments go through CasaPay so they reconcile automatically; the link arrives by e-mail.
      ...(inv.paymentUrl ? [] : [{ text: t.viaEmail }]),
    ],
  });
}
