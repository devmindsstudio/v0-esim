'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  Globe, MapPin, Loader2, AlertCircle, Package as PackageIcon,
  ChevronsUpDown, Check,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import {
  getUsdPrice, formatData,
  type PackageType, type EtijwaalPackage,
} from '@/lib/etijwaal'
import { type IssuedEsim } from '@/components/orders/esim-result-dialog'

/**
 * The catalogue is read through our own /api/catalogue/* routes, which hold the
 * eTijwaal credentials server side. The browser never sees them — a previous
 * version called eTijwaal directly with NEXT_PUBLIC_ vars, which Next.js inlined
 * into the public JS bundle.
 */
async function authHeader(): Promise<Record<string, string>> {
  const supabase = createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  return { Authorization: `Bearer ${session?.access_token ?? ''}` }
}

/** A country/region as /api/catalogue/destinations returns it. */
interface CatalogueLocation {
  id: number
  name: string
  countryCode?: string
}

async function loadDestinations(): Promise<{
  countries: CatalogueLocation[]
  regions: CatalogueLocation[]
}> {
  const res = await fetch('/api/catalogue/destinations', { headers: await authHeader() })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error ?? 'Could not load the catalogue.')
  return { countries: json.countries ?? [], regions: json.regions ?? [] }
}

async function loadPackagesFor(
  type: PackageType,
  id: number | null,
): Promise<EtijwaalPackage[]> {
  const params = new URLSearchParams({ type })
  if (type !== 'global' && id != null) params.set('id', String(id))
  const res = await fetch(`/api/catalogue/packages?${params.toString()}`, {
    headers: await authHeader(),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error ?? 'Could not load packages.')
  return json.packages ?? []
}

interface Customer {
  id: string
  name: string
  email: string
}

export interface AllocateResult {
  esim: IssuedEsim
  title: string
  orderId: string
  customerName: string
  customerEmail: string
}

interface AllocatePackageDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  customer: Customer | null
  walletBalance: number
  onIssued: (result: AllocateResult) => void
}

/**
 * Lets a distributor allocate (order) an eSIM package to ONE specific customer.
 * Mirrors the catalogue's browse-and-order flow, but the customer is fixed to
 * the row it was opened from, so there's no customer picker here.
 */
