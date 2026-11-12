/**
 * SERVER-ONLY eTijwaal Partner API client for ORDERING (Step 5 – Submit Order).
 *
 * This must never be imported into a client component — it uses the secret
 * client_signature and places real (or validated) orders. Catalogue browsing
 * still uses lib/etijwaal.ts (client-side, read-only).
 *
 * Ordering has two modes (see getOrderMode):
 *   • 'validate'    → confirms price/availability, issues NO eSIM, no charge.
 *                     Use for development (the account behaves as a sandbox).
 *   • 'transaction' → actually buys the eSIM and returns real credentials.
 *
 * The package id sent to eTijwaal is resolved by resolvePackageId(): in dev we
 * send ETIJWAAL_TEST_PACKAGE_ID (the agent-provided test package, e.g. 31565);
 * in production that env var is blank so the real catalogue id is used.
 */

const API_URL =
  process.env.ETIJWAAL_API_URL ?? 'https://partners-api.etijwaal.com/api/v1/partner'

export type OrderMode = 'validate' | 'transaction'

/** Thrown when eTijwaal rejects the request (surfaces meta.message to the UI). */
export class EtijwaalError extends Error {}

function getCreds(): { email: string; signature: string } {
  // Prefer the server-only vars. The NEXT_PUBLIC_ fallback is DEPRECATED and
  // kept only so an existing .env.local keeps working: that prefix makes Next.js
  // inline the value into the public client bundle, which leaked the partner
  // signature to every visitor. Set ETIJWAAL_EMAIL / ETIJWAAL_SIGNATURE and
  // delete the NEXT_PUBLIC_ pair; then this fallback goes unused.
  const email = process.env.ETIJWAAL_EMAIL ?? process.env.NEXT_PUBLIC_ETIJWAAL_EMAIL
  const signature =
    process.env.ETIJWAAL_SIGNATURE ?? process.env.NEXT_PUBLIC_ETIJWAAL_SIGNATURE
  if (!email || !signature) {
    throw new EtijwaalError('eTijwaal credentials are not configured on the server.')
  }
  return { email, signature }
}

/** Whether we place REAL orders. Defaults to 'validate' (safe/dev). */
export function getOrderMode(): OrderMode {
  return process.env.ETIJWAAL_ORDER_MODE === 'transaction' ? 'transaction' : 'validate'
}

/**
 * The package id to send to eTijwaal. In dev, ETIJWAAL_TEST_PACKAGE_ID overrides
 * the real catalogue id (the sandbox only issues specific test packages). In
 * production leave it blank so the distributor's chosen package is used.
 */
export function resolvePackageId(realPackageId: number): number {
  const test = process.env.ETIJWAAL_TEST_PACKAGE_ID?.trim()
  if (test) {
    const n = Number(test) // eTijwaal requires a numeric package_id
    if (Number.isFinite(n)) return n
  }
  return realPackageId
}

// The auth token is valid ~1 year and /auth is rate-limited (~1/min), so cache
// it in the module. Kept modest (12h) to tolerate restarts/rotation.
let cachedToken: { token: string; expiresAt: number } | null = null

export async function getEtijwaalToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.token

  const { email, signature } = getCreds()
  const form = new FormData()
  form.append('email', email)
  form.append('client_signature', signature)

  const res = await fetch(`${API_URL}/auth`, {
    method: 'POST',
    headers: { Accept: 'application/json' },
    body: form,
  })
  const json = await res.json().catch(() => null)
  const token = json?.data?.access_token
  if (!res.ok || !token) {
    throw new EtijwaalError(json?.meta?.message ?? `eTijwaal auth failed (${res.status}).`)
  }
  cachedToken = { token, expiresAt: Date.now() + 12 * 60 * 60 * 1000 }
  return token
}

// ---- Catalogue (read-only) -----------------------------------------------
//
// The same live catalogue the admin/distributor pages browse, fetched SERVER
// SIDE so credentials never reach the client. Used by the destination-first
// eSIM Packages storefront (app/dashboard/packages) via /api/catalogue.

export type CatalogueType = 'global' | 'local' | 'regional'

export interface EtijwaalLocation {
  id: number
  type: string
  name: string
  countryCode?: string
  /**
   * Image paths eTijwaal returns for this country/region, e.g.
   * "/api/country/displayFlagImage?image=Asia1699454511030.png". They are served
   * (publicly, no auth) from services.etijwaal.com — see lib/featured-destinations
   * etijwaalImageUrl(), which turns these into our cached same-origin proxy URLs.
   */
  flagImage?: string
  countryImage?: string
}

export interface EtijwaalPrice {
  currency_code: string
  rate: string
}

export interface EtijwaalCataloguePackage {
  id: number
  title: string
  dataMB: number
  day: number
  location: string
  is_unlimited: number
  tether_hotspot: number
  rechargeability: number
  throttle: number
  throttle_speed: string | null
  price: EtijwaalPrice[]
}

