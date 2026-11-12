'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  ShoppingBag,
  Wifi,
  DollarSign,
  Network,
  Mail,
  Phone,
  MapPin,
  Wallet,
  CalendarDays,
  Sparkles,
  TrendingUp,
  X,
  CalendarRange,
  Eye,
  EyeOff,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { DistributorStatusBadge } from '@/components/distributors/distributor-status-badge'
import { type DistributorStatus } from '@/lib/distributors-store'
import { type DistributorDetail, type NetworkPurchase } from '@/lib/distributor-detail'
import { isRangeActive, withinRange, type DashboardRange } from '@/lib/dashboard-range'

const statusBadge: Record<string, string> = {
  fulfilled: 'bg-green-500/10 text-green-600 border-green-500/20',
  paid: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  pending: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
  failed: 'bg-red-500/10 text-red-600 border-red-500/20',
  refunded: 'bg-muted text-muted-foreground border-border',
}

/**
 * A purchase counts as "failed" when the eSIM could not be issued (the wallet
 * was refunded, so no money actually changed hands). These are hidden from the
 * purchases table by default and revealed with the "Show all" toggle.
 */
function isFailedPurchase(status: string): boolean {
  return status === 'failed' || status === 'refunded'
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string
  value: string | number
  icon: React.ReactNode
}) {
  return (
    <Card className="card-hover">
      <CardContent className="flex items-center gap-4 p-5">
        <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-muted shrink-0">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-2xl font-bold font-display tracking-tight">{value}</p>
          <p className="text-xs text-muted-foreground truncate">{label}</p>
        </div>
      </CardContent>
    </Card>
  )
}

interface DistributorDetailViewProps {
  detail: DistributorDetail | null
  loading: boolean
  backHref: string
  backLabel: string
  /** Wording for the entity whose sales are rolled up (default "sub-distributor"). */
  childLabel?: string
  /** Heading shown when the record can't be shown (default "Distributor not found."). */
  notFoundText?: string
}

/**
 * Read-only sale price for one purchase row. A fulfilled order is a completed
 * sale, so its recorded price is not editable from any portal.
 */
function SalePriceCell({ purchase }: { purchase: NetworkPurchase }) {
  const display = purchase.salePrice == null ? null : `$${purchase.salePrice.toFixed(2)}`
  return <span className="text-sm">{display ?? '—'}</span>
}

/**
 * Shared distributor/sub-distributor detail view: profile header, summary cards,
 * and the purchases table (rolled up across any children). Used by both the
 * admin distributor page and the distributor's own sub-distributor page so the
 * record renders identically in both places.
 */
