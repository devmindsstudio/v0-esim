'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowDownLeft, ArrowUpRight, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { getCurrentDistributor, type CurrentDistributor } from '@/lib/supabase/auth'
import { getLedger, type LedgerEntry } from '@/lib/wallet'

/* -------------------------------------------------------------------------- */

function money(n: number | null): string {
  if (n == null) return '—'
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

type Direction = 'in' | 'out'

interface Row {
  entry: LedgerEntry
  direction: Direction
  label: string
  counterparty: string
  /** Commission the user EARNED on this row (only on top-ups they received). */
  commissionEarned: number | null
}

/**
 * Re-frames a ledger row from the current distributor's point of view: money
 * coming in (a top-up they received) vs. money going out (credit given to a
 * sub, or spent on an eSIM sale).
 */
function fromMyPerspective(e: LedgerEntry, myId: string): Row {
  const incoming = e.toDistributorId === myId

  if (incoming) {
    // A top-up landed in my wallet — I earned the bonus.
    const counterparty =
      e.entryType === 'topup_admin'
        ? 'Ibara (head office)'
        : e.fromName && e.fromName !== '—'
          ? e.fromName
          : 'Your distributor'
    return {
      entry: e,
      direction: 'in',
      label: 'Credit top-up received',
      counterparty,
      commissionEarned: e.commissionAmount,
    }
  }

  // Outgoing: either I funded a sub, or I sold an eSIM.
  if (e.entryType === 'sale') {
    return {
      entry: e,
      direction: 'out',
      label: 'eSIM sale',
      counterparty: e.customerName ?? 'Customer',
      commissionEarned: null,
    }
  }
  return {
    entry: e,
    direction: 'out',
    label: 'Credit given to sub-distributor',
    counterparty: e.toName ?? '—',
    commissionEarned: null,
  }
}

const FILTERS: { key: 'all' | Direction; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'in', label: 'Money in' },
  { key: 'out', label: 'Money out' },
]

/* -------------------------------------------------------------------------- */

export default function DistributorTransactionsPage() {
  const [session, setSession] = useState<CurrentDistributor | null>(null)
  const [entries, setEntries] = useState<LedgerEntry[] | null>(null)
  const [filter, setFilter] = useState<'all' | Direction>('all')

  useEffect(() => {
    getCurrentDistributor().then((d) => {
      setSession(d)
      if (!d) return
      getLedger().then(setEntries)
    })
  }, [])

  const rows = useMemo(() => {
    if (!session || !entries) return []
    return entries.map((e) => fromMyPerspective(e, session.id))
  }, [entries, session])

  const filtered = useMemo(
    () => (filter === 'all' ? rows : rows.filter((r) => r.direction === filter)),
    [rows, filter],
  )

  if (!session) return null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Transactions</h1>
        <p className="text-muted-foreground">
          Every credit movement on your account — top-ups received, credit you passed on, and eSIM sales.
        </p>
      </div>

      {/* Summary */}
      <div className="sm:max-w-xs">
        <Card>
          <CardContent className="p-5 flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-muted">
              <Wallet className="size-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">${session.walletBalance.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Current balance</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Ledger */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h2 className="text-base font-semibold">History</h2>
          <div className="flex gap-1.5">
            {FILTERS.map((f) => (
              <Button
                key={f.key}
                size="sm"
                variant={filter === f.key ? 'default' : 'outline'}
                onClick={() => setFilter(f.key)}
              >
                {f.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="rounded-md border">
          {entries === null ? (
            <div className="text-center text-muted-foreground py-10 text-sm">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="text-center text-muted-foreground py-10 text-sm">
              {rows.length === 0
                ? 'No transactions yet. Credit top-ups and eSIM sales will appear here.'
                : 'No transactions of this type.'}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Commission earned</TableHead>
                  <TableHead className="text-right">Balance after</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => {
                  const e = r.entry
                  const inbound = r.direction === 'in'
                  return (
                    <TableRow key={e.id}>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {formatDate(e.createdAt)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          {inbound ? (
                            <ArrowDownLeft className="size-3.5 text-green-600" />
                          ) : (
                            <ArrowUpRight className="size-3.5 text-orange-600" />
                          )}
                          <span className="text-sm">{r.label}</span>
                        </div>
                        <p className="text-xs text-muted-foreground pl-5">{r.counterparty}</p>
                      </TableCell>
                      <TableCell className="text-right font-semibold text-sm">
                        {inbound ? (
                          <span className="text-green-600">+{money(e.creditAmount)}</span>
                        ) : (
                          <span>-{money(e.creditAmount)}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {r.commissionEarned == null ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <span className="text-green-600">
                            +{money(r.commissionEarned)}
                            {e.commissionPercent != null && (
                              <span className="text-muted-foreground"> ({e.commissionPercent}%)</span>
                            )}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">
                        {money(e.balanceAfter)}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </div>
  )
}
