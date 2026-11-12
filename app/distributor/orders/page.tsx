'use client'

import { useEffect, useState } from 'react'
import { ShoppingBag, Wifi, DollarSign } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from '@/components/ui/table'
import { getCurrentDistributor } from '@/lib/supabase/auth'
import { getDistributorOrders, type DistributorOrder } from '@/lib/orders'

const statusBadge: Record<string, string> = {
  fulfilled: 'bg-green-500/10 text-green-600 border-green-500/20',
  paid: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  pending: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
  failed: 'bg-red-500/10 text-red-600 border-red-500/20',
  refunded: 'bg-muted text-muted-foreground border-border',
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function DistributorOrdersPage() {
  const [orders, setOrders] = useState<DistributorOrder[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getCurrentDistributor().then(async (d) => {
      if (d) setOrders(await getDistributorOrders(d.id))
      setLoading(false)
    })
  }, [])

  const totalSpent = orders.reduce((s, o) => s + o.total, 0)
  const totalEsims = orders.filter((o) => o.esimNumber).length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Orders</h1>
        <p className="text-muted-foreground">Every eSIM you&apos;ve issued to your customers.</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-muted">
              <ShoppingBag className="size-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{orders.length}</p>
              <p className="text-xs text-muted-foreground">Total Orders</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-muted">
              <Wifi className="size-5 text-orange-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalEsims}</p>
              <p className="text-xs text-muted-foreground">eSIMs Issued</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-muted">
              <DollarSign className="size-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">${totalSpent.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Total Spent</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Orders Table */}
      <div className="rounded-md border">
        {loading ? (
          <div className="text-center text-muted-foreground py-10 text-sm">Loading orders…</div>
        ) : orders.length === 0 ? (
          <div className="text-center text-muted-foreground py-10 text-sm">
            No orders yet. Place one from Browse Catalogue.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Package</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>eSIM</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="text-sm font-medium max-w-[220px] truncate">{o.packageTitle}</TableCell>
                  <TableCell className="text-sm">{o.customerName}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {o.esimNumber ?? '—'}
                  </TableCell>
                  <TableCell className="text-right font-semibold text-sm">${o.total.toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={statusBadge[o.status] ?? statusBadge.pending}>
                      {o.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDate(o.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )
}
