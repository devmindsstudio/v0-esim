'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2, AlertCircle, RefreshCw, Search, Globe, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'
import { regionSlug } from '@/lib/featured-destinations'
import { DestinationCard } from '@/components/catalogue/destination-card'
import { DestinationCarousel } from '@/components/catalogue/destination-carousel'
import { DestinationHero } from '@/components/catalogue/destination-hero'
import { PlanSelector } from '@/components/catalogue/plan-selector'
import { startingPriceLabel, type Plan } from '@/lib/catalogue-format'

const FALLBACK_CURRENCIES = ['USD', 'AED', 'BHD', 'GBP', 'SAR', 'EUR']
// Countries shown before "View all" — roughly two rows on a wide screen.
const COUNTRY_PREVIEW = 10

interface FeaturedDestination {
  slug: string
  name: string
  id: number | null
  countryCode?: string
  fromUSD: number | null
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

type Selection = {
  type: 'local' | 'regional' | 'global'
  id: number | null
  name: string
  slug?: string
  countryCode?: string
  isRegion?: boolean
  /** eTijwaal photo / flag proxy URLs, threaded to the detail hero. */
  apiPhoto?: string | null
  apiFlag?: string | null
}

async function authHeader(): Promise<Record<string, string>> {
  const supabase = createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  return { Authorization: `Bearer ${session?.access_token ?? ''}` }
}

interface CatalogueExplorerProps {
  /** When set, each plan's detail panel shows an action button (distributor). */
  onOrder?: (plan: Plan) => void
  orderLabel?: string
}

export function CatalogueExplorer({ onOrder, orderLabel }: CatalogueExplorerProps) {
  const [data, setData] = useState<DestinationsPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [selected, setSelected] = useState<Selection | null>(null)
  const [plans, setPlans] = useState<Plan[]>([])
  const [plansLoading, setPlansLoading] = useState(false)
  const [plansError, setPlansError] = useState('')

  const [displayCurrency, setDisplayCurrency] = useState('USD')
  const [search, setSearch] = useState('')
  const [showAllCountries, setShowAllCountries] = useState(false)

  async function loadDestinations() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/catalogue/destinations', { headers: await authHeader() })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Could not load the catalogue.')
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDestinations()
  }, [])

  async function openDestination(sel: Selection) {
    setSelected(sel)
    setPlans([])
    setPlansError('')
    setPlansLoading(true)
    try {
      const params = new URLSearchParams({ type: sel.type })
      if (sel.type !== 'global' && sel.id != null) params.set('id', String(sel.id))
      const res = await fetch(`/api/catalogue/packages?${params.toString()}`, {
        headers: await authHeader(),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Could not load packages.')
      setPlans(json.packages ?? [])
    } catch (e) {
      setPlansError(e instanceof Error ? e.message : 'Something went wrong.')
    } finally {
      setPlansLoading(false)
    }
  }

  const currencyOptions = useMemo(
    () =>
      data && data.currencies.length > 0
        ? data.currencies.map((c) => c.currency_code)
        : FALLBACK_CURRENCIES,
    [data],
  )

  const matchedCountries = useMemo(() => {
    if (!data) return []
    const q = search.trim().toLowerCase()
    if (!q) return data.countries
    return data.countries.filter((c) => c.name.toLowerCase().includes(q))
  }, [data, search])

  const isSearching = search.trim().length > 0
  const visibleCountries =
    isSearching || showAllCountries ? matchedCountries : matchedCountries.slice(0, COUNTRY_PREVIEW)
  const canExpand = !isSearching && matchedCountries.length > COUNTRY_PREVIEW

  // ---- Detail view (a destination is selected) ----------------------------
  if (selected) {
    return (
      <div className="space-y-6">
        <DestinationHero
          name={selected.name}
          slug={selected.slug}
          countryCode={selected.countryCode}
          isRegion={selected.isRegion}
          apiPhoto={selected.apiPhoto}
          apiFlag={selected.apiFlag}
          startingPrice={plans.length > 0 ? startingPriceLabel(plans, displayCurrency) : null}
          onBack={() => setSelected(null)}
        />

        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-bold tracking-tight">Select Your Plan</h2>
          <div className="flex items-center gap-2">
            <span className="hidden text-xs font-medium text-muted-foreground sm:inline">
              Show price in
            </span>
            <Select value={displayCurrency} onValueChange={setDisplayCurrency}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {currencyOptions.map((code) => (
                  <SelectItem key={code} value={code}>
                    {code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {plansLoading && (
          <div className="flex flex-col items-center justify-center gap-3 py-24">
            <Loader2 className="size-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Fetching packages from eTijwaal…</p>
          </div>
        )}
        {!plansLoading && plansError && (
          <div className="flex flex-col items-center justify-center gap-3 py-24">
            <AlertCircle className="size-8 text-destructive" />
            <p className="text-sm font-medium text-destructive">{plansError}</p>
            <Button variant="outline" size="sm" onClick={() => openDestination(selected)}>
              Try again
            </Button>
          </div>
        )}
        {!plansLoading && !plansError && (
          <PlanSelector
            packages={plans}
            displayCurrency={displayCurrency}
            onOrder={onOrder}
            orderLabel={orderLabel}
          />
        )}
      </div>
    )
  }

  // ---- Browse view (choose a destination) ---------------------------------
  return (
    <div className="space-y-8">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Choose Your <span className="text-primary">Destination</span>
        </h1>
        <p className="max-w-xl text-sm text-muted-foreground">
          Pick where you&apos;re travelling first, then choose a data plan that fits.
        </p>
        <Button
          variant="ghost"
          size="sm"
          className="mt-1 text-muted-foreground"
          onClick={loadDestinations}
          disabled={loading}
        >
          <RefreshCw className={`mr-1.5 size-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center gap-3 py-24">
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading destinations from eTijwaal…</p>
        </div>
      )}
      {!loading && error && (
        <div className="flex flex-col items-center justify-center gap-3 py-24">
          <AlertCircle className="size-8 text-destructive" />
          <p className="text-sm font-medium text-destructive">{error}</p>
          <Button variant="outline" size="sm" onClick={loadDestinations}>
            Try again
          </Button>
        </div>
      )}

      {!loading && !error && data && (
        <>
          {data.featured.local.length > 0 && (
            <DestinationCarousel title="Local eSIMs plan">
              {data.featured.local.map((d) => (
                <DestinationCard
                  key={d.slug}
                  variant="featured"
                  name={d.name}
                  imageSlug={d.slug}
                  countryCode={d.countryCode}
                  apiPhoto={d.photo}
                  apiFlag={d.flag}
                  fromUSD={d.fromUSD}
                  onClick={() =>
                    openDestination({
                      type: 'local',
                      id: d.id,
                      name: d.name,
                      slug: d.slug,
                      countryCode: d.countryCode,
                      apiPhoto: d.photo,
                      apiFlag: d.flag,
                    })
                  }
                />
              ))}
            </DestinationCarousel>
          )}

          {data.featured.regional.length > 0 && (
            <DestinationCarousel title="Regional eSIMs plan">
              {data.featured.regional.map((d) => (
                <DestinationCard
                  key={d.slug}
                  variant="featured"
                  name={d.name}
                  imageSlug={d.slug}
                  isRegion
                  apiPhoto={d.photo}
                  apiFlag={d.flag}
                  fromUSD={d.fromUSD}
                  onClick={() =>
                    openDestination({
                      type: 'regional',
                      id: d.id,
                      name: d.name,
                      slug: d.slug,
                      isRegion: true,
                      apiPhoto: d.photo,
                      apiFlag: d.flag,
                    })
                  }
                />
              ))}
            </DestinationCarousel>
          )}

          {data.featured.global && (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold">Global eSIMs plan</h2>
              <DestinationCard
                variant="featured"
                name={data.featured.global.name}
                imageSlug={data.featured.global.slug}
                isRegion
                apiPhoto={data.featured.global.photo}
                apiFlag={data.featured.global.flag}
                fromUSD={data.featured.global.fromUSD}
                onClick={() =>
                  openDestination({
                    type: 'global',
                    id: null,
                    name: data.featured.global!.name,
                    slug: data.featured.global!.slug,
                    isRegion: true,
                    apiPhoto: data.featured.global!.photo,
                    apiFlag: data.featured.global!.flag,
                  })
                }
              />
            </section>
          )}

          {/* Browse all */}
          <section className="space-y-4 border-t pt-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-lg font-semibold">Browse all destinations</h2>
              <div className="relative sm:w-72">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search countries…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Regions (now with real photos) */}
            {data.regions.length > 0 && !isSearching && (
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Regions
                </p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                  {data.regions.map((r) => (
                    <DestinationCard
                      key={r.id}
                      name={r.name}
                      isRegion
                      imageSlug={regionSlug(r.name)}
                      apiPhoto={r.photo}
                      onClick={() =>
                        openDestination({
                          type: 'regional',
                          id: r.id,
                          name: r.name,
                          slug: regionSlug(r.name),
                          isRegion: true,
                          apiPhoto: r.photo,
                          apiFlag: r.flag,
                        })
                      }
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Countries — two rows, then "View all" */}
            <div className="space-y-3">
              <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <Globe className="size-3.5" />
                Countries ({matchedCountries.length})
              </p>
              {visibleCountries.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No countries match “{search}”.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                  {visibleCountries.map((c) => (
                    <DestinationCard
                      key={c.id}
                      name={c.name}
                      countryCode={c.countryCode}
                      apiFlag={c.flag}
                      onClick={() =>
                        openDestination({
                          type: 'local',
                          id: c.id,
                          name: c.name,
                          countryCode: c.countryCode,
                          apiPhoto: c.photo,
                          apiFlag: c.flag,
                        })
                      }
                    />
                  ))}
                </div>
              )}

              {(canExpand || showAllCountries) && !isSearching && (
                <div className="flex justify-center pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAllCountries((v) => !v)}
                  >
                    {showAllCountries ? (
                      'Show fewer'
                    ) : (
                      <>
                        View all {matchedCountries.length} countries
                        <ChevronDown className="ml-1.5 size-4" />
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  )
}
