import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  fetchCountries,
  fetchRegions,
  fetchCurrencies,
  fetchCataloguePackages,
  minUsdRate,
  EtijwaalError,
  type EtijwaalLocation,
} from '@/lib/etijwaal-server'
import {
  FEATURED_LOCAL,
  FEATURED_REGIONAL,
  FEATURED_GLOBAL,
  normalizeName,
  etijwaalImageUrl,
} from '@/lib/featured-destinations'

/** eTijwaal flag + photo proxy URLs for a resolved location (either may be null). */
function imagesFor(loc: EtijwaalLocation | null | undefined) {
  return {
    flag: etijwaalImageUrl(loc?.flagImage),
    photo: etijwaalImageUrl(loc?.countryImage),
  }
}

// Outbound fetch to eTijwaal → Node runtime, always run (we do our own caching).
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export interface FeaturedDestination {
  slug: string
  name: string
  /** Resolved eTijwaal id (country/region). Global has none. */
  id: number | null
  countryCode?: string
  /** Cheapest package price in USD, or null if unpriced/unavailable. */
  fromUSD: number | null
  /** eTijwaal flag / photo proxy URLs (null when eTijwaal has none). */
  flag: string | null
  photo: string | null
}

interface DestinationsPayload {
  featured: {
    local: FeaturedDestination[]
    regional: FeaturedDestination[]
    global: FeaturedDestination | null
  }
  countries: {
    id: number
    name: string
    countryCode?: string
    flag: string | null
    photo: string | null
  }[]
  regions: { id: number; name: string; flag: string | null; photo: string | null }[]
  currencies: { currency_code: string; currency_name: string }[]
}

// Featured prices need one /packages call per destination — cache the whole
// payload in module memory so we don't re-hit eTijwaal on every page view.
let cache: { at: number; data: DestinationsPayload } | null = null
const TTL_MS = 15 * 60 * 1000

async function priceFor(type: 'local' | 'regional' | 'global', id: number | null) {
  try {
    const pkgs = await fetchCataloguePackages({ type, id, currencyCodes: ['USD'] })
    return minUsdRate(pkgs)
  } catch {
    // A single destination failing (rate limit, no plans) must not sink the row.
    return null
  }
}

async function buildPayload(): Promise<DestinationsPayload> {
  const [countries, regions, currencies] = await Promise.all([
    fetchCountries(),
    fetchRegions(),
    fetchCurrencies(),
  ])

  const byCode = new Map<string, EtijwaalLocation>()
  for (const c of countries) if (c.countryCode) byCode.set(c.countryCode.toUpperCase(), c)

  const regionByName = new Map<string, EtijwaalLocation>()
  for (const r of regions) regionByName.set(normalizeName(r.name), r)

  // Resolve each featured entry to a real id, then fetch its "from" price.
  const local = await Promise.all(
    FEATURED_LOCAL.map(async (f): Promise<FeaturedDestination | null> => {
      const match = byCode.get(f.countryCode.toUpperCase())
      if (!match) return null
      return {
        slug: f.slug,
        name: f.name,
        id: match.id,
        countryCode: f.countryCode,
        fromUSD: await priceFor('local', match.id),
        ...imagesFor(match),
      }
    }),
  )

  const regional = await Promise.all(
    FEATURED_REGIONAL.map(async (f): Promise<FeaturedDestination | null> => {
      const match = f.aliases.map((a) => regionByName.get(normalizeName(a))).find(Boolean)
      if (!match) return null
      return {
        slug: f.slug,
        name: match.name || f.name,
        id: match.id,
        fromUSD: await priceFor('regional', match.id),
        ...imagesFor(match),
      }
    }),
  )

  const global: FeaturedDestination = {
    slug: FEATURED_GLOBAL.slug,
    name: FEATURED_GLOBAL.name,
    id: null,
    fromUSD: await priceFor('global', null),
    // eTijwaal has no "global" location, so this always falls back to our bundled
    // global photo / gradient in the UI.
    flag: null,
    photo: null,
  }

  return {
    featured: {
      local: local.filter((d): d is FeaturedDestination => d !== null),
      regional: regional.filter((d): d is FeaturedDestination => d !== null),
      global,
    },
    countries: countries.map((c) => ({
      id: c.id,
      name: c.name,
      countryCode: c.countryCode,
      ...imagesFor(c),
    })),
    regions: regions.map((r) => ({ id: r.id, name: r.name, ...imagesFor(r) })),
    currencies,
  }
}

export async function GET(request: Request) {
  // Lightweight auth: any signed-in portal user. Keeps our eTijwaal quota from
  // being hit by anonymous callers; the data itself is the public catalogue.
  const admin = createAdminClient()
  const token = (request.headers.get('Authorization') ?? '').replace('Bearer ', '')
  const {
    data: { user },
  } = token ? await admin.auth.getUser(token) : { data: { user: null } }
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  try {
    if (!cache || Date.now() - cache.at > TTL_MS) {
      cache = { at: Date.now(), data: await buildPayload() }
    }
    return NextResponse.json(cache.data)
  } catch (e) {
    const message =
      e instanceof EtijwaalError ? e.message : 'Could not load the catalogue from eTijwaal.'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
