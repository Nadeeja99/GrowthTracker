// Sending email (password reset links), behind a small interface so the
// provider can be swapped and tests can capture messages. Both providers are a
// single HTTP call, so no SDK is needed.
import fs from 'fs/promises';
import path from 'path';
import { env } from '../config/env';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface Mailer {
  send(message: MailMessage): Promise<void>;
}

class MailError extends Error {
  constructor(provider: string, status: number, body: string) {
    super(`${provider} rejected the email (${status}): ${body.slice(0, 300)}`);
    this.name = 'MailError';
  }
}

async function post(provider: string, url: string, headers: Record<string, string>, body: unknown) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new MailError(provider, response.status, await response.text().catch(() => ''));
}

// Brevo: free tier sends from a single verified sender address (no domain needed).
const brevo = (apiKey: string, from: string): Mailer => ({
  send: m => post('Brevo', 'https://api.brevo.com/v3/smtp/email', { 'api-key': apiKey }, {
    sender: { email: from, name: env.MAIL_FROM_NAME },
    to: [{ email: m.to }],
    subject: m.subject,
    textContent: m.text,
    htmlContent: m.html,
  }),
});

// Resend: needs a verified domain to email anyone other than yourself.
const resend = (apiKey: string, from: string): Mailer => ({
  send: m => post('Resend', 'https://api.resend.com/emails', { Authorization: `Bearer ${apiKey}` }, {
    from: `${env.MAIL_FROM_NAME} <${from}>`,
    to: [m.to],
    subject: m.subject,
    text: m.text,
    html: m.html,
  }),
});

// For automated tests: each email becomes a JSON file the test can read.
const outbox = (dir: string): Mailer => ({
  async send(m) {
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`), JSON.stringify(m));
  },
});

let override: Mailer | null | undefined;

/** The configured mailer, or null when email is turned off. */
export function getMailer(): Mailer | null {
  if (override !== undefined) return override;
  switch (env.MAIL_PROVIDER) {
    case 'brevo': return brevo(env.MAIL_API_KEY!, env.MAIL_FROM!);
    case 'resend': return resend(env.MAIL_API_KEY!, env.MAIL_FROM!);
    case 'outbox': return outbox(env.MAIL_OUTBOX_DIR!);
    default: return null;
  }
}

/** Tests only: replace the mailer (`undefined` restores the configured one). */
export function setMailerForTests(mailer: Mailer | null | undefined): void {
  override = mailer;
}

const escapeHtml = (text: string) =>
  text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** The "reset your password" email, in plain text and simple, brand-coloured HTML. */
export function passwordResetEmail(to: string, name: string | null, link: string, minutes: number): MailMessage {
  const greeting = name ? `Hi ${name},` : 'Hi,';
  const text = [
    greeting,
    '',
    'Someone (hopefully you) asked to reset the password for your GrowthTracker account.',
    `Open this link to choose a new password. It works once and expires in ${minutes} minutes:`,
    '',
    link,
    '',
    "If you didn't ask for this, ignore this email. Your password stays the same.",
  ].join('\n');

  const html = `<!doctype html>
<html><body style="margin:0;padding:24px;background:#fafaf9;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#121214">
  <table role="presentation" width="100%" style="max-width:480px;margin:0 auto;background:#ffffff;border:1px solid #e4e4e7;border-radius:12px">
    <tr><td style="padding:28px">
      <p style="margin:0 0 20px;font-size:18px;font-weight:600">GrowthTracker</p>
      <p style="margin:0 0 12px">${escapeHtml(greeting)}</p>
      <p style="margin:0 0 20px;line-height:1.5">Someone (hopefully you) asked to reset the password for your account. The link works once and expires in ${minutes} minutes.</p>
      <p style="margin:0 0 24px"><a href="${escapeHtml(link)}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:600;padding:10px 18px;border-radius:8px">Choose a new password</a></p>
      <p style="margin:0 0 8px;font-size:13px;color:#52525b;line-height:1.5">Button not working? Paste this into your browser:<br><span style="word-break:break-all">${escapeHtml(link)}</span></p>
      <p style="margin:16px 0 0;font-size:13px;color:#52525b">If you didn't ask for this, ignore this email. Your password stays the same.</p>
    </td></tr>
  </table>
</body></html>`;

  return { to, subject: 'Reset your GrowthTracker password', text, html };
}
