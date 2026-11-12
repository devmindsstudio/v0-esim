'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Wallet, Download, Mail, CheckCircle2, Boxes, Loader2, AlertTriangle, XCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { WhatsAppDeliveryButton } from '@/components/orders/whatsapp-delivery-button'
import { getCurrentDistributor, type CurrentDistributor } from '@/lib/supabase/auth'
import { getCustomers, type DistributorCustomer } from '@/lib/distributor-customers-store'
import { CatalogueExplorer } from '@/components/catalogue/catalogue-explorer'
import { type Plan, priceValue, formatData } from '@/lib/catalogue-format'
import { type IssuedEsim } from '@/components/orders/esim-result-dialog'
import { downloadEsimBatch } from '@/lib/bulk-download'

const MAX_QTY = 50

type IssuedRow = IssuedEsim & { orderId: string }

export default function BulkOrderPage() {
  const [me, setMe] = useState<CurrentDistributor | null>(null)
  const [customers, setCustomers] = useState<DistributorCustomer[]>([])
  const [buyerId, setBuyerId] = useState('')

  // plan picked from the catalogue → opens the bulk compose dialog
  const [selectedPkg, setSelectedPkg] = useState<Plan | null>(null)
  const [qty, setQty] = useState('10')
  const [salePrice, setSalePrice] = useState('')

  // batch run
  const [phase, setPhase] = useState<'browse' | 'running' | 'done'>('browse')
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [issued, setIssued] = useState<IssuedRow[]>([])
  const [failures, setFailures] = useState<{ index: number; error: string }[]>([])
  const [batchId, setBatchId] = useState('')
  const [emailing, setEmailing] = useState(false)
  const [emailed, setEmailed] = useState(false)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    getCurrentDistributor().then((d) => {
      setMe(d)
      if (d) getCustomers(d.id).then(setCustomers)
    })
  }, [])

  function pickPlan(plan: Plan) {
    setSelectedPkg(plan)
    setQty('10')
    // Prefill sale price with the per-eSIM cost — distributor raises it.
    const cost = priceValue(plan, 'USD')
    setSalePrice(cost != null ? cost.toFixed(2) : '')
  }

  const quantity = Math.max(0, Math.floor(Number(qty) || 0))
  const price = selectedPkg ? priceValue(selectedPkg, 'USD') : null
  const total = price != null ? price * quantity : null
  const validQty = quantity >= 1 && quantity <= MAX_QTY
  const canAfford = total != null && me != null && me.walletBalance >= total
  const buyer = customers.find((c) => c.id === buyerId) ?? null
  const saleNum = Number(salePrice)
  const saleEntered = Number.isFinite(saleNum) && saleNum > 0
  // No selling below cost — the per-eSIM sale price must at least cover the unit price.
  const belowCost = saleEntered && price != null && saleNum < price
  const validSale = saleEntered && !belowCost
  const profitEach = saleEntered && price != null ? saleNum - price : null
  const canIssue = !!buyer && !!selectedPkg && price != null && validQty && canAfford && validSale

  async function handleIssue() {
    if (!canIssue || !buyer || !selectedPkg || price == null) return
    const supabase = createClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()
    const bId = crypto.randomUUID()

    setBatchId(bId)
    setPhase('running')
    setProgress({ done: 0, total: quantity })
    setIssued([])
    setFailures([])
    setEmailed(false)

    const okList: IssuedRow[] = []
    const failList: { index: number; error: string }[] = []
    let lastBalance = me?.walletBalance ?? 0

    for (let i = 0; i < quantity; i++) {
      try {
        const res = await fetch('/api/orders', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token ?? ''}`,
          },
          body: JSON.stringify({
            customerId: buyer.id,
            packageId: selectedPkg.id,
            packageTitle: selectedPkg.title,
            currency: 'USD',
            unitPrice: price,
            salePrice: saleNum,
            batchId: bId,
          }),
        })
        const json = await res.json().catch(() => ({}))
        if (!res.ok) {
          failList.push({ index: i + 1, error: json.error ?? 'Failed to issue' })
          // If the wallet ran dry mid-batch, stop — the rest will all fail too.
          if (typeof json.error === 'string' && /insufficient/i.test(json.error)) {
            setProgress({ done: quantity, total: quantity })
            break
          }
        } else {
          okList.push({ ...(json.esim as IssuedEsim), orderId: json.order?.orderId ?? '' })
          if (typeof json.order?.walletBalance === 'number') lastBalance = json.order.walletBalance
        }
      } catch (e: unknown) {
        failList.push({ index: i + 1, error: e instanceof Error ? e.message : 'Network error' })
      }
      setProgress({ done: i + 1, total: quantity })
      setIssued([...okList])
      setFailures([...failList])
    }

    // Final sync — the `break` above (wallet ran dry) exits before the in-loop
    // setFailures, so we push the final lists here to guarantee the result card
    // and its reasons list always match what actually happened.
    setIssued([...okList])
    setFailures([...failList])

    setMe((m) => (m ? { ...m, walletBalance: lastBalance } : m))
    getCurrentDistributor().then((d) => {
      if (d) setMe(d)
    })

    setPhase('done')
    if (failList.length === 0) {
      toast.success(`${okList.length} eSIMs issued`)
    } else if (okList.length === 0) {
      // Nothing succeeded — this is an error, not a partial success.
      toast.error(
        `Could not issue ${failList.length === 1 ? 'the eSIM' : `any of the ${failList.length} eSIMs`}`,
        { description: 'Nothing was charged to your wallet. See the reason below.' },
      )
    } else {
      toast.warning(`${okList.length} issued, ${failList.length} failed`, {
        description: 'Failed eSIMs were not charged.',
      })
    }
  }

  async function handleDownload() {
    if (issued.length === 0) return
    setDownloading(true)
    try {
      await downloadEsimBatch(
        issued.map((e) => ({
          esimNumber: e.esimNumber,
          iccid: e.iccid,
          activationCode: e.activationCode,
          qrPayload: e.qrPayload,
        })),
        { packageTitle: selectedPkg?.title ?? 'eSIM', customerName: buyer?.name ?? 'batch' },
      )
    } catch {
      toast.error('Could not build the download. Please try again.')
    } finally {
      setDownloading(false)
    }
  }

  async function handleEmail() {
    if (!batchId) return
    setEmailing(true)
    const supabase = createClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()
    const res = await fetch('/api/esim/bulk-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token ?? ''}`,
      },
      body: JSON.stringify({ batchId }),
    })
    const json = await res.json().catch(() => ({}))
    setEmailing(false)
    if (!res.ok) {
      toast.error('Could not email the batch', { description: json.error ?? 'Please try again.' })
      return
    }
    setEmailed(true)
    toast.success(`Emailed ${json.count ?? issued.length} eSIMs`, {
      description: `Sent to ${json.to ?? 'the buyer'}.`,
    })
  }

  function startAnother() {
    setPhase('browse')
    setSelectedPkg(null)
    setProgress({ done: 0, total: 0 })
    setIssued([])
    setFailures([])
    setBatchId('')
    setEmailed(false)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Boxes className="size-6 text-primary" /> Bulk Order
          </h1>
          <p className="text-muted-foreground">
            Issue many eSIMs of one package to a single buyer.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border bg-primary/5 px-3 py-2">
          <Wallet className="size-4 text-primary" />
          <div>
            <p className="text-xs leading-none text-muted-foreground">Wallet balance</p>
            <p className="font-bold leading-tight">${(me?.walletBalance ?? 0).toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* ---------- BROWSE (pick a plan) ---------- */}
      {phase === 'browse' && (
        <>
          <CatalogueExplorer onOrder={pickPlan} orderLabel="Bulk order this plan" />

          {/* Bulk compose dialog — buyer + quantity for the picked plan */}
          <Dialog open={!!selectedPkg} onOpenChange={(o) => { if (!o) setSelectedPkg(null) }}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Bulk order</DialogTitle>
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
                    <p className="text-sm font-bold text-primary">
                      {price != null ? `$${price.toFixed(2)}` : '—'} each
                    </p>
                  </div>

                  {/* Buyer */}
                  <div className="space-y-1.5">
                    <Label>Buyer (all eSIMs go to this customer)</Label>
                    {customers.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No customers yet.{' '}
                        <a href="/distributor/customers" className="text-primary underline">
                          Add one first.
                        </a>
                      </p>
                    ) : (
                      <Select value={buyerId} onValueChange={setBuyerId}>
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

                  {/* Quantity */}
                  <div className="space-y-1.5">
                    <Label>Quantity</Label>
                    <Input
                      type="number"
                      min={1}
                      max={MAX_QTY}
                      step={1}
                      value={qty}
                      onChange={(e) => setQty(e.target.value)}
                      className="w-32"
                    />
                    <p className="text-xs text-muted-foreground">Up to {MAX_QTY} per batch.</p>
                  </div>

                  {/* Sale price per eSIM (drives real profit) */}
                  <div className="space-y-1.5">
                    <Label>Sale price to customer (each)</Label>
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
                      Applied to every eSIM in this batch. Prefilled with your cost.
                      {profitEach != null && (
                        <>
                          {' '}Profit each:{' '}
                          <span className={cn('font-medium', profitEach < 0 ? 'text-destructive' : 'text-green-600')}>
                            {profitEach < 0 ? '-' : '+'}${Math.abs(profitEach).toFixed(2)}
                          </span>
                        </>
                      )}
                    </p>
                  </div>

                  {/* Charge summary */}
                  <div className="space-y-1 rounded-lg border border-primary/10 bg-primary/5 px-3 py-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Total charge ({validQty ? quantity : 0} × unit)
                      </span>
                      <span className="font-bold text-primary">
                        {total != null && validQty ? `$${total.toFixed(2)}` : '—'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Balance after</span>
                      <span
                        className={cn('font-semibold', total != null && !canAfford && 'text-destructive')}
                      >
                        {total != null && validQty
                          ? `$${Math.max(0, (me?.walletBalance ?? 0) - total).toLocaleString()}`
                          : '—'}
                      </span>
                    </div>
                  </div>

                  {belowCost && (
                    <p className="text-xs font-medium text-destructive">
                      Sale price can’t be below your cost of ${price?.toFixed(2)} each. Raise it to at
                      least cover the cost.
                    </p>
                  )}
                  {quantity > MAX_QTY && (
                    <p className="text-xs text-destructive">Maximum {MAX_QTY} eSIMs per batch.</p>
                  )}
                  {total != null && validQty && !canAfford && (
                    <p className="text-xs text-destructive">
                      Insufficient wallet balance for this batch.
                    </p>
                  )}

                  <div className="flex justify-end gap-2 pt-1">
                    <Button type="button" variant="outline" onClick={() => setSelectedPkg(null)}>
                      Cancel
                    </Button>
                    <Button onClick={handleIssue} disabled={!canIssue}>
                      <Boxes className="mr-2 size-4" />
                      Issue {validQty ? quantity : ''} eSIM{quantity === 1 ? '' : 's'}
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </>
      )}

      {/* ---------- RUNNING ---------- */}
      {phase === 'running' && (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
            <Loader2 className="size-8 animate-spin text-primary" />
            <div>
              <p className="font-semibold">Issuing eSIMs…</p>
              <p className="text-sm text-muted-foreground">
                {progress.done} of {progress.total} · please keep this tab open
              </p>
            </div>
            <div className="h-2 w-full max-w-md overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }}
              />
            </div>
            {failures.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {failures.length} failed so far (auto-refunded)
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* ---------- DONE ---------- */}
      {phase === 'done' && (
        <div className="space-y-5">
          <Card
            className={cn(
              issued.length === 0 && 'border-destructive/40 bg-destructive/5',
              issued.length > 0 && failures.length > 0 && 'border-amber-500/40 bg-amber-500/5',
            )}
          >
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                {/* Icon reflects the real outcome so a zero-success batch never
                    looks like a success. */}
                {issued.length === 0 ? (
                  <XCircle className="mt-0.5 size-6 shrink-0 text-destructive" />
                ) : failures.length > 0 ? (
                  <AlertTriangle className="mt-0.5 size-6 shrink-0 text-amber-600" />
                ) : (
                  <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-green-600" />
                )}
                <div className="flex-1">
                  {issued.length === 0 ? (
                    <>
                      <p className="font-semibold text-destructive">
                        No eSIMs were issued
                        {failures.length > 0 && ` — all ${failures.length} attempt${failures.length === 1 ? '' : 's'} failed`}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Nothing was charged to your wallet. See the reason{failures.length === 1 ? '' : 's'} below, then try again.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="font-semibold">
                        {issued.length} eSIM{issued.length === 1 ? '' : 's'} issued
                        {failures.length > 0 && ` · ${failures.length} failed (refunded)`}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {selectedPkg?.title} for {buyer?.name}. Download the batch or email it to the buyer.
                      </p>
                    </>
                  )}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {issued.length > 0 && (
                  <>
                    <Button onClick={handleDownload} disabled={downloading}>
                      {downloading ? (
                        <>
                          <Loader2 className="mr-1.5 size-4 animate-spin" /> Preparing…
                        </>
                      ) : (
                        <>
                          <Download className="mr-1.5 size-4" /> Download all (ZIP + CSV)
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleEmail}
                      disabled={emailing || emailed || !buyer?.email}
                    >
                      {emailing ? (
                        <>
                          <Loader2 className="mr-1.5 size-4 animate-spin" /> Sending…
                        </>
                      ) : emailed ? (
                        <>
                          <CheckCircle2 className="mr-1.5 size-4 text-green-600" /> Emailed
                        </>
                      ) : (
                        <>
                          <Mail className="mr-1.5 size-4" /> Email to buyer
                        </>
                      )}
                    </Button>
                    <WhatsAppDeliveryButton />
                  </>
                )}
                <Button variant={issued.length === 0 ? 'default' : 'ghost'} onClick={startAnother}>
                  {issued.length === 0 ? 'Try again' : 'Start another batch'}
                </Button>
              </div>
              {issued.length > 0 && !buyer?.email && (
                <p className="mt-2 text-xs text-muted-foreground">
                  No email on file for this buyer — add one on the Customers page to email the batch.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Issued list */}
          {issued.length > 0 && (
            <div className="max-h-80 divide-y overflow-auto rounded-md border">
              {issued.map((e, i) => (
                <div
                  key={e.orderId || i}
                  className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"
                >
                  <span className="w-8 shrink-0 text-muted-foreground">#{i + 1}</span>
                  <span className="flex-1 truncate font-mono">{e.esimNumber}</span>
                  <span className="hidden flex-1 truncate font-mono text-xs text-muted-foreground sm:block">
                    {e.iccid}
                  </span>
                  <Badge variant="outline" className="shrink-0 text-xs">
                    issued
                  </Badge>
                </div>
              ))}
            </div>
          )}

          {/* Failures */}
          {failures.length > 0 && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4">
              <p className="mb-2 text-sm font-medium text-destructive">
                {failures.length === 1 ? 'This eSIM' : `These ${failures.length} eSIMs`} could not be issued (not charged):
              </p>
              <ul className="space-y-1 text-xs text-muted-foreground">
                {failures.slice(0, 8).map((f) => (
                  <li key={f.index}>
                    #{f.index} — {f.error}
                  </li>
                ))}
                {failures.length > 8 && <li>…and {failures.length - 8} more</li>}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
