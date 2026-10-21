import { describe, expect, it } from 'vitest';
import { verifyCasaPaySignature, verifyTwentySignature } from '../src/casapay/webhook.ts';
import { hmacHex } from '../src/lib/hmac.ts';
import { eventKey } from '../src/services/casapayEvents.ts';

const secret = 'whsec_test';
const body = JSON.stringify({ event: 'gateway.session.completed', session_id: 'gwy_1' });
const now = 1_800_000_000;
const sig = `sha256=${hmacHex(secret, `${now}.${body}`)}`;

describe('CasaPay signature', () => {
  it('accepts a valid signature', () => {
    expect(verifyCasaPaySignature({ rawBody: body, timestamp: String(now), signature: sig, secret, nowSeconds: now + 10 })).toEqual({ ok: true });
  });
  it('rejects tampered body', () => {
    expect(verifyCasaPaySignature({ rawBody: body.replace('gwy_1', 'gwy_2'), timestamp: String(now), signature: sig, secret, nowSeconds: now }).ok).toBe(false);
  });
  it('rejects stale timestamp (replay)', () => {
    expect(verifyCasaPaySignature({ rawBody: body, timestamp: String(now), signature: sig, secret, nowSeconds: now + 301 })).toEqual({ ok: false, reason: 'stale timestamp' });
  });
  it('rejects missing headers and garbage', () => {
    expect(verifyCasaPaySignature({ rawBody: body, secret }).ok).toBe(false);
    expect(verifyCasaPaySignature({ rawBody: body, timestamp: String(now), signature: 'sha256=zz', secret, nowSeconds: now }).ok).toBe(false);
  });
});

describe('Twenty signature', () => {
  it('accepts valid and rejects wrong secret', () => {
    const ts = String(1_800_000_000_000);
    const s = hmacHex(secret, `${ts}:${body}`);
    expect(verifyTwentySignature({ rawBody: body, timestamp: ts, signature: s, secret, nowMs: Number(ts) })).toBe(true);
    expect(verifyTwentySignature({ rawBody: body, timestamp: ts, signature: s, secret: 'other', nowMs: Number(ts) })).toBe(false);
  });
});

describe('event idempotency keys', () => {
  it('dedupes same session+event, separates payment failure attempts', () => {
    const a = { event: 'gateway.session.completed', session_id: 's', timestamp: 't1' };
    expect(eventKey(a)).toBe(eventKey({ ...a, timestamp: 't2' }));
    const f = (n: number) => ({ event: 'gateway.payment.failed', session_id: 's', timestamp: 't', failure: { reason: 'bank_declined', code: '', message: '', retry_count: n, can_retry: true } });
    expect(eventKey(f(1))).not.toBe(eventKey(f(2)));
  });
});
