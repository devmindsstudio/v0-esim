/**
 * Curated "featured" destinations for the destination-first catalogue (the
 * eSIM Packages storefront). The eTijwaal API returns all 210 countries and
 * every region flat and gives us NO imagery — so we hand-pick a small set to
 * showcase in the Local / Regional carousels and pair each with a bundled photo
 * under /public/images/destinations/<slug>.jpg.
 *
 * Nothing here is secret and it is imported by both server (the catalogue API
 * route) and client (the page), so keep it free of any credentials or 'use
 * client'/server-only code.
 */

/** A featured country, matched to the API's local_countries by ISO code. */
export interface FeaturedLocal {
  slug: string
  /** Display name (falls back to the API name once resolved). */
  name: string
  /** ISO 3166-1 alpha-2, matched against local_countries[].countryCode. */
  countryCode: string
}

/** A featured region, matched to the API's regions by name (with aliases). */
export interface FeaturedRegional {
  slug: string
  name: string
  /** Names to match against regions[].name (case/punctuation-insensitive). */
  aliases: string[]
}

// Mirrors the rows the client showed from etijwaal.com.
export const FEATURED_LOCAL: FeaturedLocal[] = [
  { slug: 'italy', name: 'Italy', countryCode: 'IT' },
  { slug: 'saudi-arabia', name: 'Saudi Arabia', countryCode: 'SA' },
  { slug: 'uae', name: 'United Arab Emirates', countryCode: 'AE' },
  { slug: 'united-states', name: 'United States', countryCode: 'US' },
  { slug: 'qatar', name: 'Qatar', countryCode: 'QA' },
  { slug: 'iraq', name: 'Iraq', countryCode: 'IQ' },
  { slug: 'bahrain', name: 'Bahrain', countryCode: 'BH' },
]

export const FEATURED_REGIONAL: FeaturedRegional[] = [
  { slug: 'asia', name: 'Asia', aliases: ['Asia'] },
  { slug: 'europe', name: 'Europe', aliases: ['Europe'] },
  { slug: 'fifa-2026', name: 'FIFA 2026', aliases: ['FIFA 2026', 'FIFA2026', 'FIFA'] },
  { slug: 'gcc', name: 'GCC', aliases: ['GCC', 'Gulf Cooperation Council'] },
  { slug: 'iraq-plus', name: 'Iraq Plus', aliases: ['Iraq Plus', 'Iraq+'] },
  {
    slug: 'middle-east-africa',
    name: 'Middle East and Africa',
    aliases: ['Middle East and Africa', 'Middle East & Africa', 'Middle East Africa'],
  },
]

export const FEATURED_GLOBAL = { slug: 'global', name: 'Global' } as const

/** Where a featured destination's bundled photo lives. */
export function destinationImage(slug: string): string {
  return `/images/destinations/${slug}.jpg`
}

/**
 * A deterministic gradient used as the card background when a destination has
 * no bundled photo (all browse-all cards, and any featured photo that failed to
 * download). Keyed by slug so the same place always gets the same colours.
 */
const GRADIENTS = [
  'linear-gradient(135deg, #0f766e 0%, #155e75 100%)',
  'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)',
  'linear-gradient(135deg, #ea580c 0%, #b91c1c 100%)',
  'linear-gradient(135deg, #0369a1 0%, #1e3a8a 100%)',
  'linear-gradient(135deg, #059669 0%, #0f766e 100%)',
  'linear-gradient(135deg, #db2777 0%, #9333ea 100%)',
  'linear-gradient(135deg, #d97706 0%, #92400e 100%)',
]

export function gradientFor(key: string): string {
  let hash = 0
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0
  return GRADIENTS[Math.abs(hash) % GRADIENTS.length]
}

/** Flag image for an ISO country code (external CDN, no key required). */
export function flagUrl(countryCode: string, width: 40 | 80 | 160 = 80): string {
  return `https://flagcdn.com/w${width}/${countryCode.toLowerCase()}.png`
}

// ---- eTijwaal-provided imagery -------------------------------------------
//
// eTijwaal returns a flag + a destination photo for every country and region
// (fields flagImage / countryImage on local_countries and regions). Using them
// keeps our storefront in sync automatically if eTijwaal updates its artwork.
// The files are served publicly from services.etijwaal.com, BUT with
// Cache-Control: max-age=0, so we never point <img> straight at them — we route
// through /api/catalogue/image, which re-serves them cached on our own origin.

/** Public host that actually serves eTijwaal's country/flag images. */
export const ETIJWAAL_IMAGE_ORIGIN = 'https://services.etijwaal.com'

/**
 * Turn a raw eTijwaal image field into a same-origin, cached proxy URL, or null
 * if there is nothing usable. Accepts the two shapes eTijwaal returns:
 *   • a display path  "/api/country/displayCountryImage?image=Asia123.png"
 *   • a bare filename "us-country.png" (older sandbox responses)
 * `kind` from the path wins; for bare filenames we infer flag vs. photo.
 */
export function etijwaalImageUrl(raw: string | null | undefined): string | null {
  if (!raw) return null

  let kind: 'flag' | 'country'
  let file: string

  const m = raw.match(/display(Flag|Country)Image\?image=([^&]+)/i)
  if (m) {
    kind = m[1].toLowerCase() === 'flag' ? 'flag' : 'country'
    file = decodeURIComponent(m[2])
  } else {
    // Bare filename — strip any leading path/query and guess by its name.
    file = raw.replace(/^.*[/=]/, '')
    kind = /flag/i.test(file) ? 'flag' : 'country'
  }

  // Only plain filenames are proxyable (matches the proxy's own guard).
  if (!file || !/^[A-Za-z0-9._-]+$/.test(file)) return null

  return `/api/catalogue/image?${new URLSearchParams({ kind, file }).toString()}`
}

/** Normalise a region name for tolerant matching against API region names. */
export function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '')
}

/**
 * Maps an API region name (normalised) to a bundled photo slug under
 * /public/images/destinations, so browse-all region tiles and the detail hero
 * show a real photo instead of a plain gradient. Regions not listed here fall
 * back to the gradient + globe treatment.
 */
const REGION_PHOTO_SLUGS: Record<string, string> = {
  asia: 'asia',
  europe: 'europe',
  fifa2026: 'fifa-2026',
  gcc: 'gcc',
  iraqplus: 'iraq-plus',
  middleeastandafrica: 'middle-east-africa',
  middleeastandnorthafrica: 'mena',
  northamerica: 'north-america',
  northernarabia: 'northern-arabia',
  southeastasia: 'south-east-asia',
  umrah: 'umrah',
}

export function regionSlug(name: string): string | undefined {
  return REGION_PHOTO_SLUGS[normalizeName(name)]
}
