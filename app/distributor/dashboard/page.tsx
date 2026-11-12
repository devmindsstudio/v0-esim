'use client'

import { useEffect, useState } from 'react'
import { Wallet, ShoppingBag, TrendingUp, Wifi, ArrowRight } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { getCurrentDistributor, type CurrentDistributor } from '@/lib/supabase/auth'
import { getDistributorOrders, type DistributorOrder } from '@/lib/orders'
import { BrandBanner } from '@/components/branding/brand-banner'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function DistributorDashboardPage() {
  const [session, setSession] = useState<CurrentDistributor | null>(null)
  const [orders, setOrders] = useState<DistributorOrder[]>([])

  useEffect(() => {
    getCurrentDistributor().then((d) => {
      setSession(d)
      if (d) getDistributorOrders(d.id).then(setOrders)
    })
  }, [])

  if (!session) return null

  const totalRevenue = orders.reduce((s, o) => s + o.total, 0)
  const recentOrders = orders.slice(0, 3)

  return (
    <div className="space-y-6">
      {/* Co-brand banner */}
      <BrandBanner />

      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Welcome back, {session.name.split(' ')[0]}</h1>
        <p className="text-muted-foreground">{session.company} — {session.country}</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="card-hover">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-primary/10">
              <Wallet className="size-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold font-display tracking-tight">
                ${session.walletBalance.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">Wallet Balance</p>
            </div>
          </CardContent>
        </Card>
        <Card className="card-hover">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-chart-3/10">
              <ShoppingBag className="size-5 text-chart-3" />
            </div>
            <div>
              <p className="text-2xl font-bold font-display tracking-tight">{orders.length}</p>
              <p className="text-xs text-muted-foreground">Total Orders</p>
            </div>
          </CardContent>
        </Card>
        <Card className="card-hover">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-success/10">
              <TrendingUp className="size-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold font-display tracking-tight">
                ${totalRevenue.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">Total Spent</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Link href="/distributor/catalogue">
          <Card className="card-hover cursor-pointer">
            <CardContent className="flex items-center justify-between p-5">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10">
                  <Wifi className="size-4 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Browse Catalogue</p>
                  <p className="text-xs text-muted-foreground">Order new eSIM plans</p>
                </div>
              </div>
              <ArrowRight className="size-4 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
        <Link href="/distributor/profit">
          <Card className="card-hover cursor-pointer">
            <CardContent className="flex items-center justify-between p-5">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-success/10">
                  <TrendingUp className="size-4 text-success" />
                </div>
                <div>
                  <p className="font-semibold text-sm">My Profit</p>
                  <p className="text-xs text-muted-foreground">Track your top-up &amp; selling profit</p>
                </div>
              </div>
              <ArrowRight className="size-4 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Recent Orders */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold">Recent Orders</h2>
          <Link href="/distributor/orders">
            <Button variant="ghost" size="sm" className="text-xs">
              View all <ArrowRight className="size-3 ml-1" />
            </Button>
          </Link>
        </div>
        <div className="rounded-md border divide-y">
          {recentOrders.length === 0 ? (
            <div className="text-center text-muted-foreground py-8 text-sm">
              No orders yet. Place one from Browse Catalogue.
            </div>
          ) : (
            recentOrders.map((order) => (
              <div key={order.id} className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{order.packageTitle}</p>
                  <p className="text-xs text-muted-foreground">
                    {order.customerName} · {formatDate(order.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-sm font-semibold">${order.total.toLocaleString()}</span>
                  <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20 text-xs">
                    {order.status}
                  </Badge>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
