import { randomUUID } from 'node:crypto';
import type { Content } from 'pdfmake/interfaces';
import { config } from '../config.ts';
import { nextCounter, query } from '../db.ts';
import { readFile, saveFile, signedFileUrl } from '../lib/files.ts';
import { randomToken, sha256 } from '../lib/hmac.ts';
import { sendMail } from '../lib/mailer.ts';
import { leaseContent, leaseNumber, renderLeasePdf, renderSignedLeasePdf, type SignatureEntry } from '../pdf/lease.ts';
import { validateLeaseForSigning, type LeaseView } from './model.ts';
import { link, loadLease, noteOnLease, updateLease } from './twentyRecords.ts';

const SIGNING_TTL_DAYS = 30;

export type SigningRequest = {
  token: string; lease_id: string; role: 'tenant' | 'landlord'; signer_name: string; signer_email: string;
  document_id: string; status: string; signed_name: string | null; signature_png: string | null;
  signed_at: Date | null; ip: string | null; user_agent: string | null; expires_at: Date;
};

export type LeaseDocument = { id: string; lease_id: string; content: Content[]; file: string; sha256: string; signed_file: string | null };

export async function getDocument(id: string): Promise<LeaseDocument> {
  const { rows } = await query<LeaseDocument>(`SELECT * FROM lease_documents WHERE id = $1`, [id]);
  if (!rows[0]) throw new Error(`Document ${id} not found`);
  return rows[0];
}

export async function getSigningRequest(token: string): Promise<SigningRequest | undefined> {
  const { rows } = await query<SigningRequest>(`SELECT * FROM signing_requests WHERE token = $1`, [token]);
  return rows[0];
}

const signUrl = (token: string) => `${config.PUBLIC_URL}/sign/${token}`;

async function createRequest(leaseId: string, role: 'tenant' | 'landlord', name: string, email: string, documentId: string) {
  const token = randomToken();
  await query(
    `INSERT INTO signing_requests (token, lease_id, role, signer_name, signer_email, document_id, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, now() + ($7 || ' days')::interval)`,
    [token, leaseId, role, name, email, documentId, String(SIGNING_TTL_DAYS)],
  );
  return token;
}

function inviteMail(l: LeaseView, role: 'tenant' | 'landlord', url: string) {
  const unit = l.unit?.address ?? '';
  return { subject: `Lease agreement to sign – ${unit}`, text: `Hello${role === 'tenant' ? ` ${l.tenant?.firstName ?? ''}` : ''},\n\n${config.OWNER_NAME} has sent you a residential lease agreement (${unit}) to sign.\n\nOpen the link to review and sign:\n${url}\n\nThe link is valid for ${SIGNING_TTL_DAYS} days.\n\nKind regards,\n${config.OWNER_NAME}` };
}

/** Lease → READY_TO_SIGN: snapshot the contract, hash it, and e-mail the tenant a signing link. */
export async function sendForSigning(leaseId: string): Promise<{ ok: boolean; errors?: string[]; url?: string }> {
  const { raw, view } = await loadLease(leaseId);
  const errors = validateLeaseForSigning(view);
  if (errors.length) {
    await updateLease(leaseId, { leaseStatus: 'DRAFT' });
    await noteOnLease(leaseId, 'Cannot send for signing', errors.map((e) => `- ${e}`).join('\n'));
    return { ok: false, errors };
  }

  if (!view.referenceBase) {
    view.referenceBase = String(await nextCounter('lease_reference', 101));
    await updateLease(leaseId, { referenceBase: view.referenceBase });
  }

  // Void any earlier unsigned requests for this lease.
  await query(`UPDATE signing_requests SET status = 'superseded' WHERE lease_id = $1 AND status = 'pending'`, [leaseId]);

  const content = await leaseContent(view);
  const pdf = await renderLeasePdf(view, content);
  const docId = randomUUID();
  const file = await saveFile(`contracts/${leaseId}/${docId}.pdf`, pdf);
  const hash = sha256(pdf);
  await query(`INSERT INTO lease_documents (id, lease_id, content, file, sha256) VALUES ($1, $2, $3, $4, $5)`,
    [docId, leaseId, JSON.stringify(content), file, hash]);

  const token = await createRequest(leaseId, 'tenant', view.tenant!.name, view.tenant!.email, docId);
  const url = signUrl(token);
  await sendMail({ to: view.tenant!.email, ...inviteMail(view, 'tenant', url) });

  await updateLease(leaseId, {
    signingStatus: 'SENT',
    signingLink: link(url, 'Tenant signing link'),
    contract: link(signedFileUrl(file), `Lease ${leaseNumber(view)} (unsigned)`),
    name: raw.name || `${view.unit?.name ?? 'Unit'} – ${view.tenant?.name ?? 'Tenant'}`,
  });
  return { ok: true, url };
}

