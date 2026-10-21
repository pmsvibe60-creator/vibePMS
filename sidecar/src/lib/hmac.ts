import crypto from 'node:crypto';

export const hmacHex = (secret: string, message: string) =>
  crypto.createHmac('sha256', secret).update(message).digest('hex');

export function safeEqualHex(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'hex');
  const bb = Buffer.from(b, 'hex');
  return ab.length === bb.length && ab.length > 0 && crypto.timingSafeEqual(ab, bb);
}

export const sha256 = (data: Buffer | string) => crypto.createHash('sha256').update(data).digest('hex');

export const randomToken = (bytes = 24) => crypto.randomBytes(bytes).toString('base64url');
