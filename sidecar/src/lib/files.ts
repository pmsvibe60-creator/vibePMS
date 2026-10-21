import fs from 'node:fs/promises';
import path from 'node:path';
import { config, requireSetting } from '../config.ts';
import { hmacHex, safeEqualHex } from './hmac.ts';

/**
 * PDFs (contracts, invoices) are stored on the sidecar volume and served through
 * HMAC-signed URLs. CasaPay fetches invoice PDFs via `document_url`, and Twenty
 * records link to them, so the links must work without a login.
 */
const root = path.resolve(config.FILES_DIR);

function safeName(name: string) {
  if (!/^[\w.\-/]+$/.test(name) || name.includes('..')) throw new Error(`Bad file name: ${name}`);
  return name;
}

export async function saveFile(name: string, data: Buffer): Promise<string> {
  const p = path.join(root, safeName(name));
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, data);
  return name;
}

export const readFile = (name: string) => fs.readFile(path.join(root, safeName(name)));

const signingKey = () => requireSetting('ADMIN_TOKEN') + ':files';

/** Long-lived signed link. `exp` is unix seconds; default 2 years. */
export function signedFileUrl(name: string, ttlSeconds = 60 * 60 * 24 * 730): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const sig = hmacHex(signingKey(), `${name}.${exp}`);
  return `${config.PUBLIC_URL}/files/${name}?exp=${exp}&sig=${sig}`;
}

export function verifyFileSignature(name: string, exp: string, sig: string): boolean {
  if (!/^\d+$/.test(exp) || Number(exp) < Date.now() / 1000) return false;
  return safeEqualHex(hmacHex(signingKey(), `${name}.${exp}`), sig);
}
