import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateDemoEsim } from '@/lib/esim'
import {
  submitEsimOrder,
  getOrderMode,
  resolvePackageId,
  EtijwaalError,
} from '@/lib/etijwaal-server'

// Outbound fetch (eTijwaal) + Math.random (demo) → Node runtime.
export const runtime = 'nodejs'

/**
 * POST /api/orders
 * Distributor/sub-distributor places a booking. Charge-first saga (eTijwaal has
 * no cancel endpoint, so we never leave a purchase we can't undo):
 *   1. reserve_order() — debit wallet, create a 'pending' order
 *   2. eTijwaal Submit Order (validate in dev / transaction in prod)
 *   3a. success → finalize_order() with the eSIM (real, or demo in validate mode)
 *   3b. failure → refund_order() and surface the error
 *
 * Body: { customerId, packageId, packageTitle, currency, unitPrice }
 *   packageId is the REAL catalogue id (stored + used in prod). In dev the id
 *   actually sent to eTijwaal is overridden by ETIJWAAL_TEST_PACKAGE_ID.
 */
export async function POST(request: Request) {
  const admin = createAdminClient()

  // --- 1. Authenticate the caller (must be a distributor row) ---
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
    .select('id, role')
    .eq('auth_user_id', user.id)
    .maybeSingle()
  if (!caller) {
    return NextResponse.json({ error: 'Only distributors can place orders.' }, { status: 403 })
  }

  // --- 2. Validate the input ---
  const body = await request.json().catch(() => null)
  if (!body) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  const { customerId, packageId, packageTitle, currency, unitPrice, batchId, salePrice } = body
  // Optional: groups eSIMs issued together in one bulk batch.
  const batch = typeof batchId === 'string' && batchId ? batchId : null
  const price = Number(unitPrice)
  // Price charged to the end customer (for "real profit" = sale − cost). The UI
  // sends it prefilled with the cost; we store it best-effort and never let it
  // block issuing the eSIM.
  const saleNum = Number(salePrice)
  const salePriceToStore = Number.isFinite(saleNum) && saleNum > 0 ? saleNum : null
  if (
    typeof customerId !== 'string' ||
    typeof packageTitle !== 'string' ||
    !Number.isFinite(price) ||
    price <= 0
  ) {
    return NextResponse.json({ error: 'Missing or invalid order details.' }, { status: 400 })
  }
  const realPackageId = Number(packageId)
  if (!Number.isInteger(realPackageId)) {
    return NextResponse.json({ error: 'Invalid package.' }, { status: 400 })
  }
  // eTijwaal prices in USD to match our USD wallet; ignore any other currency.
  const currencyCode = 'USD'

  // --- 3. Load the customer (name + email for eTijwaal) and confirm ownership ---
  const { data: customer } = await admin
    .from('customers')
    .select('name, email, distributor_id')
    .eq('id', customerId)
    .maybeSingle()
  if (!customer || customer.distributor_id !== caller.id) {
    return NextResponse.json({ error: 'Customer not found for this distributor.' }, { status: 404 })
  }
  if (!customer.email) {
    return NextResponse.json(
      { error: 'This customer has no email on file. Add one before ordering.' },
      { status: 400 },
    )
  }
  // eTijwaal rejects names containing special characters, so keep only letters,
  // digits and spaces. A single-word name (e.g. "saybi") has no surname, so we
  // reuse the first name rather than a placeholder symbol like "-" (rejected).
  const cleanName = String(customer.name ?? '')
    .replace(/[^\p{L}\p{N} ]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const nameParts = cleanName.split(/\s+/).filter(Boolean)
  const firstName = nameParts[0] || 'Customer'
  const lastName = nameParts.slice(1).join(' ') || firstName

  // --- 4. Reserve: debit the wallet + create a pending order (atomic) ---
  const { data: reserved, error: reserveErr } = await admin.rpc('reserve_order', {
    p_distributor_id: caller.id,
    p_customer_id: customerId,
    p_package_id: realPackageId,
    p_package_title: packageTitle,
    p_currency: currencyCode,
    p_price: price,
    p_batch_id: batch,
  })
  if (reserveErr || !reserved) {
    // e.g. "Insufficient balance" or "Customer does not belong to this distributor"
    return NextResponse.json({ error: reserveErr?.message ?? 'Could not place the order.' }, { status: 400 })
  }
  const orderId: string = reserved.orderId

  // Store the retail sale price on the order (best-effort — never block the
  // eSIM over reporting data; if the sale_price column isn't there yet the
  // error is simply ignored).
  if (salePriceToStore != null) {
    await admin.from('orders').update({ sale_price: salePriceToStore }).eq('id', orderId)
  }

  // --- 5. Provision with eTijwaal (validate in dev, transaction in prod) ---
  const mode = getOrderMode()
  let result
  try {
    result = await submitEsimOrder({
      mode,
      packageId: resolvePackageId(realPackageId),
      currencyCode,
      orderReferenceId: orderId,
      customer: { firstName, lastName, email: customer.email },
    })
  } catch (e: unknown) {
    // Provisioning failed → give the money back and surface the reason.
    await admin.rpc('refund_order', {
      p_order_id: orderId,
      p_reason: e instanceof Error ? e.message : 'eTijwaal order failed',
    })
    const msg = e instanceof EtijwaalError ? e.message : 'Could not issue the eSIM. Your wallet was not charged.'
    return NextResponse.json({ error: msg }, { status: 502 })
  }

  // --- 6. Work out the eSIM credentials to store ---
  //   transaction → real eSIM from eTijwaal
  //   validate     → demo eSIM so the flow completes with a scannable QR
  let esim: {
    esimNumber: string
    iccid: string
    qrPayload: string
    activationCode: string
    smdpAddress: string | null
    matchingId: string | null
    qrCodeUrl: string | null
    appleUrl: string | null
  }

  if (mode === 'transaction') {
    if (!result.esim) {
      await admin.rpc('refund_order', { p_order_id: orderId, p_reason: 'eTijwaal returned no eSIM' })
      return NextResponse.json(
        { error: 'eTijwaal did not return an eSIM. Your wallet was not charged.' },
        { status: 502 },
      )
    }
    esim = {
      esimNumber: result.providerOrderId ?? result.esim.iccid,
      iccid: result.esim.iccid,
      qrPayload: result.esim.activationCode ?? '',
      activationCode: result.esim.matchingId ?? result.esim.activationCode ?? '',
      smdpAddress: result.esim.smdpAddress,
      matchingId: result.esim.matchingId,
      qrCodeUrl: result.esim.qrCodeUrl,
      appleUrl: result.esim.appleInstallationUrl,
    }
  } else {
    const demo = generateDemoEsim()
    esim = {
      esimNumber: demo.esimNumber,
      iccid: demo.iccid,
      qrPayload: demo.qrPayload,
      activationCode: demo.activationCode,
      smdpAddress: null,
      matchingId: null,
      qrCodeUrl: null,
      appleUrl: null,
    }
  }

  // --- 7. Finalize: attach the eSIM + mark the order fulfilled ---
  const { data: finalized, error: finalErr } = await admin.rpc('finalize_order', {
    p_order_id: orderId,
    p_esim_number: esim.esimNumber,
    p_iccid: esim.iccid,
    p_qr_payload: esim.qrPayload,
    p_activation_code: esim.activationCode,
    p_smdp_address: esim.smdpAddress,
    p_matching_id: esim.matchingId,
    p_qr_code_url: esim.qrCodeUrl,
    p_apple_url: esim.appleUrl,
    p_provider_order_ref: result.providerOrderId,
    p_provider_status: mode === 'transaction' ? 'completed' : 'validated',
    p_provider_package_id: result.providerPackageId,
    p_actor_user_id: user.id,
    p_actor_role: caller.role,
  })
  if (finalErr || !finalized) {
    // The eSIM was provisioned but we couldn't save it. Don't refund (the
    // purchase is real in transaction mode) — surface so it can be reconciled.
    return NextResponse.json(
      { error: 'eSIM issued but could not be saved. Contact support with this order.', orderId },
      { status: 500 },
    )
  }

  return NextResponse.json(
    {
      order: { orderId, walletBalance: reserved.walletBalance, total: reserved.total },
      esim: {
        esimNumber: esim.esimNumber,
        iccid: esim.iccid,
        qrPayload: esim.qrPayload,
        activationCode: esim.activationCode,
      },
      mode,
    },
    { status: 201 },
  )
}
