'use client'

import { useCallback, useEffect, useState } from 'react'
import { ArrowUpRight, ArrowDownLeft, Wallet, Layers, Plus, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from '@/components/ui/table'
import { createClient } from '@/lib/supabase/client'
import {
  getCreditCirculation,
  getCreditPool,
  getCreditPoolLedger,
  getAdminCreditTransactions,
  isCredit,
  type CreditCirculation,
  type CreditPool,
  type CreditPoolTx,
  type AdminCreditTx,
  type WalletTxType,
} from '@/lib/wallet'

const TYPE_LABEL: Record<WalletTxType, string> = {
  allocation: 'Allocation',
  topup: 'Top-up',
  refund: 'Refund',
  debit: 'Debit',
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(amount)
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

export default function WalletPage() {
  const [circ, setCirc] = useState<CreditCirculation | null>(null)
  const [pool, setPool] = useState<CreditPool | null>(null)
  const [poolTxs, setPoolTxs] = useState<CreditPoolTx[]>([])
  const [txs, setTxs] = useState<AdminCreditTx[]>([])
  const [loadOpen, setLoadOpen] = useState(false)

  const refresh = useCallback(() => {
    getCreditCirculation().then(setCirc)
    getCreditPool().then(setPool)
    getCreditPoolLedger().then(setPoolTxs)
    getAdminCreditTransactions().then(setTxs)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  if (!circ || !pool) return null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Credit &amp; Wallet</h1>
        <p className="text-muted-foreground">
          Load credit bought from eTijwaal into the pool, then allocate it to your distributors.
        </p>
      </div>

      {/* Pool + circulation */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Credit pool — the inventory Ibara draws from when allocating */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
                  <Layers className="size-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{formatCurrency(pool.balance)}</p>
                  <p className="text-xs text-muted-foreground">
                    Credit pool — available to allocate
                  </p>
                </div>
              </div>
              <Button size="sm" className="gap-1.5 shrink-0" onClick={() => setLoadOpen(true)}>
                <Plus className="size-4" />
                Load Credit
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-3 pt-3 border-t">
              {formatCurrency(pool.totalLoaded)} loaded from eTijwaal in total.
            </p>
          </CardContent>
        </Card>

        {/* Credit in circulation — unspent credit already held in distributor wallets */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-muted">
                <Wallet className="size-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatCurrency(circ.inCirculation)}</p>
                <p className="text-xs text-muted-foreground">
                  In circulation across {circ.distributorsHolding} distributor{circ.distributorsHolding === 1 ? '' : 's'}
                </p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-3 pt-3 border-t">
              Credit already allocated and not yet spent on eSIMs.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Pool activity — loads in, allocations out */}
      <div>
        <h2 className="text-base font-semibold mb-3">Pool Activity</h2>
        <div className="rounded-md border">
          {poolTxs.length === 0 ? (
            <div className="text-center text-muted-foreground py-10 text-sm">
              No pool activity yet. Use <span className="font-medium">Load Credit</span> to add your first eTijwaal purchase.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Note</TableHead>
                  <TableHead className="text-right">Cash paid</TableHead>
                  <TableHead className="text-right">Credit</TableHead>
                  <TableHead className="text-right">Pool after</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {poolTxs.map((tx) => {
                  const isLoad = tx.type === 'load'
                  return (
                    <TableRow key={tx.id}>
                      <TableCell>
                        {isLoad ? (
                          <div className="flex items-center gap-1 text-green-600 text-xs font-medium">
                            <ArrowDownLeft className="size-3" /> Load
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-orange-600 text-xs font-medium">
                            <ArrowUpRight className="size-3" /> Allocation
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{tx.note || (isLoad ? 'eTijwaal credit loaded' : 'Allocated to distributor')}</TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">
                        {tx.cashPaid == null ? '—' : `$${tx.cashPaid.toLocaleString()}`}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-sm">
                        {isLoad
                          ? <span className="text-green-600">+${tx.creditAmount.toLocaleString()}</span>
                          : <span>-${tx.creditAmount.toLocaleString()}</span>}
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">
                        ${tx.balanceAfter.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDate(tx.createdAt)}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      {/* Distributor wallet transactions across the network */}
      <div>
        <h2 className="text-base font-semibold mb-3">Recent Transactions</h2>
        <div className="rounded-md border">
          {txs.length === 0 ? (
            <div className="text-center text-muted-foreground py-10 text-sm">
              No credit transactions yet. Allocate credit to a distributor to get started.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Distributor</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {txs.map((tx) => {
                  const credit = isCredit(tx.type)
                  return (
                    <TableRow key={tx.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{tx.distributorName}</p>
                          <p className="text-xs text-muted-foreground">{tx.company}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {tx.note || TYPE_LABEL[tx.type]}
                      </TableCell>
                      <TableCell>
                        {credit ? (
                          <div className="flex items-center gap-1 text-green-600 text-xs font-medium">
                            <ArrowDownLeft className="size-3" /> {TYPE_LABEL[tx.type]}
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-orange-600 text-xs font-medium">
                            <ArrowUpRight className="size-3" /> {TYPE_LABEL[tx.type]}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-sm">
                        {credit
                          ? <span className="text-green-600">+${tx.amount.toLocaleString()}</span>
                          : <span>-${tx.amount.toLocaleString()}</span>
                        }
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDate(tx.createdAt)}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      <LoadCreditDialog
        open={loadOpen}
        onOpenChange={setLoadOpen}
        poolBalance={pool.balance}
        onLoaded={refresh}
      />
    </div>
  )
}

/* --------------------------------------------------------------------------
 * Load Credit dialog — records an eTijwaal purchase into the pool.
 * ------------------------------------------------------------------------ */
interface LoadCreditDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  poolBalance: number
  onLoaded: () => void
}

function LoadCreditDialog({ open, onOpenChange, poolBalance, onLoaded }: LoadCreditDialogProps) {
  const [credit, setCredit] = useState('')
  const [cashPaid, setCashPaid] = useState('')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (open) {
      setCredit('')
      setCashPaid('')
      setNote('')
      setError(null)
      setSubmitting(false)
      setSuccess(false)
    }
  }, [open])

  const creditNum = Number(credit)
  const invalid = !Number.isFinite(creditNum) || creditNum <= 0

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (invalid) {
      setError('Enter a credit amount greater than 0.')
      return
    }
    setSubmitting(true)
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    const cashNum = Number(cashPaid)
    const res = await fetch('/api/wallet/load', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token ?? ''}`,
      },
      body: JSON.stringify({
        credit: creditNum,
        cashPaid: Number.isFinite(cashNum) && cashNum > 0 ? cashNum : undefined,
        note: note.trim() || undefined,
      }),
    })
    const json = await res.json()
    setSubmitting(false)
    if (!res.ok) {
      setError(json.error ?? 'Could not load credit.')
      return
    }
    setSuccess(true)
    toast.success('Credit loaded', {
      description: `${formatCurrency(creditNum)} added to the pool.`,
    })
    onLoaded()
    setTimeout(() => onOpenChange(false), 1400)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="size-5 text-primary" />
            Load Credit into Pool
          </DialogTitle>
          <DialogDescription>
            Record credit bought from eTijwaal. The purchase itself is done outside the
            system — this just adds it to the pool so you can allocate it.
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="flex flex-col items-center gap-3 py-6">
            <CheckCircle2 className="size-12 text-green-500" />
            <p className="font-semibold text-green-700">Credit Loaded!</p>
            <div className="rounded-lg bg-muted px-4 py-2 text-sm text-center">
              <span className="text-muted-foreground">Pool balance: </span>
              <span className="font-bold text-primary">{formatCurrency(poolBalance + creditNum)}</span>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label>Credit received (USD)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                <Input
                  type="number" min={1} step="0.01" placeholder="110000"
                  className="pl-7" value={credit} autoFocus
                  onChange={(e) => { setCredit(e.target.value); setError(null) }}
                />
              </div>
              <p className="text-xs text-muted-foreground">The credit value eTijwaal gave you — this enters the pool.</p>
            </div>

            <div className="space-y-1.5">
              <Label>Cash paid (optional)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                <Input
                  type="number" min={0} step="0.01" placeholder="100000"
                  className="pl-7" value={cashPaid}
                  onChange={(e) => setCashPaid(e.target.value)}
                />
              </div>
              <p className="text-xs text-muted-foreground">What you actually paid — kept for your margin record.</p>
            </div>

            <div className="space-y-1.5">
              <Label>Note (optional)</Label>
              <Input placeholder="e.g. July eTijwaal top-up" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={submitting || invalid}>
                {submitting ? 'Loading…' : 'Load Credit'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