async function getCatalogueJSON(path: string): Promise<unknown> {
  const token = await getEtijwaalToken()
  const res = await fetch(`${API_URL}/${path}`, {
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new EtijwaalError(`eTijwaal request failed (${res.status}): ${path}`)
  return res.json()
}

export async function fetchCountries(): Promise<EtijwaalLocation[]> {
  const json = (await getCatalogueJSON('local_countries')) as {
    data?: { local_countries?: EtijwaalLocation[] }
  }
  return json?.data?.local_countries ?? []
}

export async function fetchRegions(): Promise<EtijwaalLocation[]> {
  const json = (await getCatalogueJSON('regions')) as { data?: { regions?: EtijwaalLocation[] } }
  return json?.data?.regions ?? []
}

export async function fetchCurrencies(): Promise<
  { currency_code: string; currency_name: string }[]
> {
  const json = (await getCatalogueJSON('currencies')) as {
    data?: { currencies?: { currency_code: string; currency_name: string }[] }
  }
  return json?.data?.currencies ?? []
}

export async function fetchCataloguePackages(opts: {
  type: CatalogueType
  id: number | null
  currencyCodes: string[]
}): Promise<EtijwaalCataloguePackage[]> {
  const token = await getEtijwaalToken()
  const params = new URLSearchParams({
    type: opts.type,
    plan_type: 'data',
    currency_codes: opts.currencyCodes.join(','),
  })
  // Global needs no location id; local/regional require one.
  if (opts.type !== 'global' && opts.id != null) params.set('id', String(opts.id))

  const res = await fetch(`${API_URL}/packages?${params.toString()}`, {
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
  })
  const json = (await res.json().catch(() => null)) as {
    meta?: { message?: string }
    data?: { packages?: EtijwaalCataloguePackage[] }
  } | null

  // A destination with no plans replies 400 "Package not available" — a normal
  // empty result, not a failure.
  if (json?.meta?.message === 'Package not available') return []
  if (!res.ok) throw new EtijwaalError(`eTijwaal packages request failed (${res.status}).`)
  return json?.data?.packages ?? []
}

/** The lowest USD rate across a package list, or null if none are priced in USD. */
export function minUsdRate(packages: EtijwaalCataloguePackage[]): number | null {
  let min: number | null = null
  for (const pkg of packages) {
    const usd = pkg.price.find((p) => p.currency_code === 'USD')
    if (!usd) continue
    const rate = parseFloat(usd.rate)
    if (!Number.isFinite(rate)) continue
    if (min == null || rate < min) min = rate
  }
  return min
}

export interface EtijwaalEsim {
  iccid: string
  smdpAddress: string | null
  matchingId: string | null
  /** Full LPA activation string, e.g. "LPA:1$lpa.etijwaal.com$TEST" — QR content. */
  activationCode: string | null
  qrCodeUrl: string | null
  appleInstallationUrl: string | null
  apnType: string | null
  apnValue: string | null
}

export interface EtijwaalOrderResult {
  valid: boolean
  status: string // 'validated' (validate) | 'completed' (transaction)
  providerOrderId: string | null // eTijwaal order id, e.g. "POI_E_..."
  providerPackageId: number | null // the package id eTijwaal actually fulfilled
  esim: EtijwaalEsim | null // null for validate
  price: number | null
  currency: string | null
  message: string
}

/**
 * Submit an eSIM order to eTijwaal. Throws EtijwaalError if the API rejects it
 * (e.g. "You Don't Have Enough Balance") so the caller can refund + surface it.
 */
export async function submitEsimOrder(opts: {
  mode: OrderMode
  packageId: number
  currencyCode: string
  orderReferenceId: string
  customer: { firstName: string; lastName: string; email: string }
}): Promise<EtijwaalOrderResult> {
  const token = await getEtijwaalToken()

  const res = await fetch(`${API_URL}/orders`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      type: opts.mode,
      order_type: 'esim',
      package_id: opts.packageId,
      currency_code: opts.currencyCode,
      order_reference_id: opts.orderReferenceId,
      customer: {
        first_name: opts.customer.firstName,
        last_name: opts.customer.lastName,
        email: opts.customer.email,
      },
    }),
  })

  const json = await res.json().catch(() => null)
  const data = json?.data
  const message: string = json?.meta?.message ?? ''

  if (!res.ok || !data || data.valid === false) {
    throw new EtijwaalError(message || `eTijwaal order failed (${res.status}).`)
  }

  const raw = data.order?.esim ?? null
  const esim: EtijwaalEsim | null = raw
    ? {
        iccid: raw.iccid ?? '',
        smdpAddress: raw.smdpAddress ?? null,
        matchingId: raw.matchingId ?? null,
        activationCode: raw.activationCode ?? null,
        qrCodeUrl: raw.qrCodeUrl ?? null,
        appleInstallationUrl: raw.direct_apple_installation_url ?? null,
        apnType: raw.apnType ?? null,
        apnValue: raw.apnValue ?? null,
      }
    : null

  return {
    valid: !!data.valid,
    status: data.status ?? '',
    providerOrderId: data.order?.id ?? null,
    providerPackageId: data.order?.package?.id ?? null,
    esim,
    price: data.order_total?.price ?? null,
    currency: data.order_total?.currency ?? null,
    message,
  }
}
