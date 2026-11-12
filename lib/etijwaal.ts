'use client'

/**
 * Client-side TYPES and pure helpers for the eTijwaal package catalogue.
 *
 * This module deliberately contains NO credentials and makes NO calls to
 * eTijwaal. It used to authenticate from the browser using
 * NEXT_PUBLIC_ETIJWAAL_EMAIL / NEXT_PUBLIC_ETIJWAAL_SIGNATURE — but the
 * NEXT_PUBLIC_ prefix makes Next.js inline those values into the public client
 * bundle, so the partner signature was readable by anyone who opened the site.
 *
 * Catalogue reads now go through our own auth-gated routes, which keep the
 * credentials server side:
 *   • GET /api/catalogue/destinations  → countries, regions, currencies
 *   • GET /api/catalogue/packages      → plans for one destination
 * The server-side client lives in lib/etijwaal-server.ts.
 */

export type PackageType = 'global' | 'local' | 'regional'

export interface PriceEntry {
  currency_code: string
  rate: string
}

export interface EtijwaalLocation {
  id: number
  type: string
  name: string
  countryCode?: string
}

export interface EtijwaalPackage {
  id: number
  title: string
  dataMB: number
  day: number
  location: string
  is_unlimited: number
  tether_hotspot: number
  rechargeability: number
  price: PriceEntry[]
}

/** The package's USD price as a number, or null if it isn't priced in USD. */
export function getUsdPrice(pkg: EtijwaalPackage): number | null {
  const entry = pkg.price.find((p) => p.currency_code === 'USD')
  if (!entry) return null
  const value = parseFloat(entry.rate)
  return Number.isFinite(value) ? value : null
}

// Data-size formatting lives in catalogue-format (client-safe, no server
// imports) so this module and the storefront always format identically — a
// past divergence between the two caused inconsistent sizes.
export { formatData } from './catalogue-format'
