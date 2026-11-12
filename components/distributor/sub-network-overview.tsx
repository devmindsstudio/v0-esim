'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Wifi, DollarSign, Users, Wallet, Clock, TrendingUp } from 'lucide-react'
import {
  getSubDistributorInsights,
  getSubNetworkActivity,
  summarizeSubNetwork,
  type SubDistributorInsight,
  type SubActivityItem,
} from '@/lib/sub-distributor-insights'

function money(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n)
}

function relTime(iso: string | null): string {
  if (!iso) return 'no sales yet'
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  const h = Math.floor(diff / 3600000)
  const d = Math.floor(diff / 86400000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  return `${d}d ago`
}

function initials(name: string): string {
  return name
    .split(' ')
    .map((x) => x[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function statusClasses(status: string): string {
  if (status === 'active') return 'bg-green-100 text-green-700 hover:bg-green-100'
  if (status === 'suspended') return 'bg-red-100 text-red-700 hover:bg-red-100'
  return 'bg-muted text-muted-foreground'
}

function SummaryCard({ icon, label, value }: { icon: ReactNode; label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex items-center justify-center size-10 rounded-lg bg-primary/10 text-primary shrink-0">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-xl font-bold leading-tight">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  )
}

/**
 * Read-only performance + activity view for a main distributor's sub-network.
 * Renders nothing until data loads, and nothing at all if there are no subs
 * (the page's management table already shows the empty state).
 */
export function SubNetworkOverview({
  parentId,
  refreshKey = 0,
}: {
  parentId: string
  refreshKey?: number
}) {
  const [insights, setInsights] = useState<SubDistributorInsight[] | null>(null)
  const [activity, setActivity] = useState<SubActivityItem[]>([])

  useEffect(() => {
    let alive = true
    getSubDistributorInsights(parentId).then((r) => {
      if (alive) setInsights(r)
    })
    getSubNetworkActivity(parentId).then((r) => {
      if (alive) setActivity(r)
    })
    return () => {
      alive = false
    }
  }, [parentId, refreshKey])

  if (insights === null) {
    return (
      <p className="text-sm text-muted-foreground">Loading sub-distributor performance…</p>
    )
  }
  if (insights.length === 0) return null

  const s = summarizeSubNetwork(insights)

  return (
    <div className="space-y-6">
      {/* Network performance summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard icon={<Wifi className="size-5" />} label="eSIMs sold (network)" value={s.esimsSold} />
        <SummaryCard icon={<DollarSign className="size-5" />} label="Revenue (network)" value={money(s.revenue)} />
        <SummaryCard icon={<Users className="size-5" />} label="Customers (network)" value={s.customerCount} />
        <SummaryCard icon={<Wallet className="size-5" />} label="Credit held (network)" value={money(s.creditHeld)} />
      </div>

      {/* Per-sub performance cards */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Sub-Distributor Performance</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {insights.map((d) => (
            <Card key={d.id}>
              <CardContent className="p-5 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex items-center justify-center size-10 rounded-full bg-primary/10 text-primary text-sm font-semibold shrink-0">
                      {initials(d.name)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium leading-tight truncate">{d.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{d.company || '—'}</p>
                    </div>
                  </div>
                  <Badge variant="secondary" className={statusClasses(d.status)}>
                    {d.status}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <Metric label="eSIMs sold" value={d.esimsSold} />
                  <Metric label="Revenue" value={money(d.revenue)} />
                  <Metric label="Customers" value={d.customerCount} />
                  <Metric label="Wallet" value={money(d.walletBalance)} />
                </div>

                <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-3 border-t">
                  <Clock className="size-3.5" />
                  Last sale {relTime(d.lastSaleAt)}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Recent activity across the sub-network */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-semibold">Recent Sub-Network Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {activity.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">
              No sales from your sub-distributors yet.
            </p>
          ) : (
            <div className="space-y-3">
              {activity.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between gap-3 pb-3 border-b border-border last:border-0 last:pb-0"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex items-center justify-center size-8 rounded-full bg-chart-2/10 text-chart-2 shrink-0">
                      <TrendingUp className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{a.packageTitle}</p>
                      <p className="text-xs text-muted-foreground truncate">{a.subName}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end shrink-0">
                    <span className="text-sm font-semibold text-chart-2">{money(a.total)}</span>
                    <span className="text-xs text-muted-foreground">{relTime(a.createdAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
