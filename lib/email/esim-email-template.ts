/**
 * Renders the eSIM delivery email as an inline-styled HTML string.
 * The QR image is referenced by content-id (cid:esimqr) and attached separately
 * by the send route, so it renders reliably across mail clients.
 */

export interface EsimEmailData {
  packageTitle: string
  customerName: string
  esimNumber: string
  iccid: string
  qrPayload: string
  activationCode: string
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** LPA:1$<smdp-address>$<matching-id> → { smdp, matchingId } for manual install. */
function parseLpa(qrPayload: string): { smdp: string; matchingId: string } {
  const parts = qrPayload.split('$')
  return { smdp: parts[1] ?? '', matchingId: parts[2] ?? '' }
}

const BRAND = '#0f766e'
const INK = '#0f172a'
const MUTED = '#64748b'
const LINE = '#e2e8f0'
const SOFT = '#f1f5f9'

export function renderEsimEmail(
  data: EsimEmailData,
): { subject: string; html: string; text: string } {
  const { smdp, matchingId } = parseLpa(data.qrPayload)
  const name = escapeHtml(data.customerName || 'there')
  const pkg = escapeHtml(data.packageTitle || 'eSIM plan')

  const subject = `Your eSIM is ready — ${data.packageTitle || 'eSIM plan'}`

  const detailRow = (label: string, value: string, last = false) => `
    <tr>
      <td style="padding:12px 14px;${last ? '' : `border-bottom:1px solid ${LINE};`}color:${MUTED};font-size:13px;">${label}</td>
      <td style="padding:12px 14px;${last ? '' : `border-bottom:1px solid ${LINE};`}text-align:right;font-family:'SFMono-Regular',Consolas,monospace;font-size:13px;color:${INK};letter-spacing:.02em;">${value}</td>
    </tr>`

  const step = (n: number, text: string) => `
    <tr>
      <td valign="top" style="width:30px;padding:0 10px 14px 0;">
        <div style="width:26px;height:26px;line-height:26px;text-align:center;border-radius:50%;background:${BRAND};color:#ffffff;font-size:13px;font-weight:700;">${n}</div>
      </td>
      <td valign="top" style="padding:2px 0 14px 0;font-size:14px;color:${INK};line-height:1.45;">${text}</td>
    </tr>`

  const html = `<!doctype html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${SOFT};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Your ${pkg} eSIM is ready — scan the QR to install it in minutes.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${SOFT};padding:28px 12px;">
    <tr><td align="center">
      <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="width:520px;max-width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(15,23,42,.08);border:1px solid ${LINE};">

        <!-- Header -->
        <tr><td style="background:${BRAND};padding:22px 28px;">
          <span style="color:#ffffff;font-size:18px;font-weight:800;letter-spacing:.02em;">Ibara<span style="opacity:.75;font-weight:600;"> eSIM</span></span>
        </td></tr>

        <!-- Hero -->
        <tr><td style="padding:28px 28px 8px;">
          <div style="font-size:22px;font-weight:800;color:${INK};line-height:1.25;">Your eSIM is ready 🎉</div>
          <div style="margin-top:8px;font-size:15px;color:#334155;line-height:1.55;">
            Hi ${name}, your <strong style="color:${INK};">${pkg}</strong> is activated and ready to install. Scan the QR code below with your phone's camera.
          </div>
        </td></tr>

        <!-- QR card -->
        <tr><td style="padding:20px 28px 8px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${SOFT};border:1px solid ${LINE};border-radius:14px;">
            <tr><td align="center" style="padding:22px;">
              <img src="cid:esimqr" width="220" height="220" alt="eSIM QR code" style="display:block;background:#ffffff;border:1px solid ${LINE};border-radius:12px;padding:12px;" />
              <div style="margin-top:12px;font-size:13px;color:${MUTED};">Point your camera here, then tap the pop-up to add the eSIM.</div>
            </td></tr>
          </table>
        </td></tr>

        <!-- Install steps -->
        <tr><td style="padding:22px 28px 4px;">
          <div style="font-size:13px;font-weight:700;color:${INK};text-transform:uppercase;letter-spacing:.04em;margin-bottom:14px;">How to install</div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            ${step(1, "Open <strong>Settings → Cellular / Mobile Data</strong> on your phone.")}
            ${step(2, "Tap <strong>Add eSIM</strong> (or <strong>Add Data Plan</strong>) and choose <strong>Use QR Code</strong>.")}
            ${step(3, "Scan the code above and follow the prompts. Turn on data roaming for this plan when you arrive.")}
          </table>
        </td></tr>

        <!-- eSIM details -->
        <tr><td style="padding:8px 28px 4px;">
          <div style="font-size:13px;font-weight:700;color:${INK};text-transform:uppercase;letter-spacing:.04em;margin-bottom:10px;">Your eSIM details</div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${LINE};border-radius:10px;overflow:hidden;">
            ${detailRow('eSIM number', escapeHtml(data.esimNumber))}
            ${detailRow('ICCID', escapeHtml(data.iccid))}
            ${detailRow('Activation code', escapeHtml(data.activationCode), true)}
          </table>
        </td></tr>

        <!-- Manual install -->
        <tr><td style="padding:18px 28px 4px;">
          <div style="font-size:13px;font-weight:700;color:${INK};text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px;">Can't scan? Enter it manually</div>
          <div style="font-size:13px;color:#334155;line-height:1.55;margin-bottom:10px;">Choose <strong>Enter details manually</strong> when adding the eSIM, then use:</div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${LINE};border-radius:10px;overflow:hidden;">
            ${detailRow('SM-DP+ address', escapeHtml(smdp))}
            ${detailRow('Activation / matching ID', escapeHtml(matchingId), true)}
          </table>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:22px 28px 26px;">
          <div style="border-top:1px solid ${LINE};padding-top:16px;font-size:13px;color:${MUTED};line-height:1.55;">
            Need a hand? Just reply to this email and our team will help you get connected.
          </div>
          <div style="margin-top:10px;font-size:12px;color:#94a3b8;">Sent by Ibara eSIM · Please keep this email for your records.</div>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`

  // Plain-text alternative — required for good deliverability (HTML-only mail
  // is a strong spam signal). Clients that prefer text see this version.
  const text = [
    `Your eSIM is ready`,
    ``,
    `Hi ${data.customerName || 'there'},`,
    ``,
    `Your ${data.packageTitle || 'eSIM plan'} is activated and ready to install.`,
    `Scan the attached QR code (esim-qr.png) with your phone's camera, or add it manually.`,
    ``,
    `How to install:`,
    `  1. Open Settings > Cellular / Mobile Data.`,
    `  2. Tap Add eSIM (or Add Data Plan) and choose "Use QR Code".`,
    `  3. Scan the QR and follow the prompts. Turn on data roaming for this plan when you arrive.`,
    ``,
    `Your eSIM details:`,
    `  eSIM number:     ${data.esimNumber}`,
    `  ICCID:           ${data.iccid}`,
    `  Activation code: ${data.activationCode}`,
    ``,
    `Can't scan? Enter it manually:`,
    `  SM-DP+ address:            ${smdp}`,
    `  Activation / matching ID:  ${matchingId}`,
    ``,
    `Need help? Just reply to this email.`,
    ``,
    `Sent by Ibara eSIM`,
  ].join('\n')

  return { subject, html, text }
}
