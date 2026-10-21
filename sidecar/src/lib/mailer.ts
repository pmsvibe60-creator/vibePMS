import nodemailer from 'nodemailer';
import { config } from '../config.ts';

const transport = config.SMTP_HOST
  ? nodemailer.createTransport({
      host: config.SMTP_HOST,
      port: config.SMTP_PORT,
      secure: config.SMTP_PORT === 465,
      auth: config.SMTP_USER ? { user: config.SMTP_USER, pass: config.SMTP_PASSWORD } : undefined,
    })
  : null;

export type Mail = { to: string; subject: string; text: string; html?: string; attachments?: { filename: string; content: Buffer }[] };

/** Sends mail via SMTP; without SMTP configured, logs the mail so links can be copied in dev. */
export async function sendMail(mail: Mail) {
  if (!transport) {
    console.log(`[mail:dry-run] to=${mail.to} subject="${mail.subject}"\n${mail.text}`);
    return;
  }
  await transport.sendMail({
    from: config.SMTP_FROM_NAME ? `"${config.SMTP_FROM_NAME}" <${config.SMTP_FROM_ADDRESS}>` : config.SMTP_FROM_ADDRESS,
    ...mail,
  });
}
