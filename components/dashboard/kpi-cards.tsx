'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import {
  Users,
  ShoppingCart,
  DollarSign,
  Wallet,
  UserRound,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { getAdminDashboardStats, type AdminDashboardStats } from '@/lib/admin-stats'
import { isRangeActive, type DashboardRange } from '@/lib/dashboard-range'

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US').format(num)
}

interface KPICardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: React.ReactNode
  iconBgColor: string
  progress?: {
    value: number
    label: string
  }
}

function KPICard({ title, value, subtitle, icon, iconBgColor, progress }: KPICardProps) {
  return (
    <Card className="p-4 flex items-start gap-4 shadow-sm card-hover">
      <div
        className={cn(
          'flex items-center justify-center size-12 rounded-xl shrink-0 shadow-sm',
          iconBgColor,
        )}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-2xl font-bold font-display tracking-tight text-foreground">{value}</p>
        <p className="text-sm text-muted-foreground truncate">{title}</p>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        {progress && (
          <div className="mt-2 space-y-1">
            <Progress value={progress.value} className="h-1.5" />
            <p className="text-xs text-muted-foreground">{progress.label}</p>
          </div>
        )}
      </div>
    </Card>
  )
}

export function KPICards({ range }: { range?: DashboardRange }) {
  const [stats, setStats] = useState<AdminDashboardStats | null>(null)

  useEffect(() => {
    getAdminDashboardStats(range).then(setStats)
  }, [range])

  if (!stats) return null

  // When a period is selected, the count/flow cards say so explicitly, so the
  // numbers (e.g. 0 for a past period) read as intentional rather than broken.
  const filtered = isRangeActive(range)
  const held = `${stats.distributorsHolding} distributor${stats.distributorsHolding === 1 ? '' : 's'}`

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <KPICard
        title="Total Distributors"
        value={formatNumber(stats.totalDistributors)}
        subtitle={
          filtered
            ? 'Onboarded in selected period'
            : `${stats.activeDistributors} active · ${stats.pendingDistributors} pending · ${stats.suspendedDistributors} suspended`
        }
        icon={<Users className="size-6 text-primary" />}
        iconBgColor="bg-primary/10"
      />
      <KPICard
        title="eSIMs Sold"
        value={formatNumber(stats.esimsSold)}
        subtitle={filtered ? 'Sold in selected period' : 'Across the network'}
        icon={<ShoppingCart className="size-6 text-chart-3" />}
        iconBgColor="bg-chart-3/10"
      />
      <KPICard
        title="Gross Revenue"
        value={formatCurrency(stats.grossRevenue)}
        subtitle={filtered ? 'Revenue in selected period' : 'Total sales volume'}
        icon={<DollarSign className="size-6 text-chart-2" />}
        iconBgColor="bg-chart-2/10"
      />
      <KPICard
        title="Total Customers"
        value={formatNumber(stats.totalCustomers)}
        subtitle={filtered ? 'Acquired in selected period' : 'End customers'}
        icon={<UserRound className="size-6 text-chart-4" />}
        iconBgColor="bg-chart-4/10"
      />
      <KPICard
        title="Credit in Circulation"
        // Live snapshot — we keep no historical balances, so it can't be scoped
        // to a past period. Flag it as current when a filter is active.
        value={formatCurrency(stats.creditInCirculation)}
        subtitle={filtered ? `As of today · held by ${held}` : `Unspent, held by ${held}`}
        icon={<Wallet className="size-6 text-chart-1" />}
        iconBgColor="bg-chart-1/10"
      />
    </div>
  )
}
