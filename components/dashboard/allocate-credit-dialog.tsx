'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import {
  getCreditCirculation,
  getAllocatableDistributors,
  getCreditPool,
  type CreditCirculation,
  type AllocatableDistributor,
  type CreditPool,
} from '@/lib/wallet'
import { getGlobalDefaultCommission } from '@/lib/settings'

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Allocate credit ("top-up") to a distributor. Self-contained + controlled:
 * the parent owns `open`; on a successful allocation `onAllocated` fires so the
 * parent can refresh anything it shows (e.g. the header circulation pill).
 *
 * Shared by the TopBar "Quick Top-up" button and the dashboard "Allocate
 * Credit" quick action so both drive the exact same flow (POST /api/wallet/allocate).
 */
export function AllocateCreditDialog({
  open,
  onOpenChange,
  onAllocated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAllocated?: () => void
}) {
  const [circ, setCirc] = useState<CreditCirculation | null>(null)
  const [pool, setPool] = useState<CreditPool | null>(null)
  const [distributors, setDistributors] = useState<AllocatableDistributor[]>([])
  const [distributorId, setDistributorId] = useState('')
  const [amount, setAmount] = useState('')
  const [commission, setCommission] = useState('')
  const [error, setError] = useState('')
  const [placing, setPlacing] = useState(false)
  const [success, setSuccess] = useState(false)

  // Load pool + distributor list and reset the form each time it opens.
  useEffect(() => {
    if (!open) return
    getCreditCirculation().then(setCirc)
    getCreditPool().then(setPool)
    getAllocatableDistributors().then(setDistributors)
    setDistributorId('')
    setAmount('')
    setCommission('')
    setError('')
    setSuccess(false)
    // Pre-fill the commission with the admin's configured default.
    getGlobalDefaultCommission().then((v) => setCommission(v ? String(v) : ''))
  }, [open])

  async function handleAllocate(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const num = Number(amount)
    const pct = commission.trim() === '' ? 0 : Number(commission)
    if (!distributorId || !Number.isFinite(num) || num <= 0) return
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      setError('Commission % must be between 0 and 100.')
      return
    }
    setPlacing(true)

    const supabase = createClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()

    const res = await fetch('/api/wallet/allocate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token ?? ''}`,
      },
      body: JSON.stringify({ toDistributorId: distributorId, cashPaid: num, commissionPercent: pct }),
    })
    const json = await res.json()
    setPlacing(false)

    if (!res.ok) {
      setError(json.error ?? 'Allocation failed.')
      toast.error('Allocation failed', { description: json.error })
      return
    }

    const dist = distributors.find((d) => d.id === distributorId)
    const credit = Number(json.credit ?? num)
    setSuccess(true)
    toast.success('Top-up complete', {
      description: `$${credit.toLocaleString()} credit sent to ${dist?.name ?? 'distributor'}.`,
    })
    // Refresh our own figures + let the parent refresh whatever it shows.
    getCreditCirculation().then(setCirc)
    getCreditPool().then(setPool)
    onAllocated?.()
    setTimeout(() => {
      onOpenChange(false)
      setSuccess(false)
    }, 1800)
  }

  const selectedDist = distributors.find((d) => d.id === distributorId)
  const cashAmt = Number(amount || 0)
  const bonusPct = commission.trim() === '' ? 0 : Number(commission)
  const validPct = Number.isFinite(bonusPct) && bonusPct >= 0 && bonusPct <= 100
  const creditAmt = cashAmt > 0 && validPct ? round2(cashAmt * (1 + bonusPct / 100)) : 0
  const poolBalance = pool?.balance ?? 0
  // It's the CREDIT (not the cash) that is drawn from the pool.
  const exceedsPool = creditAmt > 0 && creditAmt > poolBalance

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Allocate Credit</DialogTitle>
        </DialogHeader>

        {success ? (
          <div className="flex flex-col items-center gap-3 py-6">
            <CheckCircle2 className="size-12 text-green-500" />
            <p className="font-semibold text-green-700">Top-up complete!</p>
            <p className="text-sm text-muted-foreground text-center">
              {formatCurrency(creditAmt)} credit added to{' '}
              <span className="font-medium text-foreground">{selectedDist?.name}</span>
            </p>
            {circ && (
              <div className="rounded-lg bg-muted px-4 py-2 text-sm text-center">
                <span className="text-muted-foreground">Credit in circulation: </span>
                <span className="font-bold text-primary">{formatCurrency(circ.inCirculation)}</span>
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleAllocate} className="space-y-4 pt-1">
            {/* Distributor selector */}
            <div className="space-y-1.5">
              <Label>Distributor</Label>
              <Select value={distributorId} onValueChange={setDistributorId} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select distributor" />
                </SelectTrigger>
                <SelectContent>
                  {distributors.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      <span>{d.name}</span>
                      <span className="text-muted-foreground ml-1 text-xs">— {d.company}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {distributors.length === 0 && (
                <p className="text-xs text-muted-foreground">No distributors yet — add one first.</p>
              )}
            </div>

            {/* Cash received */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Cash received ($)</Label>
                <span className="text-xs text-muted-foreground">
                  Pool available:{' '}
                  <span className={`font-medium ${poolBalance <= 0 ? 'text-destructive' : ''}`}>
                    {formatCurrency(poolBalance)}
                  </span>
                </span>
              </div>
              <Input
                type="number"
                min={1}
                step="0.01"
                placeholder="e.g. 5000"
                value={amount}
                onChange={(e) => { setAmount(e.target.value); setError('') }}
                className={exceedsPool ? 'border-destructive focus-visible:ring-destructive' : ''}
                required
              />
              {exceedsPool && (
                <p className="text-xs text-destructive">
                  Not enough credit in the pool. Load more from Credit &amp; Wallet first.
                </p>
              )}
            </div>

            {/* Commission % — fixed by the default commission setting */}
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <Lock className="size-3 text-muted-foreground" /> Commission %
              </Label>
              <div className="relative sm:max-w-40">
                <Input
                  type="number"
                  className="pr-7 bg-muted/50 cursor-not-allowed"
                  value={commission}
                  readOnly
                  tabIndex={-1}
                  aria-label="Commission percent (fixed by the default)"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Fixed by the default commission setting (Account Settings).
              </p>
            </div>

            {/* Preview */}
            {selectedDist && cashAmt > 0 && validPct && !exceedsPool && (
              <div className="rounded-lg bg-primary/5 border border-primary/10 px-3 py-2 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Recipient</span>
                  <span className="font-medium">{selectedDist.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cash received</span>
                  <span className="font-medium">{formatCurrency(cashAmt)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Bonus rate</span>
                  <span className="font-medium">+{bonusPct}%</span>
                </div>
                <div className="flex justify-between border-t pt-1 mt-1">
                  <span className="text-muted-foreground">Credit added</span>
                  <span className="font-bold text-primary">+{formatCurrency(creditAmt)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Their balance after</span>
                  <span className="font-semibold">
                    {formatCurrency(selectedDist.walletBalance + creditAmt)}
                  </span>
                </div>
              </div>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={placing || !distributorId || !amount || !validPct || exceedsPool}>
                {placing ? 'Topping up…' : 'Confirm Top-up'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
