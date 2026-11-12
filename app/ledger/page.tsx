'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Layers,
  ArrowRightLeft,
  ShoppingCart,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  getLedger,
  getDistributorProfit,
  type LedgerEntry,
  type LedgerType,
  type DistributorProfit,
} from '@/lib/wallet'

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

const TYPE_META: Record<LedgerType, { label: string; className: string }> = {
  pool_load:   { label: 'Pool load',    className: 'bg-blue-100 text-blue-700' },
  topup_admin: { label: 'Admin top-up', className: 'bg-indigo-100 text-indigo-700' },
  topup_sub:   { label: 'Sub top-up',   className: 'bg-orange-100 text-orange-700' },
  sale:        { label: 'eSIM sale',    className: 'bg-green-100 text-green-700' },
}

const FILTERS: { key: LedgerType | 'all'; label: string }[] = [
  { key: 'all',         label: 'All' },
  { key: 'pool_load',   label: 'Pool loads' },
  { key: 'topup_admin', label: 'Admin top-ups' },
  { key: 'topup_sub',   label: 'Sub top-ups' },
  { key: 'sale',        label: 'eSIM sales' },
]

/** Human-readable "who → who" for a ledger row. */
function describe(e: LedgerEntry): string {
  switch (e.entryType) {
    case 'pool_load':   return 'eTijwaal → Credit pool'
    case 'topup_admin': return `Ibara → ${e.toName ?? '—'}`
    case 'topup_sub':   return `${e.fromName ?? '—'} → ${e.toName ?? '—'}`
    case 'sale':        return `${e.fromName ?? '—'} → ${e.customerName ?? 'customer'}`
    default:            return ''
  }
}

/* -------------------------------------------------------------------------- */

export default function LedgerPage() {
  const [entries, setEntries] = useState<LedgerEntry[] | null>(null)
  const [profit, setProfit] = useState<DistributorProfit[]>([])
  const [filter, setFilter] = useState<LedgerType | 'all'>('all')

  const refresh = useCallback(() => {
    getLedger().then(setEntries)
    getDistributorProfit().then(setProfit)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const rows = entries ?? []

  const filtered = useMemo(
    () => (filter === 'all' ? rows : rows.filter((r) => r.entryType === filter)),
    [rows, filter],
  )

  // Top-line summary from what we loaded.
  const networkProfit = profit.reduce((s, p) => s + p.netProfit, 0)
  const creditSold = profit.reduce((s, p) => s + p.creditSoldAsEsims, 0)
  const saleCount = rows.filter((r) => r.entryType === 'sale').length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Ledger</h1>
        <p className="text-muted-foreground">
          Every money movement across the network — pool loads, top-ups, and eSIM sales.
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5 flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
              <TrendingUp className="size-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{money(networkProfit)}</p>
              <p className="text-xs text-muted-foreground">Network commission (spread) earned</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-muted">
              <Wallet className="size-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{money(creditSold)}</p>
              <p className="text-xs text-muted-foreground">Credit sold as eSIMs</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-muted">
              <ShoppingCart className="size-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{saleCount}</p>
              <p className="text-xs text-muted-foreground">eSIM sales recorded</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Profit per distributor */}
      <div>
        <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
          <ArrowRightLeft className="size-4 text-primary" />
          Profit by distributor
        </h2>
        <div className="rounded-md border">
          {profit.length === 0 ? (
            <div className="text-center text-muted-foreground py-10 text-sm">
              No commission activity yet. Top up a distributor with a commission % to see profit here.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Distributor</TableHead>
                  <TableHead className="text-right">Commission received</TableHead>
                  <TableHead className="text-right">Commission given</TableHead>
                  <TableHead className="text-right">Net profit</TableHead>
                  <TableHead className="text-right">Sold as eSIMs</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {profit.map((p) => (
                  <TableRow key={p.distributorId}>
                    <TableCell>
                      <p className="font-medium text-sm">{p.name}</p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {p.role.replace('_', ' ')}
                      </p>
                    </TableCell>
                    <TableCell className="text-right text-sm text-green-600">
                      +{money(p.commissionReceived)}
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {p.commissionGiven ? `-${money(p.commissionGiven)}` : '—'}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-sm">
                      {money(p.netProfit)}
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {money(p.creditSoldAsEsims)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      {/* Full ledger */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Layers className="size-4 text-primary" />
            Transactions
          </h2>
          <div className="flex flex-wrap gap-1.5">
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
                ? 'No transactions yet.'
                : 'No transactions of this type.'}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Detail</TableHead>
                  <TableHead className="text-right">Cash</TableHead>
                  <TableHead className="text-right">Credit</TableHead>
                  <TableHead className="text-right">Commission</TableHead>
                  <TableHead className="text-right">Balance after</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((e) => {
                  const meta = TYPE_META[e.entryType]
                  return (
                    <TableRow key={e.id}>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {formatDate(e.createdAt)}
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${meta.className}`}>
                          {meta.label}
                        </span>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm">{describe(e)}</p>
                        {e.actorRole && (
                          <p className="text-xs text-muted-foreground capitalize">
                            by {e.actorRole.replace('_', ' ')}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">
                        {money(e.cashPaid)}
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium">
                        {money(e.creditAmount)}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {e.commissionAmount == null ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <span className="text-green-600">
                            +{money(e.commissionAmount)}
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
