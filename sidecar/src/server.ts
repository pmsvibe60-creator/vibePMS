import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import { casapay } from './casapay/client.ts';
import { verifyCasaPaySignature, verifyTwentySignature } from './casapay/webhook.ts';
import { config } from './config.ts';
import { migrate, query } from './db.ts';
import { startScheduler, runJob, JOBS } from './jobs.ts';
import { readFile, verifyFileSignature } from './lib/files.ts';
import { safeEqualHex, hmacHex } from './lib/hmac.ts';
import { messagePage, signPageHtml } from './routes/signPage.ts';
import { activateLease, createRentInvoice, voidInvoice } from './services/billing.ts';
import { eventKey, handleCasaPayEvent, type CasaPayEvent } from './services/casapayEvents.ts';
import { getDocument, getSigningRequest, sendForSigning, submitSignature } from './services/signing.ts';
import { loadLease } from './services/twentyRecords.ts';
import { provisionSchema } from './twenty/schema.ts';
import { retryStartup } from './lib/retry.ts';
import { runFinanceTool } from './finance/service.ts';
import { toolDefinitions } from './finance/contracts.ts';
import { handleTwentyEvent } from './services/twentyEvents.ts';

declare module 'fastify' { interface FastifyRequest { rawBody?: string } }

const app = Fastify({ logger: { level: 'info' }, trustProxy: true, bodyLimit: 1_000_000 });

app.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
  req.rawBody = body as string;
  try { done(null, body ? JSON.parse(body as string) : {}); } catch (e) { done(e as Error, undefined); }
});

const clientIp = (req: FastifyRequest) => (req.headers['cf-connecting-ip'] as string) || req.ip;

function requireAdmin(req: FastifyRequest, reply: FastifyReply) {
  const token = (req.headers.authorization ?? '').replace(/^Bearer /, '');
  const expected = config.ADMIN_TOKEN;
  if (!expected || !token || !safeEqualHex(hmacHex('cmp', token), hmacHex('cmp', expected))) {
    reply.code(401).send({ error: 'unauthorized' });
    return false;
  }
  return true;
}

app.get('/health', async () => ({ ok: true }));

// ---------- Signing (public, token-protected) ----------
app.get<{ Params: { token: string } }>('/sign/:token', async (req, reply) => {
  const r = await getSigningRequest(req.params.token);
  reply.type('text/html');
  if (!r) return reply.code(404).send(messagePage('Not found', 'This signing link is invalid.'));
  if (r.status === 'signed') return messagePage('Already signed', 'This document has already been signed with this link.');
  if (r.status !== 'pending' || new Date(r.expires_at) < new Date()) return reply.code(410).send(messagePage('Link expired', 'Please ask the landlord for a new signing link.'));
  const doc = await getDocument(r.document_id);
  const { view } = await loadLease(r.lease_id);
  return signPageHtml({ token: r.token, lang: view.language, signerName: r.signer_name, role: r.role, sha256: doc.sha256 });
});

app.get<{ Params: { token: string } }>('/sign/:token/document.pdf', async (req, reply) => {
  const r = await getSigningRequest(req.params.token);
  if (!r || (r.status !== 'pending' && r.status !== 'signed')) return reply.code(404).send();
  const doc = await getDocument(r.document_id);
  reply.header('Content-Type', 'application/pdf').header('Content-Disposition', 'inline; filename="lease.pdf"');
  return readFile(doc.file);
});

app.post<{ Params: { token: string }; Body: { signedName?: string; signaturePng?: string; consent?: boolean } }>('/sign/:token', async (req, reply) => {
  if (!req.body?.consent) return reply.code(400).send({ error: 'Consent is required.' });
  try {
    const res = await submitSignature(req.params.token, {
      signedName: String(req.body.signedName ?? ''), signaturePng: String(req.body.signaturePng ?? ''),
      ip: clientIp(req), userAgent: String(req.headers['user-agent'] ?? ''),
    });
    return { ok: true, ...res };
  } catch (e) {
    req.log.warn(e);
    return reply.code(400).send({ error: (e as Error).message });
  }
});

