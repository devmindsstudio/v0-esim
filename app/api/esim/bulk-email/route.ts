import { NextResponse } from 'next/server'
import QRCode from 'qrcode'
import { createAdminClient } from '@/lib/supabase/admin'
import { getTransporter, isEmailConfigured, MAIL_FROM } from '@/lib/email/mailer'

// nodemailer + qrcode need the Node.js runtime (not edge).
export const runtime = 'nodejs'

const BRAND = '#0f766e'
const INK = '#0f172a'
const MUTED = '#64748b'
const LINE = '#e2e8f0'
const SOFT = '#f1f5f9'

function esc(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function cardHtml(n: number, cid: string, esimNumber: string, iccid: string, activation: string): string {
  return `
  <tr><td style="padding:8px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${LINE};border-radius:12px;overflow:hidden;">
      <tr>
        <td width="150" align="center" valign="top" style="padding:16px;background:${SOFT};">
          <img src="cid:${cid}" width="110" height="110" alt="eSIM ${n} QR" style="display:block;background:#fff;border:1px solid ${LINE};border-radius:8px;padding:6px;" />
          <div style="margin-top:6px;font-size:12px;font-weight:700;color:${INK};">eSIM ${n}</div>
        </td>
        <td valign="top" style="padding:14px 16px;font-size:13px;color:${INK};line-height:1.55;">
          <div style="color:${MUTED};">eSIM number</div><div style="font-family:monospace;">${esc(esimNumber)}</div>
          <div style="color:${MUTED};margin-top:6px;">ICCID</div><div style="font-family:monospace;">${esc(iccid)}</div>
          <div style="color:${MUTED};margin-top:6px;">Activation code</div><div style="font-family:monospace;">${esc(activation)}</div>
        </td>
      </tr>
    </table>
  </td></tr>`
}

/**
 * POST /api/esim/bulk-email  { batchId }
 * Emails ALL eSIMs in a bulk batch to the buyer in ONE consolidated email
 * (each QR attached inline). The caller must own the batch. Everything is
 * looked up server-side.
 */
export async function POST(request: Request) {
  const admin = createAdminClient()

  // --- 1. Authenticate the caller ---
  const token = (request.headers.get('Authorization') ?? '').replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const {
    data: { user },
    error: userError,
  } = await admin.auth.getUser(token)
  if (userError || !user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { data: caller } = await admin
    .from('distributors')
    .select('id, email')
    .eq('auth_user_id', user.id)
    .maybeSingle()
  if (!caller) {
    return NextResponse.json({ error: 'Only distributors can send eSIMs.' }, { status: 403 })
  }

  // --- 2. Validate input ---
  const body = await request.json().catch(() => null)
  const batchId = body?.batchId
  if (typeof batchId !== 'string' || !batchId) {
    return NextResponse.json({ error: 'Missing batchId.' }, { status: 400 })
  }

  // --- 3. Orders in this batch, owned by the caller and fulfilled ---
  const { data: orders } = await admin
    .from('orders')
    .select('id, customer_id, package_title')
    .eq('batch_id', batchId)
    .eq('distributor_id', caller.id)
    .eq('status', 'fulfilled')
  if (!orders || orders.length === 0) {
    return NextResponse.json({ error: 'No eSIMs found for this batch.' }, { status: 404 })
  }

  const customerId = orders[0].customer_id
  const packageTitle = orders[0].package_title ?? 'eSIM plan'

  // --- 4. Buyer email ---
  const { data: customer } = await admin
    .from('customers')
    .select('name, email')
    .eq('id', customerId)
    .maybeSingle()
  if (!customer?.email) {
    return NextResponse.json(
      { error: 'This customer has no email on file. Add one, then try again.' },
      { status: 400 },
    )
  }

  // --- 5. eSIM credentials for the batch ---
  const orderIds = orders.map((o) => o.id)
  const { data: esims } = await admin
    .from('esims')
    .select('order_id, esim_number, iccid, qr_payload, activation_code')
    .in('order_id', orderIds)
  const list = (esims ?? []).filter((e) => e.qr_payload)
  if (list.length === 0) {
    return NextResponse.json({ error: 'No eSIMs found for this batch.' }, { status: 404 })
  }

  // --- 6. Email must be configured ---
  if (!isEmailConfigured()) {
    return NextResponse.json(
      { error: 'Email delivery is not set up yet. Ask the admin to configure the mailbox.' },
      { status: 503 },
    )
  }

  // --- 7. Build one email with all QRs attached inline ---
  try {
    const attachments: {
      filename: string
      content: Buffer
      cid: string
      contentType: string
      contentDisposition: 'inline'
    }[] = []
    const cards: string[] = []
    const textBlocks: string[] = []

    for (let i = 0; i < list.length; i++) {
      const e = list[i]
      const cid = `esimqr${i}`
      const png = await QRCode.toBuffer(e.qr_payload as string, { width: 300, margin: 2 })
      attachments.push({
        filename: `esim-${i + 1}.png`,
        content: png,
        cid,
        contentType: 'image/png',
        contentDisposition: 'inline',
      })
      cards.push(cardHtml(i + 1, cid, e.esim_number ?? '', e.iccid ?? '', e.activation_code ?? ''))
      textBlocks.push(
        [
          `eSIM ${i + 1}:`,
          `  eSIM number:     ${e.esim_number ?? ''}`,
          `  ICCID:           ${e.iccid ?? ''}`,
          `  Activation code: ${e.activation_code ?? ''}`,
        ].join('\n'),
      )
    }

    const count = list.length
    const name = esc(customer.name || 'there')
    const pkg = esc(packageTitle)
    const subject = `Your ${count} eSIMs are ready — ${packageTitle}`

    const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${SOFT};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${SOFT};padding:28px 12px;"><tr><td align="center">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:560px;max-width:100%;background:#fff;border-radius:16px;overflow:hidden;border:1px solid ${LINE};">
      <tr><td style="background:${BRAND};padding:22px 28px;"><span style="color:#fff;font-size:18px;font-weight:800;letter-spacing:.02em;">Ibara<span style="opacity:.75;font-weight:600;"> eSIM</span></span></td></tr>
      <tr><td style="padding:28px 28px 8px;">
        <div style="font-size:22px;font-weight:800;color:${INK};line-height:1.25;">Your ${count} eSIMs are ready 🎉</div>
        <div style="margin-top:8px;font-size:15px;color:#334155;line-height:1.55;">Hi ${name}, here are your <strong style="color:${INK};">${count} × ${pkg}</strong> eSIMs. Scan each QR below with your phone's camera to install it. Each QR can be used once.</div>
      </td></tr>
      <tr><td style="padding:12px 28px 4px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${cards.join('')}</table></td></tr>
      <tr><td style="padding:18px 28px 26px;">
        <div style="border-top:1px solid ${LINE};padding-top:16px;font-size:13px;color:${MUTED};line-height:1.55;">Need a hand? Just reply to this email and our team will help you get connected.</div>
        <div style="margin-top:10px;font-size:12px;color:#94a3b8;">Sent by Ibara eSIM · Please keep this email for your records.</div>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`

    const text = [
      `Your ${count} eSIMs are ready`,
      ``,
      `Hi ${customer.name || 'there'},`,
      ``,
      `Here are your ${count} x ${packageTitle} eSIMs. Scan each attached QR (esim-1.png ...) with your phone's camera to install it.`,
      ``,
      ...textBlocks,
      ``,
      `Need help? Just reply to this email.`,
      `Sent by Ibara eSIM`,
    ].join('\n')

    await getTransporter().sendMail({
      from: MAIL_FROM,
      to: customer.email,
      replyTo: caller.email || undefined,
      subject,
      html,
      text,
      attachments,
    })

    await admin.from('esims').update({ delivered_via: 'email' }).in('order_id', orderIds)

    return NextResponse.json({ ok: true, to: customer.email, count })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Could not send the email.'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
