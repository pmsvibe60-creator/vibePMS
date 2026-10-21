import { config } from '../config.ts';
import { twenty, type TwentyRecord } from '../twenty/client.ts';
import { toLeaseView, type LeaseView } from './model.ts';

export const link = (url: string, label: string) => ({ primaryLinkUrl: url, primaryLinkLabel: label, secondaryLinks: [] });

export async function loadLease(id: string): Promise<{ raw: TwentyRecord; view: LeaseView }> {
  const raw = await twenty.get('leases', id, 1);
  if (!raw) throw new Error(`Lease ${id} not found`);
  return { raw, view: toLeaseView(raw, config.RENT_DUE_DAY_DEFAULT) };
}

export const updateLease = (id: string, data: Record<string, unknown>) => twenty.update('leases', id, data);
export const updateInvoice = (id: string, data: Record<string, unknown>) => twenty.update('invoices', id, data);

export async function findInvoiceBy(field: 'casapaySessionId' | 'casapayInvoiceId' | 'invoiceNo', value: string): Promise<TwentyRecord | undefined> {
  const rows = await twenty.list('invoices', { filter: `${field}[eq]:"${value.replace(/"/g, '')}"`, limit: 1 });
  return rows[0];
}

export async function noteOnLease(leaseId: string, title: string, body: string) {
  try {
    await twenty.addNote('lease', leaseId, title, body);
  } catch (e) {
    console.warn(`[note] could not add note to lease ${leaseId}: ${(e as Error).message}`);
  }
}