// ---------- Files (HMAC-signed links) ----------
app.get<{ Params: { '*': string }; Querystring: { exp?: string; sig?: string } }>('/files/*', async (req, reply) => {
  const name = req.params['*'];
  if (!verifyFileSignature(name, req.query.exp ?? '', req.query.sig ?? '')) return reply.code(403).send('Forbidden');
  const casapayInvoice = name.match(/^casapay-invoice\/(\d+)$/);
  if (casapayInvoice) {
    // CasaPay document URLs expire: fetch a fresh one on every click.
    const d = await casapay.invoiceDocument(casapayInvoice[1], 15);
    return reply.redirect(d.document_url);
  }
  try {
    const data = await readFile(name);
    reply.header('Content-Type', name.endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream');
    reply.header('Content-Disposition', `inline; filename="${name.split('/').pop()}"`);
    return data;
  } catch {
    return reply.code(404).send('Not found');
  }
});

// ---------- Payment return pages (display only; webhook is authoritative) ----------
app.get('/pay/done', async (_req, reply) => reply.type('text/html').send(messagePage('Thank you', 'Your payment is being processed. You will receive a confirmation by e-mail.')));
app.get('/pay/cancelled', async (_req, reply) => reply.type('text/html').send(messagePage('Payment cancelled', 'No payment was made. You can use the link in your e-mail to try again.')));

// ---------- Webhooks ----------
async function recordAndProcess(source: string, key: string, payload: unknown, fn: () => Promise<void>) {
  const ins = await query(`INSERT INTO webhook_events (source, event_key, payload) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING RETURNING event_key`, [source, key, JSON.stringify(payload)]);
  if (!ins.rowCount) {
    const prev = await query(`SELECT processed_at, error FROM webhook_events WHERE source = $1 AND event_key = $2`, [source, key]);
    if (prev.rows[0]?.processed_at || !prev.rows[0]?.error) return; // duplicate or in flight
  }
  // Ack fast; do the work after responding.
  setImmediate(async () => {
    try {
      await fn();
      await query(`UPDATE webhook_events SET processed_at = now(), error = NULL WHERE source = $1 AND event_key = $2`, [source, key]);
    } catch (e) {
      app.log.error({ err: e, key }, `${source} webhook processing failed`);
      await query(`UPDATE webhook_events SET error = $3 WHERE source = $1 AND event_key = $2`, [source, key, String((e as Error).message).slice(0, 2000)]);
    }
  });
}

app.post('/webhooks/casapay', async (req, reply) => {
  const secret = config.CASAPAY_WEBHOOK_SECRET;
  if (!secret) return reply.code(503).send({ error: 'webhook secret not configured' });
  const v = verifyCasaPaySignature({
    rawBody: req.rawBody ?? '', secret,
    timestamp: req.headers['x-casapay-timestamp'] as string | undefined,
    signature: req.headers['x-casapay-signature'] as string | undefined,
  });
  if (!v.ok) { req.log.warn(`casapay webhook rejected: ${v.reason}`); return reply.code(401).send({ error: v.reason }); }
  const event = req.body as CasaPayEvent;
  await recordAndProcess('casapay', eventKey(event), event, () => handleCasaPayEvent(event));
  return { received: true };
});

app.post('/webhooks/twenty', async (req, reply) => {
  const secret = config.TWENTY_WEBHOOK_SECRET;
  if (!secret) return reply.code(503).send({ error: 'webhook secret not configured' });
  if (!verifyTwentySignature({
    rawBody: req.rawBody ?? '', secret,
    timestamp: req.headers['x-twenty-webhook-timestamp'] as string | undefined,
    signature: req.headers['x-twenty-webhook-signature'] as string | undefined,
  })) return reply.code(401).send({ error: 'bad signature' });
  const body = req.body as any;
  const nonce = (req.headers['x-twenty-webhook-nonce'] as string) || `${body?.eventName}:${body?.record?.id}:${body?.eventDate}`;
  await recordAndProcess('twenty', nonce, { eventName: body?.eventName, id: body?.record?.id, updatedFields: body?.updatedFields }, () => handleTwentyEvent(body));
  return { received: true };
});

// ---------- Finance tools (one self-hosted workspace, admin token required) ----------
app.post<{ Params: { name: string } }>('/admin/finance/:name', async (req, reply) => {
  if (!requireAdmin(req, reply)) return;
  if (!toolDefinitions.some(tool => tool.name === req.params.name)) return reply.code(404).send({ error: 'Unknown finance tool' });
  try { return await runFinanceTool(req.params.name, req.body ?? {}); }
  catch (error) {
    const message = error instanceof Error ? error.message : 'Finance operation failed';
    // No transaction contents or credentials in application logs.
    return reply.code(400).send({ error: message });
  }
});

// ---------- Admin actions (callable from Twenty workflows "HTTP request" steps) ----------
app.post<{ Params: { id: string } }>('/admin/leases/:id/send-for-signing', async (req, reply) => {
  if (!requireAdmin(req, reply)) return;
  return sendForSigning(req.params.id);
});
app.post<{ Params: { id: string } }>('/admin/leases/:id/activate', async (req, reply) => {
  if (!requireAdmin(req, reply)) return;
  return activateLease(req.params.id);
});
app.post<{ Params: { id: string }; Querystring: { period?: string } }>('/admin/leases/:id/rent-invoice', async (req, reply) => {
  if (!requireAdmin(req, reply)) return;
  const now = new Date();
  const [y, m] = (req.query.period ?? `${now.getFullYear()}-${now.getMonth() + 1}`).split('-').map(Number);
  return createRentInvoice(req.params.id, y, m);
});
app.post<{ Params: { id: string }; Body: { note?: string } }>('/admin/invoices/:id/void', async (req, reply) => {
  if (!requireAdmin(req, reply)) return;
  return voidInvoice(req.params.id, req.body?.note);
});
app.post<{ Params: { name: string } }>('/admin/jobs/:name', async (req, reply) => {
  if (!requireAdmin(req, reply)) return;
  if (!(req.params.name in JOBS)) return reply.code(404).send({ error: `unknown job; one of ${Object.keys(JOBS).join(', ')}` });
  return runJob(req.params.name as keyof typeof JOBS);
});
app.post<{ Body: { cover_amount: number; first_payment_amount?: number } }>('/admin/pricing-preview', async (req, reply) => {
  if (!requireAdmin(req, reply)) return;
  return casapay.pricingPreview({ ...req.body, currency: 'EUR' });
});

async function main() {
  await retryStartup(migrate, attempt => app.log.warn({ attempt }, 'Waiting for database initialization'));
  if (config.AUTO_SETUP && config.TWENTY_API_KEY) {
    await retryStartup(
      () => provisionSchema(message => app.log.info(message)),
      attempt => app.log.warn({ attempt }, 'Retrying Twenty schema setup'),
    );
  }
  startScheduler(app.log);
  await app.listen({ host: '0.0.0.0', port: config.PORT });
}

main().catch((e) => { console.error(e); process.exit(1); });