/** Records a signature; when the tenant signs the landlord is invited, when both signed the PDF is sealed. */
export async function submitSignature(token: string, input: { signedName: string; signaturePng: string; ip: string; userAgent: string }) {
  const req = await getSigningRequest(token);
  if (!req || req.status !== 'pending') throw new Error('This signing link is no longer valid.');
  if (new Date(req.expires_at) < new Date()) throw new Error('This signing link has expired.');
  if (!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(input.signaturePng) || input.signaturePng.length > 400_000)
    throw new Error('Invalid signature image.');
  if (input.signedName.trim().length < 3) throw new Error('Please type your full name.');

  const { rowCount } = await query(
    `UPDATE signing_requests SET status = 'signed', signed_name = $2, signature_png = $3, signed_at = now(), ip = $4, user_agent = $5
     WHERE token = $1 AND status = 'pending'`,
    [token, input.signedName.trim(), input.signaturePng, input.ip, input.userAgent.slice(0, 500)],
  );
  if (!rowCount) throw new Error('This signing link is no longer valid.');

  const { view } = await loadLease(req.lease_id);
  if (req.role === 'tenant') {
    const landlordEmail = config.OWNER_EMAIL;
    const landlordToken = await createRequest(req.lease_id, 'landlord', config.OWNER_REPRESENTATIVE || config.OWNER_NAME, landlordEmail, req.document_id);
    const url = signUrl(landlordToken);
    await updateLease(req.lease_id, { signingStatus: 'TENANT_SIGNED', signingLink: link(url, 'Landlord countersign link') });
    if (landlordEmail) await sendMail({ to: landlordEmail, subject: `Countersign lease – ${view.unit?.address ?? ''}`, text: `${view.tenant?.name} signed the lease.\n\nCountersign here:\n${url}` });
    await noteOnLease(req.lease_id, 'Tenant signed', `${input.signedName} signed at ${new Date().toISOString()} from ${input.ip}. Countersign: ${url}`);
    return { completed: false };
  }

  await sealLease(req.lease_id, req.document_id);
  return { completed: true };
}

async function sealLease(leaseId: string, documentId: string) {
  const { view } = await loadLease(leaseId);
  const doc = await getDocument(documentId);
  const { rows } = await query<SigningRequest>(
    `SELECT * FROM signing_requests WHERE document_id = $1 AND status = 'signed' ORDER BY signed_at`, [documentId]);
  const sigs: SignatureEntry[] = rows.map((r) => ({
    role: r.role, name: r.signer_name, signedName: r.signed_name!, email: r.signer_email, signedAt: new Date(r.signed_at!),
    ip: r.ip ?? '', userAgent: r.user_agent ?? '', signaturePng: r.signature_png!,
  }));
  // Integrity check: the stored unsigned PDF must still match the hash the signers saw.
  const original = await readFile(doc.file);
  if (sha256(original) !== doc.sha256) throw new Error(`Contract file for lease ${leaseId} was modified after sending`);

  const signed = await renderSignedLeasePdf(view, doc.content, doc.sha256, sigs);
  const signedFile = await saveFile(`contracts/${leaseId}/${documentId}-signed.pdf`, signed);
  await query(`UPDATE lease_documents SET signed_file = $2 WHERE id = $1`, [documentId, signedFile]);

  await updateLease(leaseId, {
    signingStatus: 'COMPLETED',
    signedAt: new Date().toISOString(),
    leaseStatus: 'SIGNED',
    contract: link(signedFileUrl(signedFile), `Lease ${leaseNumber(view)} (signed)`),
    signingLink: link('', ''),
  });

  const attachment = { filename: `lease-${leaseNumber(view)}.pdf`, content: signed };
  const subject = `Signed lease agreement – ${view.unit?.address ?? ''}`;
  const text = 'Hello,\n\nAttached is the lease agreement signed by both parties. You will shortly receive a separate e-mail with a link to make the first payment.\n';
  if (view.tenant?.email) await sendMail({ to: view.tenant.email, subject, text, attachments: [attachment] });
  if (config.OWNER_EMAIL) await sendMail({ to: config.OWNER_EMAIL, subject, text: 'Lease fully signed. CasaPay activation follows automatically.', attachments: [attachment] });
}