export function AllocatePackageDialog({
  open, onOpenChange, customer, walletBalance, onIssued,
}: AllocatePackageDialogProps) {
  const [type, setType] = useState<PackageType>('global')
  const [countries, setCountries] = useState<CatalogueLocation[]>([])
  const [regions, setRegions] = useState<CatalogueLocation[]>([])
  const [locationId, setLocationId] = useState<number | null>(null)
  const [packages, setPackages] = useState<EtijwaalPackage[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [comboOpen, setComboOpen] = useState(false)
  const [selectedPkg, setSelectedPkg] = useState<EtijwaalPackage | null>(null)
  const [salePrice, setSalePrice] = useState('')
  const [placing, setPlacing] = useState(false)

  // Prefill the sale price with the package cost whenever a package is picked.
  useEffect(() => {
    if (!selectedPkg) return
    const cost = getUsdPrice(selectedPkg)
    setSalePrice(cost != null ? cost.toFixed(2) : '')
  }, [selectedPkg])

  // Load the catalogue fresh each time the dialog opens.
  useEffect(() => {
    if (!open) return
    setType('global')
    setLocationId(null)
    setSelectedPkg(null)
    setError('')
    let active = true
    ;(async () => {
      setLoading(true)
      try {
        const [destinations, pkgs] = await Promise.all([
          loadDestinations(),
          loadPackagesFor('global', null),
        ])
        if (!active) return
        setCountries(destinations.countries)
        setRegions(destinations.regions)
        setPackages(pkgs)
      } catch (e: unknown) {
        if (active) setError(e instanceof Error ? e.message : 'Could not load packages')
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [open])

  async function loadPackages(nextType: PackageType, nextId: number | null) {
    setLoading(true)
    setError('')
    setSelectedPkg(null)
    try {
      const pkgs = await loadPackagesFor(nextType, nextType === 'global' ? null : nextId)
      setPackages(pkgs)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not load packages')
    } finally {
      setLoading(false)
    }
  }

  function handleTypeChange(val: string) {
    if (!val) return
    const next = val as PackageType
    setType(next)
    setLocationId(null)
    setSelectedPkg(null)
    if (next === 'global') loadPackages('global', null)
    else setPackages([])
  }

  function handleLocationSelect(id: number) {
    setLocationId(id)
    setComboOpen(false)
    loadPackages(type, id)
  }

  async function handlePlaceOrder() {
    if (!selectedPkg || !customer) return
    const price = getUsdPrice(selectedPkg)
    if (price == null) {
      toast.error('This package has no USD price and cannot be ordered.')
      return
    }
    setPlacing(true)
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()

    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token ?? ''}`,
      },
      body: JSON.stringify({
        customerId: customer.id,
        packageId: selectedPkg.id,
        packageTitle: selectedPkg.title,
        currency: 'USD',
        unitPrice: price,
        salePrice: Number(salePrice),
      }),
    })
    const json = await res.json()
    setPlacing(false)

    if (!res.ok) {
      toast.error('Order failed', { description: json.error })
      return
    }

    onIssued({
      esim: json.esim,
      title: selectedPkg.title,
      orderId: json.order?.orderId ?? '',
      customerName: customer.name,
      customerEmail: customer.email,
    })
    onOpenChange(false)
    toast.success('eSIM issued', { description: `${selectedPkg.title} — ${customer.name}` })
  }

  const locationList = type === 'regional' ? regions : countries
  const selectedLocation = locationList.find((l) => l.id === locationId)
  const needsLocation = type !== 'global' && locationId == null
  const price = selectedPkg ? getUsdPrice(selectedPkg) : null
  const canAfford = price != null && walletBalance >= price
  const saleNum = Number(salePrice)
  const saleEntered = Number.isFinite(saleNum) && saleNum > 0
  // No selling below cost — the sale price must at least cover the package cost.
  const belowCost = saleEntered && price != null && saleNum < price
  const validSale = saleEntered && !belowCost
  const profit = saleEntered && price != null ? saleNum - price : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            Allocate Package{customer ? ` — ${customer.name}` : ''}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Scope + location filters */}
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Scope</label>
              <ToggleGroup
                type="single"
                value={type}
                onValueChange={handleTypeChange}
                variant="outline"
                className="justify-start"
              >
                <ToggleGroupItem value="global" className="gap-1.5 px-3"><Globe className="size-3.5" /> Global</ToggleGroupItem>
                <ToggleGroupItem value="local" className="gap-1.5 px-3"><MapPin className="size-3.5" /> Local</ToggleGroupItem>
                <ToggleGroupItem value="regional" className="gap-1.5 px-3"><Globe className="size-3.5" /> Regional</ToggleGroupItem>
              </ToggleGroup>
            </div>

            {type === 'local' && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Country</label>
                <Popover open={comboOpen} onOpenChange={setComboOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" className="w-52 justify-between font-normal" disabled={loading || countries.length === 0}>
                      {selectedLocation ? selectedLocation.name : 'Select country…'}
                      <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-52 p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search country…" />
                      <CommandList>
                        <CommandEmpty>No country found.</CommandEmpty>
                        <CommandGroup>
                          {countries.map((c) => (
                            <CommandItem key={c.id} value={c.name} onSelect={() => handleLocationSelect(c.id)}>
                              <Check className={cn('mr-2 size-4', locationId === c.id ? 'opacity-100' : 'opacity-0')} />
                              {c.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            )}

            {type === 'regional' && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Region</label>
                <Select value={locationId != null ? String(locationId) : ''} onValueChange={(v) => handleLocationSelect(Number(v))} disabled={loading || regions.length === 0}>
                  <SelectTrigger className="w-52"><SelectValue placeholder="Select region…" /></SelectTrigger>
                  <SelectContent>
                    {regions.map((r) => <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Package list */}
          <div className="rounded-md border max-h-72 overflow-auto">
            {loading ? (
              <div className="flex flex-col items-center justify-center gap-2 py-12">
                <Loader2 className="size-6 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Fetching packages…</p>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center gap-2 py-12">
                <AlertCircle className="size-6 text-destructive" />
                <p className="text-sm text-destructive">{error}</p>
              </div>
            ) : needsLocation ? (
              <div className="flex flex-col items-center justify-center gap-2 py-12">
                <MapPin className="size-6 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Select a {type === 'regional' ? 'region' : 'country'} to view its packages.
                </p>
              </div>
            ) : packages.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-12">
                <PackageIcon className="size-6 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No packages found.</p>
              </div>
            ) : (
              <div className="divide-y">
                {packages.map((pkg) => {
                  const p = getUsdPrice(pkg)
                  const selected = selectedPkg?.id === pkg.id
                  return (
                    <button
                      key={pkg.id}
                      type="button"
                      disabled={p == null}
                      onClick={() => setSelectedPkg(pkg)}
                      className={cn(
                        'w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/40',
                        selected && 'bg-primary/5',
                        p == null && 'opacity-50 cursor-not-allowed',
                      )}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{pkg.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatData(pkg.dataMB, pkg.is_unlimited, pkg.title)} · {pkg.day} days · {pkg.location}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-sm font-bold text-primary">
                          {p != null ? `$${p.toFixed(2)}` : '—'}
                        </span>
                        {selected && <Check className="size-4 text-primary" />}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Sale price to the customer (drives real profit) */}
          {selectedPkg && price != null && (
            <div className="space-y-1.5">
              <Label>Sale price to customer</Label>
              <div className="relative w-40">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  $
                </span>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={salePrice}
                  onChange={(e) => setSalePrice(e.target.value)}
                  className="pl-6"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                What you charge the customer. Prefilled with your cost.
              </p>
              {belowCost && (
                <p className="text-xs font-medium text-destructive">
                  Sale price can’t be below your cost of ${price?.toFixed(2)}. Raise it to at least
                  cover the cost.
                </p>
              )}
            </div>
          )}

          {/* Charge summary */}
          {selectedPkg && price != null && (
            <div className="rounded-lg bg-primary/5 border border-primary/10 px-3 py-2 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Charge to wallet (cost)</span>
                <span className="font-bold text-primary">${price.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Your profit</span>
                <span
                  className={cn(
                    'font-semibold',
                    profit != null && profit < 0 ? 'text-destructive' : 'text-green-600',
                  )}
                >
                  {profit == null ? '—' : `${profit < 0 ? '-' : '+'}$${Math.abs(profit).toFixed(2)}`}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Balance after</span>
                <span className={cn('font-semibold', !canAfford && 'text-destructive')}>
                  ${Math.max(0, walletBalance - price).toLocaleString()}
                </span>
              </div>
            </div>
          )}
          {selectedPkg && !canAfford && (
            <p className="text-xs text-destructive">Insufficient wallet balance for this package.</p>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handlePlaceOrder} disabled={placing || !selectedPkg || !canAfford || !validSale}>
              {placing ? 'Processing…' : 'Pay & Issue eSIM'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
