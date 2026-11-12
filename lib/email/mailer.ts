import nodemailer from 'nodemailer'

/**
 * SMTP mail transport (server-only).
 *
 * We send eSIM emails through the sending mailbox's own SMTP server — the same
 * way Outlook/Gmail send on your behalf. No third-party email service. All
 * config comes from env vars so nothing is hard-coded and the feature stays
 * dormant until the credentials are provided:
 *
 *   SMTP_HOST     e.g. smtp.gmail.com / smtp.zoho.com / smtp.office365.com
 *   SMTP_PORT     465 (SSL) or 587 (STARTTLS)          [default 465]
 *   SMTP_USER     the mailbox login, e.g. sohaib@ibara.ai
 *   SMTP_PASS     the mailbox password / app password
 *   SMTP_SECURE   "true" | "false"                     [default: true when port 465]
 *   MAIL_FROM     display sender, default "Ibara eSIM <sohaib@ibara.ai>"
 */

/** True only when the SMTP credentials are present. */
export function isEmailConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)
}

export function getTransporter() {
  const port = Number(process.env.SMTP_PORT ?? 465)
  const secure = process.env.SMTP_SECURE
    ? process.env.SMTP_SECURE === 'true'
    : port === 465
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })
}

/** Display "from" address for outgoing eSIM emails. */
export const MAIL_FROM = process.env.MAIL_FROM ?? 'Ibara eSIM <sohaib@ibara.ai>'
