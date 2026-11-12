'use client'

import { useMemo, useState } from 'react'
import { KPICards } from '@/components/dashboard/kpi-cards'
import { DateFilterStrip } from '@/components/dashboard/date-filter-strip'
import { RevenueChart } from '@/components/dashboard/revenue-chart'
import { Leaderboard } from '@/components/dashboard/leaderboard'
import { ActivityFeed } from '@/components/dashboard/activity-feed'
import { QuickActions } from '@/components/dashboard/quick-actions'
import { type DashboardRange } from '@/lib/dashboard-range'

export default function DashboardPage() {
  // The filter strip owns the picker UI; we mirror the resulting range here and
  // pass it to the period-based widgets so the whole dashboard responds to it.
  const [from, setFrom] = useState<Date>()
  const [to, setTo] = useState<Date>()

  // Memoise on the underlying timestamps so children only refetch when the
  // selected period actually changes (not on every render).
  const range = useMemo<DashboardRange>(
    () => ({ from, to }),
    [from?.getTime(), to?.getTime()],
  )

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Overview of your distribution network performance
          </p>
        </div>
        <QuickActions />
      </div>

      {/* Date Filter */}
      <DateFilterStrip
        onDateChange={(nextFrom, nextTo) => {
          setFrom(nextFrom)
          setTo(nextTo)
        }}
      />

      {/* KPI Cards */}
      <KPICards range={range} />

      {/* Charts and Tables Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <RevenueChart range={range} />
        </div>
        <div>
          <ActivityFeed />
        </div>
      </div>

      {/* Leaderboard */}
      <Leaderboard range={range} />
    </div>
  )
}
