'use client'

import { useMemo, useState } from 'react'
import {
  Globe,
  Database,
  Clock,
  MapPin,
  Wifi,
  RefreshCw,
  Zap,
  Check,
  PackageIcon,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  type Plan,
  priceLabel,
  formatData,
} from '@/lib/catalogue-format'

interface PlanSelectorProps {
  packages: Plan[]
  displayCurrency: string
  /** When set, the detail panel shows an action button (e.g. Order) per plan. */
  onOrder?: (plan: Plan) => void
  /** Label for the action button. Defaults to "Order eSIM". */
  orderLabel?: string
}

type DataTab = 'limited' | 'unlimited'

function sortPlans(a: Plan, b: Plan) {
  if (a.day !== b.day) return a.day - b.day
  return a.dataMB - b.dataMB
}

export function PlanSelector({
  packages,
  displayCurrency,
  onOrder,
  orderLabel,
}: PlanSelectorProps) {
  const limited = useMemo(
    () => packages.filter((p) => p.is_unlimited !== 1).sort(sortPlans),
    [packages],
  )
  const unlimited = useMemo(
    () => packages.filter((p) => p.is_unlimited === 1).sort(sortPlans),
    [packages],
  )

  const hasLimited = limited.length > 0
  const hasUnlimited = unlimited.length > 0
  const [tab, setTab] = useState<DataTab>(hasLimited ? 'limited' : 'unlimited')
  const [selectedId, setSelectedId] = useState<number | null>(null)

  const activeTab = tab === 'limited' && !hasLimited ? 'unlimited' : tab
  const list = activeTab === 'limited' ? limited : unlimited
  const selected = packages.find((p) => p.id === selectedId) ?? null

  // Group the active list by number of days (matches the eTijwaal layout).
  const groups = useMemo(() => {
    const byDay = new Map<number, Plan[]>()
    for (const p of list) {
      const arr = byDay.get(p.day) ?? []
      arr.push(p)
      byDay.set(p.day, arr)
    }
    return [...byDay.entries()].sort((a, b) => a[0] - b[0])
  }, [list])

  if (packages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-24">
        <PackageIcon className="size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">No packages found for this destination.</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Left: plan list */}
      <div className="space-y-5 lg:col-span-2">
        {/* Limited / Unlimited toggle (only when both exist) */}
        {hasLimited && hasUnlimited && (
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
            {(['limited', 'unlimited'] as DataTab[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setTab(t)
                  setSelectedId(null)
                }}
                className={cn(
                  'rounded-md py-2 text-sm font-medium transition-colors',
                  activeTab === t
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {t === 'limited' ? 'Limited Data' : 'Unlimited Data'}
              </button>
            ))}
          </div>
        )}

        {groups.map(([day, plans]) => (
          <div key={day} className="space-y-2">
            <h3 className="text-base font-bold">
              {day} {day === 1 ? 'Day' : 'Days'}
            </h3>
            <div className="space-y-2">
              {plans.map((pkg) => {
                const isSelected = pkg.id === selectedId
                return (
                  <button
                    key={pkg.id}
                    type="button"
                    onClick={() => setSelectedId(pkg.id)}
                    className={cn(
                      'flex w-full items-center justify-between rounded-lg border bg-card px-4 py-3.5 text-left transition-colors',
                      isSelected
                        ? 'border-primary ring-1 ring-primary'
                        : 'hover:border-primary/50',
                    )}
                  >
                    <span className="text-sm font-medium">
                      {formatData(pkg.dataMB, pkg.is_unlimited, pkg.title)}
                    </span>
                    <span className="flex items-center gap-3">
                      <span className="font-semibold">
                        {priceLabel(pkg, displayCurrency)}{' '}
                        <span className="text-xs font-normal text-muted-foreground">
                          {displayCurrency}
                        </span>
                      </span>
                      <span
                        className={cn(
                          'flex size-5 items-center justify-center rounded-full border-2 transition-colors',
                          isSelected ? 'border-primary bg-primary' : 'border-muted-foreground/40',
                        )}
                      >
                        {isSelected && <Check className="size-3 text-primary-foreground" />}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Right: sticky detail panel */}
      <div className="lg:col-span-1">
        <div className="rounded-xl border bg-card p-6 lg:sticky lg:top-4">
          {selected ? (
            <div className="space-y-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {selected.location}
                </p>
                <h4 className="mt-1 text-base font-semibold leading-snug">{selected.title}</h4>
              </div>

              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl font-bold text-primary">
                  {priceLabel(selected, displayCurrency)}
                </span>
                <span className="text-sm text-muted-foreground">{displayCurrency}</span>
              </div>

              <div className="space-y-2.5 border-t pt-4 text-sm">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Database className="size-4" /> Data
                  </span>
                  <span className="font-medium">
                    {formatData(selected.dataMB, selected.is_unlimited, selected.title)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="size-4" /> Validity
                  </span>
                  <span className="font-medium">
                    {selected.day} {selected.day === 1 ? 'day' : 'days'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="size-4" /> Coverage
                  </span>
                  <span className="max-w-[55%] truncate text-right font-medium">
                    {selected.location}
                  </span>
                </div>
              </div>

              {(selected.tether_hotspot === 1 ||
                selected.rechargeability === 1 ||
                selected.is_unlimited === 1 ||
                (selected.throttle === 1 && selected.throttle_speed)) && (
                <div className="flex flex-wrap gap-1.5 border-t pt-4">
                  {selected.tether_hotspot === 1 && (
                    <Badge variant="secondary" className="gap-1 py-0.5 text-xs">
                      <Wifi className="size-3" /> Hotspot
                    </Badge>
                  )}
                  {selected.rechargeability === 1 && (
                    <Badge variant="secondary" className="gap-1 py-0.5 text-xs">
                      <RefreshCw className="size-3" /> Top-up
                    </Badge>
                  )}
                  {selected.is_unlimited === 1 && (
                    <Badge variant="secondary" className="gap-1 py-0.5 text-xs">
                      <Zap className="size-3" /> Unlimited
                    </Badge>
                  )}
                  {selected.throttle === 1 && selected.throttle_speed && (
                    <Badge variant="outline" className="py-0.5 text-xs">
                      FUP: {selected.throttle_speed}
                    </Badge>
                  )}
                </div>
              )}

              {/* Other-currency prices */}
              <div className="flex flex-wrap gap-x-3 gap-y-1 border-t pt-4 text-xs text-muted-foreground">
                {selected.price
                  .filter((p) => p.currency_code !== displayCurrency)
                  .map((p) => (
                    <span key={p.currency_code}>
                      {p.currency_code} {p.rate}
                    </span>
                  ))}
              </div>

              <p className="text-xs text-muted-foreground">Package ID: {selected.id}</p>

              {onOrder && (
                <Button className="w-full" onClick={() => onOrder(selected)}>
                  {orderLabel ?? 'Order eSIM'}
                </Button>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
              <div className="flex size-16 items-center justify-center rounded-full bg-muted">
                <Globe className="size-8 text-muted-foreground" />
              </div>
              <p className="font-semibold">Select a plan</p>
              <p className="text-sm text-muted-foreground">Click a plan to view its details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
