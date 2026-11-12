'use client'

import { useEffect, useState } from 'react'
import { Wallet, Lock } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface AllocateCreditDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Who is receiving the credit (shown in the header). */
  recipientName: string
  /**
   * How much the SENDER has to give. Provided for distributor → sub transfers
   * so we can cap the CREDIT client-side (it's the credit, not the cash, that
   * leaves the sender's wallet). Omitted for admin, who draws from the pool.
   */
  availableBalance?: number
  /** Pre-fills the commission % field (the default). Still editable per top-up. */
  defaultCommissionPercent?: number
  /**
   * Require a commission greater than 0 to top up (used for sub-distributor
   * top-ups, so the distributor always earns on them). When true and the
   * commission is 0, the action is blocked with a hint.
   */
  requireCommission?: boolean
  /**
   * Called with the cash received, the commission % chosen for THIS top-up,
   * and an optional note. Returns true on success.
   */
  onSubmit: (cashPaid: number, commissionPercent: number, note: string) => Promise<boolean>
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function money(n: number): string {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

export function AllocateCreditDialog({
  open,
  onOpenChange,
  recipientName,
  availableBalance,
  defaultCommissionPercent,
  requireCommission = false,
  onSubmit,
}: AllocateCreditDialogProps) {
  const [cash, setCash] = useState('')
  const [commission, setCommission] = useState('')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset the form whenever the dialog is (re)opened — pre-filling the commission
  // with the configured default (still editable for this top-up).
  useEffect(() => {
    if (open) {
      setCash('')
      setCommission(defaultCommissionPercent != null ? String(defaultCommissionPercent) : '')
      setNote('')
      setError(null)
      setSubmitting(false)
    }
  }, [open, defaultCommissionPercent])

  const cashNum = Number(cash)
  const pctNum = commission.trim() === '' ? 0 : Number(commission)
  const invalidCash = !Number.isFinite(cashNum) || cashNum <= 0
  const invalidPct = !Number.isFinite(pctNum) || pctNum < 0 || pctNum > 100
  const credit = invalidCash || invalidPct ? 0 : round2(cashNum * (1 + pctNum / 100))
  const hasCap = typeof availableBalance === 'number'
  // It's the CREDIT that leaves the sender's wallet, so cap on that.
  const overCap = hasCap && credit > (availableBalance as number)
  // Sub top-ups must carry a commission (> 0) so the distributor earns on them.
  const needsCommission = requireCommission && !(pctNum > 0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (invalidCash) {
      setError('Enter an amount greater than 0.')
      return
    }
    if (invalidPct) {
      setError('Commission % must be between 0 and 100.')
      return
    }
    if (overCap) {
      setError('This exceeds your available balance.')
      return
    }
    if (needsCommission) {
      setError('Set a default commission greater than 0% before topping up.')
      return
    }
    setSubmitting(true)
    const ok = await onSubmit(cashNum, pctNum, note.trim())
    setSubmitting(false)
    if (ok) onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="size-5 text-primary" />
            Top-up
          </DialogTitle>
          <DialogDescription>
            Top up <span className="font-semibold text-foreground">{recipientName}</span>.
            {hasCap && (
              <>
                {' '}You have{' '}
                <span className="font-semibold text-foreground">
                  {money(availableBalance as number)}
                </span>{' '}
                available.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Cash received (USD)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                  $
                </span>
                <Input
                  type="number"
                  min={1}
                  step="0.01"
                  placeholder="1000"
                  className="pl-7"
                  value={cash}
                  onChange={(e) => setCash(e.target.value)}
                  autoFocus
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <Lock className="size-3 text-muted-foreground" /> Commission %
              </Label>
              <div className="relative">
                <Input
                  type="number"
                  className="pr-7 bg-muted/50 cursor-not-allowed"
                  value={commission}
                  readOnly
                  tabIndex={-1}
                  aria-label="Commission percent (fixed by the default)"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                  %
                </span>
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground -mt-1">
            Commission is fixed by the default commission setting and can&apos;t be changed here.
          </p>

          {/* Live credit preview */}
          {!invalidCash && !invalidPct && (
            <div className="rounded-lg bg-primary/5 border border-primary/10 px-3 py-2 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cash received</span>
                <span className="font-medium">{money(cashNum)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Commission</span>
                <span className="font-medium">+{pctNum}%</span>
              </div>
              <div className="flex justify-between border-t pt-1 mt-1">
                <span className="text-muted-foreground">Credit added</span>
                <span className="font-bold text-primary">{money(credit)}</span>
              </div>
              {hasCap && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Your balance after</span>
                  <span className={`font-semibold ${overCap ? 'text-destructive' : ''}`}>
                    {money((availableBalance as number) - credit)}
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Note (optional)</Label>
            <Input
              placeholder="e.g. June top-up"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          {needsCommission && (
            <p className="text-sm text-destructive">
              Commission is 0%. Set a default commission greater than 0% (above) before topping up,
              so you earn on this top-up.
            </p>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting || invalidCash || invalidPct || overCap || needsCommission}
            >
              {submitting ? 'Topping up…' : 'Top up'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
