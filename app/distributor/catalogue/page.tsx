'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { getCurrentDistributor, type CurrentDistributor } from '@/lib/supabase/auth'
import { getCustomers, type DistributorCustomer } from '@/lib/distributor-customers-store'
import { CatalogueExplorer } from '@/components/catalogue/catalogue-explorer'
import { type Plan, priceValue, formatData } from '@/lib/catalogue-format'
import { EsimResultDialog, type IssuedEsim } from '@/components/orders/esim-result-dialog'

export default function DistributorCataloguePage() {
  const [me, setMe] = useState<CurrentDistributor | null>(null)
  const [customers, setCustomers] = useState<DistributorCustomer[]>([])

  // order dialog
  const [selectedPkg, setSelectedPkg] = useState<Plan | null>(null)
  const [customerId, setCustomerId] = useState('')
  const [salePrice, setSalePrice] = useState('')
  const [placing, setPlacing] = useState(false)

  // result dialog
  const [result, setResult] = useState<{
    esim: IssuedEsim
    title: string
    customer: string
    orderId: string
    customerEmail: string
  } | null>(null)
  const [resultOpen, setResultOpen] = useState(false)

  useEffect(() => {
    getCurrentDistributor().then((d) => {
      setMe(d)
      if (d) getCustomers(d.id).then(setCustomers)
    })
  }, [])

  function openOrder(pkg: Plan) {
    setSelectedPkg(pkg)
    setCustomerId('')
    // Prefill the sale price with the cost — distributor raises it to their markup.
    const cost = priceValue(pkg, 'USD')
    setSalePrice(cost != null ? cost.toFixed(2) : '')
  }

  const orderPrice = selectedPkg ? priceValue(selectedPkg, 'USD') : null
  const canAfford = orderPrice != null && me != null && me.walletBalance >= orderPrice
  const saleNum = Number(salePrice)
  const saleEntered = Number.isFinite(saleNum) && saleNum > 0
  // Distributors can't sell below what the eSIM costs them — that'd be a loss.
  const belowCost = saleEntered && orderPrice != null && saleNum < orderPrice
  const validSale = saleEntered && !belowCost
  const profit = saleEntered && orderPrice != null ? saleNum - orderPrice : null

  async function handlePlaceOrder() {
    if (!selectedPkg || !customerId || !me) return
    if (orderPrice == null) {
      toast.error('This package has no USD price and cannot be ordered.')
      return
    }
    setPlacing(true)
    const supabase = createClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()

    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token ?? ''}`,
      },
      body: JSON.stringify({
        customerId,
        packageId: selectedPkg.id,
        packageTitle: selectedPkg.title,
        currency: 'USD',
        unitPrice: orderPrice,
        salePrice: saleNum,
      }),
    })
    const json = await res.json()
    setPlacing(false)

    if (!res.ok) {
      toast.error('Order failed', { description: json.error })
      return
    }

    const customer = customers.find((c) => c.id === customerId)
    setResult({
      esim: json.esim,
      title: selectedPkg.title,
      customer: customer?.name ?? 'customer',
      orderId: json.order?.orderId ?? '',
      customerEmail: customer?.email ?? '',
    })
    setSelectedPkg(null)
    setResultOpen(true)
    getCurrentDistributor().then((d) => {
      if (d) setMe(d)
    })
    toast.success('eSIM issued', { description: `${selectedPkg.title} — ${customer?.name ?? ''}` })
  }

  return (
    <div className="space-y-6">
      {/* Wallet chip */}
      <div className="flex items-center justify-end">
        <div className="flex items-center gap-2 rounded-lg border bg-primary/5 px-3 py-2">
          <Wallet className="size-4 text-primary" />
          <div>
            <p className="text-xs leading-none text-muted-foreground">Wallet balance</p>
            <p className="font-bold leading-tight">${(me?.walletBalance ?? 0).toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Destination-first catalogue (shared with the admin page) */}
      <CatalogueExplorer onOrder={openOrder} orderLabel="Order eSIM" />

      {/* Order dialog */}
      <Dialog open={!!selectedPkg} onOpenChange={(o) => { if (!o) setSelectedPkg(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Place Order</DialogTitle>
          </DialogHeader>
          {selectedPkg && (
            <div className="space-y-4 pt-1">
              <div className="space-y-1 rounded-lg border bg-muted/40 p-3">
                <p className="text-sm font-semibold">{selectedPkg.title}</p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{formatData(selectedPkg.dataMB, selectedPkg.is_unlimited, selectedPkg.title)}</span>
                  <span>·</span>
                  <span>{selectedPkg.day} days</span>
                  <span>·</span>
                  <span>{selectedPkg.location}</span>
                </div>
                <p className="text-sm font-bold text-primary">${orderPrice?.toFixed(2)}</p>
              </div>

              <div className="space-y-1.5">
                <Label>Customer</Label>
                {customers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No customers yet.{' '}
                    <a href="/distributor/customers" className="text-primary underline">
                      Add one first.
                    </a>
                  </p>
                ) : (
                  <Select value={customerId} onValueChange={setCustomerId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a customer" />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name} — {c.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Sale price to the customer (drives real profit) */}
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
                  What you charge the customer. Prefilled with your cost — raise it to your price.
                </p>
                {belowCost && (
                  <p className="text-xs font-medium text-destructive">
                    Sale price can’t be below your cost of ${orderPrice?.toFixed(2)}. Raise it to at
                    least cover the cost.
                  </p>
                )}
              </div>

              <div className="space-y-1 rounded-lg border border-primary/10 bg-primary/5 px-3 py-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Charge to wallet (cost)</span>
                  <span className="font-bold text-primary">${orderPrice?.toFixed(2)}</span>
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
                    ${Math.max(0, (me?.walletBalance ?? 0) - (orderPrice ?? 0)).toLocaleString()}
                  </span>
                </div>
              </div>
              {!canAfford && (
                <p className="text-xs text-destructive">
                  Insufficient wallet balance for this package.
                </p>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="outline" onClick={() => setSelectedPkg(null)}>
                  Cancel
                </Button>
                <Button
                  onClick={handlePlaceOrder}
                  disabled={placing || !customerId || !canAfford || !validSale}
                >
                  {placing ? 'Processing…' : 'Pay & Issue eSIM'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* eSIM result */}
      <EsimResultDialog
        open={resultOpen}
        onOpenChange={setResultOpen}
        packageTitle={result?.title ?? ''}
        customerName={result?.customer ?? ''}
        esim={result?.esim ?? null}
        orderId={result?.orderId ?? ''}
        customerEmail={result?.customerEmail ?? ''}
      />
    </div>
  )
}
