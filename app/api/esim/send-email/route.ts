import { NextResponse } from 'next/server'
import QRCode from 'qrcode'
import { createAdminClient } from '@/lib/supabase/admin'
import { getTransporter, isEmailConfigured, MAIL_FROM } from '@/lib/email/mailer'
import { renderEsimEmail } from '@/lib/email/esim-email-template'

// nodemailer + qrcode need the Node.js runtime (not edge).
export const runtime = 'nodejs'

/**
 * POST /api/esim/send-email  { orderId }
 * Emails the eSIM (QR + details) to the order's customer, FROM the configured
 * mailbox. The caller must be the distributor/sub-distributor who placed the
 * order. Everything (customer email, eSIM credentials) is looked up server-side
 * — nothing sensitive is trusted from the browser.
 */
export async function POST(request: Request) {
  const admin = createAdminClient()

  // --- 1. Authenticate the caller ---
  const token = (request.headers.get('Authorization') ?? '').replace('Bearer ', '')
  if (!token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  const {
    data: { user },
    error: userError,
  } = await admin.auth.getUser(token)
  if (userError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { data: caller } = await admin
    .from('distributors')
    .select('id, email')
    .eq('auth_user_id', user.id)
    .maybeSingle()
  if (!caller) {
    return NextResponse.json(
      { error: 'Only distributors can send eSIMs.' },
      { status: 403 },
    )
  }

  // --- 2. Validate input ---
  const body = await request.json().catch(() => null)
  const orderId = body?.orderId
  if (typeof orderId !== 'string' || !orderId) {
    return NextResponse.json({ error: 'Missing orderId.' }, { status: 400 })
  }

  // --- 3. Load the order and confirm the caller owns it ---
  const { data: order } = await admin
    .from('orders')
    .select('id, distributor_id, customer_id, package_title')
    .eq('id', orderId)
    .maybeSingle()
  if (!order) {
    return NextResponse.json({ error: 'Order not found.' }, { status: 404 })
  }
  if (order.distributor_id !== caller.id) {
    return NextResponse.json({ error: 'This order is not yours.' }, { status: 403 })
  }

  // --- 4. Customer email ---
  const { data: customer } = await admin
    .from('customers')
    .select('name, email')
    .eq('id', order.customer_id)
    .maybeSingle()
  if (!customer?.email) {
    return NextResponse.json(
      { error: 'This customer has no email on file. Add one, then try again.' },
      { status: 400 },
    )
  }

  // --- 5. eSIM credentials ---
  const { data: esim } = await admin
    .from('esims')
    .select('esim_number, iccid, qr_payload, activation_code')
    .eq('order_id', orderId)
    .maybeSingle()
  if (!esim?.qr_payload) {
    return NextResponse.json({ error: 'No eSIM found for this order.' }, { status: 404 })
  }

  // --- 6. Email must be configured (graceful, so demo never breaks) ---
  if (!isEmailConfigured()) {
    return NextResponse.json(
      { error: 'Email delivery is not set up yet. Ask the admin to configure the mailbox.' },
      { status: 503 },
    )
  }

  // --- 7. Build the QR PNG + email, then send ---
  try {
    const qrPng = await QRCode.toBuffer(esim.qr_payload, { width: 320, margin: 2 })

    const { subject, html, text } = renderEsimEmail({
      packageTitle: order.package_title ?? 'eSIM',
      customerName: customer.name ?? '',
      esimNumber: esim.esim_number ?? '',
      iccid: esim.iccid ?? '',
      qrPayload: esim.qr_payload,
      activationCode: esim.activation_code ?? '',
    })

    await getTransporter().sendMail({
      from: MAIL_FROM,
      to: customer.email,
      replyTo: caller.email || undefined,
      subject,
      html,
      text,
      attachments: [
        {
          filename: 'esim-qr.png',
          content: qrPng,
          cid: 'esimqr',
          contentType: 'image/png',
          contentDisposition: 'inline',
        },
      ],
    })

    // Record how it was delivered.
    await admin.from('esims').update({ delivered_via: 'email' }).eq('order_id', orderId)

    return NextResponse.json({ ok: true, to: customer.email })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Could not send the email.'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
