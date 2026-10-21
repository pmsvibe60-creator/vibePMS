import { activateLease } from './billing.ts';
import { sendForSigning } from './signing.ts';
import { withLock } from '../lib/lock.ts';
import { query } from '../db.ts';

/**
 * Reacts to Twenty record changes (Settings → APIs & Webhooks → webhook to /webhooks/twenty).
 * Lease status is the operator's "button":
 *   READY_TO_SIGN → generate contract + e-mail signing link
 *   SIGNED        → create CasaPay checkout for move-in (also fires after e-signing completes)
 *   CANCELLED     → void pending signing links
 */
export async function handleTwentyEvent(body: any) {
  const name: string = body?.eventName ?? '';
  const record = body?.record;
  if (!record?.id || !/^lease\.(created|updated)$/.test(name)) return;
  if (name === 'lease.updated' && Array.isArray(body.updatedFields) && !body.updatedFields.includes('leaseStatus')) return;

  switch (record.leaseStatus) {
    case 'READY_TO_SIGN':
      if (['NOT_SENT', 'DECLINED', null, undefined].includes(record.signingStatus)) {
        await withLock(`sign:${record.id}`, () => sendForSigning(record.id));
      }
      return;
    case 'SIGNED':
      await activateLease(record.id);
      return;
    case 'CANCELLED':
      await query(`UPDATE signing_requests SET status = 'cancelled' WHERE lease_id = $1 AND status = 'pending'`, [record.id]);
      return;
  }
}
