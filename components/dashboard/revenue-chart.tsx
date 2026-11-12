'use client'

import { useEffect, useState } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { getRevenueSeries, type RevenuePoint, type SeriesPeriod } from '@/lib/admin-dashboard'
import { type DashboardRange } from '@/lib/dashboard-range'

const chartConfig = {
  revenue: {
    label: 'Revenue ($)',
    color: 'var(--chart-1)',
  },
  esimsSold: {
    label: 'eSIMs Sold',
    color: 'var(--chart-2)',
  },
} satisfies ChartConfig

function formatDate(dateStr: string, period: SeriesPeriod): string {
  // Parse the YYYY-MM-DD bucket key as a LOCAL date (avoids a UTC off-by-one).
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  if (period === 'month') {
    return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function RevenueChart({ range }: { range?: DashboardRange }) {
  const [period, setPeriod] = useState<SeriesPeriod>('day')
  const [data, setData] = useState<RevenuePoint[]>([])

  useEffect(() => {
    getRevenueSeries(range, period).then(setData)
  }, [range, period])

  const chartData = data.map((item) => ({
    ...item,
    formattedDate: formatDate(item.date, period),
  }))

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-semibold">
          Revenue & Volume Trend
        </CardTitle>
        <Tabs value={period} onValueChange={(v) => setPeriod(v as typeof period)}>
          <TabsList className="h-8">
            <TabsTrigger value="day" className="text-xs px-3">
              Day
            </TabsTrigger>
            <TabsTrigger value="week" className="text-xs px-3">
              Week
            </TabsTrigger>
            <TabsTrigger value="month" className="text-xs px-3">
              Month
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <AreaChart
            data={chartData}
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="fillRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-revenue)"
                  stopOpacity={0.3}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-revenue)"
                  stopOpacity={0}
                />
              </linearGradient>
              <linearGradient id="fillEsims" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-esimsSold)"
                  stopOpacity={0.3}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-esimsSold)"
                  stopOpacity={0}
                />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="formattedDate"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              fontSize={12}
              interval="preserveStartEnd"
            />
            <YAxis
              yAxisId="revenue"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              fontSize={12}
              tickFormatter={(value) => `$${value}`}
            />
            <YAxis
              yAxisId="esims"
              orientation="right"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              fontSize={12}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(value) => value}
                  formatter={(value, name) => {
                    if (name === 'revenue') {
                      return [`$${value.toLocaleString()}`, 'Revenue']
                    }
                    return [value.toLocaleString(), 'eSIMs Sold']
                  }}
                />
              }
            />
            <Area
              yAxisId="revenue"
              type="monotone"
              dataKey="revenue"
              stroke="var(--color-revenue)"
              strokeWidth={2}
              fill="url(#fillRevenue)"
            />
            <Area
              yAxisId="esims"
              type="monotone"
              dataKey="esimsSold"
              stroke="var(--color-esimsSold)"
              strokeWidth={2}
              fill="url(#fillEsims)"
            />
          </AreaChart>
        </ChartContainer>
        <div className="flex items-center justify-center gap-6 mt-4">
          <div className="flex items-center gap-2">
            <div className="size-3 rounded-full bg-chart-1" />
            <span className="text-sm text-muted-foreground">Revenue ($)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="size-3 rounded-full bg-chart-2" />
            <span className="text-sm text-muted-foreground">eSIMs Sold</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