export function DistributorDetailView({
  detail,
  loading,
  backHref,
  backLabel,
  childLabel = 'sub-distributor',
  notFoundText = 'Distributor not found.',
}: DistributorDetailViewProps) {
  // "Profit by date" filter — pick a period and both profits (and the tables
  // that feed them) recalculate for just those dates. Parsed as local-midnight
  // so the day boundaries line up with withinRange's local matching.
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  // Purchases show only successful orders by default; this reveals failed ones.
  const [showAllPurchases, setShowAllPurchases] = useState(false)
  const range = useMemo<DashboardRange>(
    () => ({
      from: from ? new Date(`${from}T00:00:00`) : undefined,
      to: to ? new Date(`${to}T00:00:00`) : undefined,
    }),
    [from, to],
  )
  const rangeActive = isRangeActive(range)

  const allTopUps = detail?.topUps ?? []
  const allPurchases = detail?.purchases ?? []
  const topUps = useMemo(
    () => allTopUps.filter((t) => withinRange(t.createdAt, range)),
    [allTopUps, range],
  )
  const purchases = useMemo(
    () => allPurchases.filter((p) => withinRange(p.createdAt, range)),
    [allPurchases, range],
  )

  const backLink = (
    <Link
      href={backHref}
      className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowLeft className="size-4" /> {backLabel}
    </Link>
  )

  if (loading) {
    return (
      <div className="space-y-6">
        {backLink}
        <div className="py-16 text-center text-sm text-muted-foreground">Loading…</div>
      </div>
    )
  }

  if (!detail?.profile) {
    return (
      <div className="space-y-6">
        {backLink}
        <div className="py-16 text-center">
          <p className="text-sm font-medium">{notFoundText}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            It may have been removed, or the link is incorrect.
          </p>
        </div>
      </div>
    )
  }

  const { profile, subCount } = detail
  // Default view hides failed orders; "Show all" reveals them.
  const failedCount = purchases.filter((p) => isFailedPurchase(p.status)).length
  const visiblePurchases = showAllPurchases
    ? purchases
    : purchases.filter((p) => !isFailedPurchase(p.status))
  const totalSpent = purchases.reduce((s, p) => s + p.total, 0)
  const totalEsims = purchases.filter((p) => p.esimNumber).length
  const showPlacedBy = subCount > 0
  const pricedCount = purchases.filter((p) => p.salePrice != null).length
  // Both profits are re-summed from the (period-filtered) rows, so the cards
  // answer "what was the profit on these dates?" — full totals when no range.
  const totalProfit = topUps.reduce((s, t) => s + t.additional, 0)
  const realProfit = purchases.reduce((s, p) => s + (p.margin ?? 0), 0)

  return (
    <div className="space-y-6">
      {backLink}

      {/* Profile header */}
      <Card>
        <CardContent className="p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-bold tracking-tight">{profile.name}</h1>
                <DistributorStatusBadge status={profile.status as DistributorStatus} />
                {profile.role === 'sub_distributor' && (
                  <Badge variant="outline" className="text-xs">
                    Sub-distributor
                  </Badge>
                )}
              </div>
              {profile.company && (
                <p className="text-sm text-muted-foreground">{profile.company}</p>
              )}
              <div className="flex flex-wrap gap-x-5 gap-y-1.5 pt-1 text-sm text-muted-foreground">
                {profile.email && (
                  <span className="inline-flex items-center gap-1.5">
                    <Mail className="size-3.5" /> {profile.email}
                  </span>
                )}
                {profile.whatsapp && (
                  <span className="inline-flex items-center gap-1.5">
                    <Phone className="size-3.5" /> {profile.whatsapp}
                  </span>
                )}
                {profile.country && (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="size-3.5" /> {profile.country}
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="size-3.5" /> Joined {formatDate(profile.createdAt)}
                </span>
              </div>
            </div>

            {/* Wallet balance */}
            <div className="flex items-center gap-3 rounded-lg bg-muted px-4 py-3 shrink-0">
              <Wallet className="size-5 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Wallet balance</p>
                <p className="text-xl font-bold">${profile.walletBalance.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Profit-by-date filter — scopes the profit cards, top-ups and purchases */}
      <Card>
        <CardContent className="flex flex-wrap items-end gap-4 p-4">
          <div className="flex items-center gap-2 pb-1.5 text-sm font-medium">
            <CalendarRange className="size-4 text-primary" />
            Profit by date
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">From</label>
            <Input
              type="date"
              value={from}
              max={to || undefined}
              onChange={(e) => setFrom(e.target.value)}
              className="h-9 w-40"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">To</label>
            <Input
              type="date"
              value={to}
              min={from || undefined}
              onChange={(e) => setTo(e.target.value)}
              className="h-9 w-40"
            />
          </div>
          {rangeActive && (
            <Button variant="ghost" size="sm" className="mb-0.5" onClick={() => { setFrom(''); setTo('') }}>
              <X className="size-4" /> Clear
            </Button>
          )}
          <p className="ml-auto pb-1.5 text-xs text-muted-foreground">
            {rangeActive
              ? `Showing ${purchases.length} purchase${purchases.length === 1 ? '' : 's'} and ${topUps.length} top-up${topUps.length === 1 ? '' : 's'} in this period.`
              : 'Showing all-time totals. Pick a range to see profit for specific dates.'}
          </p>
        </CardContent>
      </Card>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Purchases"
          value={purchases.length}
          icon={<ShoppingBag className="size-5 text-primary" />}
        />
        <StatCard
          label="eSIMs Issued"
          value={totalEsims}
          icon={<Wifi className="size-5 text-orange-500" />}
        />
        <StatCard
          label="Total Spent"
          value={`$${totalSpent.toLocaleString()}`}
          icon={<DollarSign className="size-5 text-green-600" />}
        />
        <StatCard
          label={childLabel === 'sub-distributor' ? 'Sub-distributors' : `${childLabel}s`}
          value={subCount}
          icon={<Network className="size-5 text-muted-foreground" />}
        />
      </div>

      {/* Profit — the two lenses the client asked for */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="border-primary/15 bg-primary/5">
          <CardContent className="flex items-start gap-4 p-5">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 shrink-0">
              <Sparkles className="size-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-2xl font-bold text-primary">${totalProfit.toLocaleString()}</p>
              <p className="text-sm font-medium">Top-up profit</p>
              <p className="text-xs text-muted-foreground">
                Bonus credit received on top-ups
                {rangeActive ? ' in the selected period.' : ' (booked when credit is allocated).'}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-green-600/20 bg-green-600/5">
          <CardContent className="flex items-start gap-4 p-5">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-green-600/10 shrink-0">
              <TrendingUp className="size-5 text-green-600" />
            </div>
            <div className="min-w-0">
              <p className="text-2xl font-bold text-green-600">${realProfit.toLocaleString()}</p>
              <p className="text-sm font-medium">Selling profit</p>
              <p className="text-xs text-muted-foreground">
                Earned on actual sales (sale price − cost)
                {pricedCount < purchases.length
                  ? ` · ${pricedCount}/${purchases.length} sales priced`
                  : ''}
                {rangeActive ? ' · this period' : ''}.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top-ups (source of the virtual profit) */}
      <div className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Top-ups</h2>
          <p className="text-xs text-muted-foreground">
            Bonus credit received on each top-up — the &quot;Additional&quot; column is the top-up profit.
          </p>
        </div>

        <div className="rounded-md border">
          {topUps.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              {rangeActive
                ? 'No top-ups in the selected period.'
                : 'No top-ups recorded for this account yet.'}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Cash Paid</TableHead>
                  <TableHead className="text-right">Bonus %</TableHead>
                  <TableHead className="text-right">Credit Received</TableHead>
                  <TableHead className="text-right">Additional</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topUps.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(t.createdAt)}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {t.cashPaid == null ? '—' : `$${t.cashPaid.toLocaleString()}`}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {t.bonusPercent == null ? '—' : `+${t.bonusPercent}%`}
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium">
                      ${t.creditReceived.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right text-sm font-semibold text-primary">
                      +${t.additional.toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      {/* Purchases */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Purchases</h2>
            {showPlacedBy && (
              <p className="text-xs text-muted-foreground">
                Includes {subCount} {childLabel}
                {subCount === 1 ? '' : 's'}
              </p>
            )}
          </div>
          {failedCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => setShowAllPurchases((v) => !v)}
            >
              {showAllPurchases ? (
                <>
                  <EyeOff className="size-4" /> Successful only
                </>
              ) : (
                <>
                  <Eye className="size-4" /> Show all
                  <Badge variant="outline" className={statusBadge.failed}>
                    {failedCount} failed
                  </Badge>
                </>
              )}
            </Button>
          )}
        </div>

        <div className="rounded-md border">
          {visiblePurchases.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              {purchases.length === 0
                ? rangeActive
                  ? 'No purchases in the selected period.'
                  : `No purchases yet${showPlacedBy ? ` for this account or its ${childLabel}s` : ''}.`
                : `No successful purchases${rangeActive ? ' in the selected period' : ''}. Use “Show all” to view the ${failedCount} failed one${failedCount === 1 ? '' : 's'}.`}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Package</TableHead>
                  {showPlacedBy && <TableHead>Placed by</TableHead>}
                  <TableHead>Customer</TableHead>
                  <TableHead>eSIM</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead className="text-right">Sale Price</TableHead>
                  <TableHead className="text-right">Profit</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visiblePurchases.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="max-w-55 truncate text-sm font-medium">
                      {p.packageTitle}
                    </TableCell>
                    {showPlacedBy && (
                      <TableCell className="text-sm">
                        <span className="inline-flex items-center gap-1.5">
                          {p.placedByName}
                          {p.isSub && (
                            <Badge variant="outline" className="text-[10px] leading-4">
                              Sub
                            </Badge>
                          )}
                        </span>
                      </TableCell>
                    )}
                    <TableCell className="text-sm">{p.customerName}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {p.esimNumber ?? '—'}
                    </TableCell>
                    <TableCell className="text-right text-sm font-semibold">
                      ${p.total.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <SalePriceCell purchase={p} />
                    </TableCell>
                    <TableCell className="text-right text-sm font-semibold">
                      {p.margin == null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <span className={p.margin < 0 ? 'text-destructive' : 'text-green-600'}>
                          {p.margin < 0 ? '-' : '+'}${Math.abs(p.margin).toFixed(2)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusBadge[p.status] ?? statusBadge.pending}>
                        {p.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(p.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </div>
  )
}
