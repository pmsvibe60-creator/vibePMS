import { hmacHex, safeEqualHex } from '../lib/hmac.ts';

/**
 * X-CasaPay-Signature: sha256=hex(HMAC_SHA256(secret, `${timestamp}.${rawBody}`)),
 * X-CasaPay-Timestamp: unix seconds. Rejects timestamps more than 5 minutes off.
 */
export function verifyCasaPaySignature(opts: {
  rawBody: string; timestamp?: string; signature?: string; secret: string; nowSeconds?: number; toleranceSeconds?: number;
}): { ok: true } | { ok: false; reason: string } {
  const { rawBody, timestamp, signature, secret } = opts;
  if (!timestamp || !signature) return { ok: false, reason: 'missing headers' };
  if (!/^\d+$/.test(timestamp)) return { ok: false, reason: 'bad timestamp' };
  const now = opts.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (Math.abs(now - Number(timestamp)) > (opts.toleranceSeconds ?? 300)) return { ok: false, reason: 'stale timestamp' };
  const received = signature.replace(/^sha256=/, '');
  const expected = hmacHex(secret, `${timestamp}.${rawBody}`);
  return safeEqualHex(expected, received) ? { ok: true } : { ok: false, reason: 'signature mismatch' };
}

/** Twenty: X-Twenty-Webhook-Signature = hex(HMAC_SHA256(secret, `${timestamp}:${rawBody}`)), timestamp in ms. */
export function verifyTwentySignature(opts: { rawBody: string; timestamp?: string; signature?: string; secret: string; nowMs?: number }) {
  const { rawBody, timestamp, signature, secret } = opts;
  if (!timestamp || !signature) return false;
  const now = opts.nowMs ?? Date.now();
  if (!/^\d+$/.test(timestamp) || Math.abs(now - Number(timestamp)) > 5 * 60_000) return false;
  return safeEqualHex(hmacHex(secret, `${timestamp}:${rawBody}`), signature);
}
