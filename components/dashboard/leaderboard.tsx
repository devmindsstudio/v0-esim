'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import Link from 'next/link'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { ChevronRight } from 'lucide-react'
import { getDistributorAggregates, topDistributors, type DistributorAgg } from '@/lib/admin-dashboard'
import { type DashboardRange } from '@/lib/dashboard-range'

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getInitials(name: string): string {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
}

export function Leaderboard({ range }: { range?: DashboardRange }) {
  const [rows, setRows] = useState<DistributorAgg[]>([])

  useEffect(() => {
    getDistributorAggregates(range).then((aggs) => setRows(topDistributors(aggs, 10)))
  }, [range])

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-semibold">Top Distributors</CardTitle>
        <Button asChild variant="ghost" size="sm" className="gap-1 text-primary">
          <Link href="/distributors">
            View all
            <ChevronRight className="size-4" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="px-0">
        {rows.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-muted-foreground">
            No distributors yet.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-12 pl-6">#</TableHead>
                <TableHead>Distributor</TableHead>
                <TableHead className="text-right">eSIMs</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right pr-6">Last Sale</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((d, index) => (
                <TableRow key={d.id}>
                  <TableCell className="pl-6">
                    <span className={index < 3 ? 'font-bold text-primary' : 'text-muted-foreground'}>
                      {index + 1}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="size-8">
                        <AvatarFallback className="bg-primary/10 text-primary text-xs">
                          {getInitials(d.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <span className="font-medium text-sm">{d.name}</span>
                        <span className="text-xs text-muted-foreground">{d.company}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-medium">{d.esims}</TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(d.revenue)}</TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground pr-6">
                    {formatDate(d.lastSale)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
