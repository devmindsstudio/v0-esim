/**
 * Client-safe types + formatting helpers for catalogue plan data. Shared by the
 * destination detail view (plan selector) so price/data rendering stays
 * consistent. No server-only imports here — safe for client components.
 */

export interface PlanPrice {
  currency_code: string
  rate: string
}

export interface Plan {
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
  price: PlanPrice[]
}

export function formatMoney(code: string, rate: string | number): string {
  const value = typeof rate === 'number' ? rate : parseFloat(rate)
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: code }).format(value)
  } catch {
    return `${code} ${value}`
  }
}

/** The numeric price for a currency, or null if the plan isn't priced in it. */
export function priceValue(plan: Plan, code: string): number | null {
  const entry = plan.price.find((p) => p.currency_code === code)
  if (!entry) return null
  const value = parseFloat(entry.rate)
  return Number.isFinite(value) ? value : null
}

/** Formatted price for a currency, or "—" when unavailable. */
export function priceLabel(plan: Plan, code: string): string {
  const value = priceValue(plan, code)
  return value == null ? '—' : formatMoney(code, value)
}

/** Trim to at most 2 decimals so float noise is gone but a genuine fractional
 *  size is still shown truthfully: 3 → "3", 1.5 → "1.5", 19.77 → "19.77". */
function trimDecimals(n: number): string {
  return Number(n.toFixed(2)).toString()
}

/** eTijwaal package titles lead with the human-readable size, e.g.
 *  "1.5GB Data for 7Days" or "500MB Data for 3Days". That label is the most
 *  reliable size source: the dataMB field is inconsistent (sometimes binary —
 *  1536 for 1.5 GB — and sometimes plain wrong — 20240 for a 20 GB plan), so we
 *  prefer the title and only fall back to dataMB when the title has no size. */
function sizeFromTitle(title?: string): string | null {
  if (!title) return null
  const m = title.match(/(\d+(?:\.\d+)?)\s*(TB|GB|MB)\b/i)
  return m ? `${trimDecimals(Number(m[1]))} ${m[2].toUpperCase()}` : null
}

export function formatData(dataMB: number, isUnlimited: number, title?: string): string {
  if (isUnlimited) return 'Unlimited'

  // Prefer the size printed in the package title — it's what the provider means.
  const fromTitle = sizeFromTitle(title)
  if (fromTitle) return fromTitle

  // Fallback (title has no size): derive from dataMB. The catalogue encodes MB
  // inconsistently (decimal 1 GB = 1000 MB, or binary 1 GB = 1024 MB), so show
  // whichever base yields a (near-)whole number; otherwise a truthful decimal.
  if (dataMB < 1000) return `${trimDecimals(dataMB)} MB`
  const dec = dataMB / 1000
  const bin = dataMB / 1024
  const decErr = Math.abs(dec - Math.round(dec))
  const binErr = Math.abs(bin - Math.round(bin))
  if (Math.min(decErr, binErr) <= 0.05) {
    return `${Math.round(binErr < decErr ? bin : dec)} GB`
  }
  return `${trimDecimals(dec)} GB`
}

/** Lowest price (formatted) across a set of plans in the given currency. */
export function startingPriceLabel(plans: Plan[], code: string): string | null {
  let min: number | null = null
  for (const plan of plans) {
    const v = priceValue(plan, code)
    if (v == null) continue
    if (min == null || v < min) min = v
  }
  return min == null ? null : formatMoney(code, min)
}
